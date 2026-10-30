import type { SupabaseClient } from '@supabase/supabase-js'
import { GAME_IDS, GAMES, type GameId } from '../data/games.ts'
import { completedDaysFrom, currentStreakOf, longestStreakOf } from '../state/store.ts'
import type { AppState, GameResult, RemoteSession, RemoteSnapshot } from '../state/types.ts'
import { dayKeyOf, fromDayKey, type DayKey } from './date.ts'
import { attempt, inOrder, newId, warn } from './dbUtil.ts'
import { supabase } from './supabase.ts'

// All game data going to and from Supabase lives here. Nothing in here may throw into the app:
// a database problem is logged and the game carries on from localStorage.

const PAGE_SIZE = 1000
const MAX_PAGES = 50
const NOON_MS = 12 * 60 * 60 * 1000

/** Streak numbers to store after a player finishes all three daily games. */
export interface ProgressUpdate {
  currentStreak: number
  longestStreak: number
  lastPlayedDay: DayKey
}

interface Entry extends RemoteSession {
  /** Full timestamp, used to find the latest play. */
  at: string
}

// ---------- Game ids ----------

let gameIds: Promise<Map<GameId, number>> | null = null

/** The integer ids in the `games` table, matched on name (case-insensitive) and cached. */
function loadGameIds(db: SupabaseClient): Promise<Map<GameId, number>> {
  gameIds ??= fetchGameIds(db).catch((error) => {
    gameIds = null // Try again next time.
    throw error
  })
  return gameIds
}

async function fetchGameIds(db: SupabaseClient): Promise<Map<GameId, number>> {
  const { data, error } = await db.from('games').select('id, name')
  if (error) throw error
  const rows = (data ?? []) as { id: number; name: string }[]
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  const ids = new Map<GameId, number>()
  for (const id of GAME_IDS) {
    // "Memory" first, then the full title ("Memory Match") in case the table uses that.
    const row = rows.find((r) => same(r.name, GAMES[id].name)) ?? rows.find((r) => same(r.name, GAMES[id].title))
    if (row) ids.set(id, row.id)
    else console.warn(`No row in the games table matches "${GAMES[id].name}"; its results will not be saved.`)
  }
  return ids
}

// ---------- Saving a result ----------

/**
 * Writes one finished game: a `game_sessions` row, the player's `user_game_stats` row for that game,
 * and (when `progress` is given, i.e. all three dailies are done) their `progress` row.
 */
export function saveResult(userId: string, result: GameResult, progress: ProgressUpdate | null): Promise<void> {
  return inOrder(() => saveResultNow(userId, result, progress))
}

async function saveResultNow(userId: string, result: GameResult, progress: ProgressUpdate | null): Promise<void> {
  const db = supabase
  if (!db) return
  try {
    const gameId = (await loadGameIds(db)).get(result.gameId)
    if (gameId === undefined) return
    const playedAt = new Date().toISOString()
    const row = { client_session_id: newId(), user_id: userId, game_id: gameId, score: result.points, played_at: playedAt }

    await attempt('save the game session', () => insertSession(db, row))
    await attempt('update game stats', async () => {
      const { data, error } = await db
        .from('user_game_stats')
        .select('best_score')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .maybeSingle()
      if (error) throw error
      await upsertStats(db, userId, gameId, Math.max(data?.best_score ?? 0, result.points), result.points, playedAt)
    })
    if (progress) await attempt('update progress', () => upsertProgress(db, userId, progress))
  } catch (error) {
    warn('save the result', error)
  }
}

/** The same client_session_id is reused on the one retry, so a retry can never insert twice. */
async function insertSession(db: SupabaseClient, row: object) {
  for (let tries = 0; ; tries++) {
    const { error } = await db.from('game_sessions').insert(row)
    if (!error || error.code === '23505') return // 23505: this play is already stored.
    if (tries >= 1) throw error
  }
}

async function upsertStats(db: SupabaseClient, userId: string, gameId: number, best: number, last: number, lastAt: string) {
  const { error } = await db
    .from('user_game_stats')
    .upsert(
      { user_id: userId, game_id: gameId, best_score: best, last_score: last, last_played_at: lastAt },
      { onConflict: 'user_id,game_id' },
    )
  if (error) throw error
}

