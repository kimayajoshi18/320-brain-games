import { isGameId, type GameId } from '../data/games.ts'
import type { GameResult } from '../state/types.ts'
import { toDayKey } from './date.ts'
import { formatNumber } from './format.ts'
import { supabase } from './supabase.ts'

// Every finished game is one row in `game_sessions`. Triggers on that table keep
// `user_game_stats` (best and last score per game) and `progress` (the streak) up to date,
// so the frontend only ever inserts sessions and reads them back.
//
// Results wait in a per-user queue in localStorage until Supabase accepts them, so a game
// played offline or during a failed request is uploaded next time. Uploads are idempotent:
// client_session_id is unique per user, and a repeat is ignored.

const PENDING_KEY = 'puzzlr:pending'
const PAGE_SIZE = 1000

interface SessionRow {
  client_session_id: string
  game_id: number
  score: number
  played_at: string
  duration_sec: number | null
  hints_used: number
  hint_penalty: number
  details: { stats?: string[]; highlight?: string } | null
}

/** Gives a result the id and finish time it needs to be saved. */
export function stamp(result: GameResult): GameResult {
  return { ...result, id: result.id ?? crypto.randomUUID(), finishedAt: result.finishedAt ?? new Date().toISOString() }
}

// ---------- Pending queue ----------

function pendingKey(userId: string) {
  return `${PENDING_KEY}:${userId}`
}

function readPending(userId: string): GameResult[] {
  try {
    const raw = localStorage.getItem(pendingKey(userId))
    return raw ? (JSON.parse(raw) as GameResult[]) : []
  } catch {
    return []
  }
}

function writePending(userId: string, results: GameResult[]) {
  try {
    if (results.length) localStorage.setItem(pendingKey(userId), JSON.stringify(results))
    else localStorage.removeItem(pendingKey(userId))
  } catch {
    // Storage blocked: the upload is still attempted, it just won't be retried after a reload.
  }
}

/** Adds results to the player's upload queue. */
export function queueResults(userId: string, results: GameResult[]) {
  const pending = readPending(userId)
  const queued = new Set(pending.map((r) => r.id))
  writePending(userId, [...pending, ...results.map(stamp).filter((r) => !queued.has(r.id))])
}

// ---------- Game ids ----------

// `games.category` matches the app's game ids (memory, numbers, colors).
let gameIds: Promise<Map<GameId, number>> | null = null

function loadGameIds(): Promise<Map<GameId, number>> {
  gameIds ??= (async () => {
    const { data, error } = await supabase!.from('games').select('id, category')
    if (error) throw new Error(error.message)
    return new Map(data.filter((g) => isGameId(g.category)).map((g) => [g.category as GameId, g.id as number]))
  })()
  gameIds.catch(() => (gameIds = null)) // Try again next time.
  return gameIds
}

// ---------- Upload and download ----------

/** Uploads everything in the player's queue. Resolves to the results that are still waiting. */
export async function flushPending(userId: string): Promise<GameResult[]> {
  const pending = readPending(userId)
  if (!supabase || pending.length === 0) return pending
  try {
    const ids = await loadGameIds()
    const rows = pending.map((r) => ({
      client_session_id: r.id!,
      user_id: userId,
      game_id: ids.get(r.gameId),
      score: Math.max(0, Math.round(r.points)),
      played_at: r.finishedAt!,
      duration_sec: Math.max(0, Math.round(r.durationSec)),
      hints_used: Math.max(0, Math.round(r.hintsUsed ?? 0)),
      hint_penalty: Math.max(0, Math.round(r.hintPenalty ?? 0)),
      details: { stats: r.stats, highlight: r.highlight },
    }))
    const { error } = await supabase
      .from('game_sessions')
      .upsert(rows, { onConflict: 'user_id,client_session_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  } catch (error) {
    console.error('Could not save game results; will retry later:', (error as Error).message)
    return pending
  }
  // Keep anything queued while the upload was in flight.
  const uploaded = new Set(pending.map((r) => r.id))
  const left = readPending(userId).filter((r) => !uploaded.has(r.id))
  writePending(userId, left)
  return left
}

export interface SavedProgress {
  results: GameResult[]
  /** progress.longest_streak, kept by the server. */
  longestStreak: number
}

/** Loads every saved game for the player, oldest first. Returns null (and logs why) on failure. */
export async function fetchProgress(userId: string): Promise<SavedProgress | null> {
  if (!supabase) return null
  try {
    const ids = await loadGameIds()
    const games = new Map([...ids].map(([gameId, id]) => [id, gameId]))

    const rows: SessionRow[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('client_session_id, game_id, score, played_at, duration_sec, hints_used, hint_penalty, details')
        .eq('user_id', userId)
        .order('played_at')
        .order('client_session_id')
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      rows.push(...(data as SessionRow[]))
      if (data.length < PAGE_SIZE) break
    }

    const { data: progress, error } = await supabase
      .from('progress')
      .select('longest_streak')
      .eq('user_id', userId)
      .maybeSingle<{ longest_streak: number }>()
    if (error) throw new Error(error.message)

    const results = rows.flatMap((row): GameResult[] => {
      const gameId = games.get(row.game_id)
      if (!gameId) return []
      return [
        {
          id: row.client_session_id,
          gameId,
          points: row.score,
          durationSec: row.duration_sec ?? 0,
          hintsUsed: row.hints_used,
          hintPenalty: row.hint_penalty,
          stats: row.details?.stats ?? [],
          highlight: row.details?.highlight ?? formatNumber(row.score),
          playedAt: toDayKey(new Date(row.played_at)),
          finishedAt: row.played_at,
        },
      ]
    })
    return { results, longestStreak: progress?.longest_streak ?? 0 }
  } catch (error) {
    console.error('Could not load game progress:', (error as Error).message)
    return null
  }
}