async function upsertProgress(db: SupabaseClient, userId: string, progress: ProgressUpdate) {
  const { error } = await db.from('progress').upsert(
    {
      user_id: userId,
      current_streak: progress.currentStreak,
      longest_streak: progress.longestStreak,
      last_played_day: progress.lastPlayedDay,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

// ---------- Loading on login ----------

const keyOf = (r: RemoteSession) => `${r.gameId}|${r.playedAt}|${r.points}`

async function fetchEntries(db: SupabaseClient, userId: string, byDbId: Map<number, GameId>): Promise<Entry[]> {
  const entries: Entry[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await db
      .from('game_sessions')
      .select('game_id, score, played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as { game_id: number; score: number; played_at: string }[]
    for (const row of rows) {
      const gameId = byDbId.get(row.game_id)
      if (gameId) entries.push({ gameId, points: row.score, playedAt: dayKeyOf(new Date(row.played_at)), at: row.played_at })
    }
    if (rows.length < PAGE_SIZE) break
  }
  return entries
}

/**
 * Loads the player's saved data and, where the app holds plays the database does not, uploads them:
 * everything on the first sign-in with an empty database, and today's plays otherwise (this is how
 * a game played as a guest reaches the account). Resolves to null if the database could not be read.
 */
export function loadAndSync(userId: string, local: AppState): Promise<RemoteSnapshot | null> {
  return inOrder(() => loadAndSyncNow(userId, local))
}

async function loadAndSyncNow(userId: string, local: AppState): Promise<RemoteSnapshot | null> {
  const db = supabase
  if (!db) return null
  try {
    const ids = await loadGameIds(db)
    const byDbId = new Map([...ids].map(([gameId, id]) => [id, gameId]))
    const entries = await fetchEntries(db, userId, byDbId)

    const progressQuery = await db.from('progress').select('longest_streak').eq('user_id', userId).maybeSingle()
    if (progressQuery.error) throw progressQuery.error
    const remoteLongest: number | null = progressQuery.data?.longest_streak ?? null

    // Upload plays the database is missing.
    const firstSync = entries.length === 0
    const candidates = new Map<string, GameResult>()
    if (firstSync) for (const id of GAME_IDS) for (const r of local.topScores[id]) candidates.set(keyOf(rem(r)), r)
    for (const r of Object.values(local.todayResults)) if (r) candidates.set(keyOf(rem(r)), r)
    const known = new Set(entries.map(keyOf))
    const missing = [...candidates].filter(([key, r]) => !known.has(key) && ids.has(r.gameId))

    let uploaded = 0
    if (missing.length > 0) {
      const now = new Date().toISOString()
      const rows = missing.map(([, r]) => ({
        client_session_id: newId(),
        user_id: userId,
        game_id: ids.get(r.gameId),
        score: r.points,
        played_at: r.playedAt === local.today ? now : new Date(fromDayKey(r.playedAt).getTime() + NOON_MS).toISOString(),
      }))
      const ok = await attempt('upload saved plays', async () => {
        const { error } = await db.from('game_sessions').insert(rows)
        if (error) throw error
      })
      // Plays that failed to upload still count here, so loading never hides them; today's are retried next time.
      missing.forEach(([, r], i) => entries.push({ gameId: r.gameId, points: r.points, playedAt: r.playedAt, at: rows[i].played_at }))
      entries.sort((a, b) => a.at.localeCompare(b.at))
      if (ok) {
        uploaded = missing.length
        for (const id of new Set(missing.map(([, r]) => r.gameId))) {
          const plays = entries.filter((e) => e.gameId === id)
          const last = plays[plays.length - 1]
          await attempt('update game stats', () =>
            upsertStats(db, userId, ids.get(id)!, Math.max(...plays.map((p) => p.points)), last.points, last.at),
          )
        }
      }
    }

    // Days and streaks. Local progress is kept on the first sync: only the top three plays per game
    // are stored locally, so the database cannot reproduce the older days.
    let completedDays = completedDaysFrom(entries)
    if (firstSync) completedDays = [...new Set([...completedDays, ...local.completedDays])].sort()
    const longestStreak = Math.max(remoteLongest ?? 0, longestStreakOf(completedDays), firstSync ? local.bestStreak : 0)
    if (uploaded > 0 || (remoteLongest === null && completedDays.length > 0)) {
      await attempt('update progress', () =>
        upsertProgress(db, userId, {
          currentStreak: currentStreakOf(completedDays, local.today),
          longestStreak,
          lastPlayedDay: completedDays[completedDays.length - 1] ?? local.today,
        }),
      )
    }

    return {
      userId,
      sessions: entries,
      completedDays,
      longestStreak,
      gamesPlayed: firstSync ? Math.max(entries.length, local.gamesPlayed) : entries.length,
    }
  } catch (error) {
    warn('load saved progress', error)
    return null
  }
}

function rem(r: GameResult): RemoteSession {
  return { gameId: r.gameId, points: r.points, playedAt: r.playedAt }
}
