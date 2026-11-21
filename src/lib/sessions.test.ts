// Testing how game results are uploaded to and read back from Supabase
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeResult } from '../test/fixtures.ts'
import type { GameResult } from '../state/types.ts'

const USER = 'user-1'

/** A tiny stand-in for the Supabase client: the games table, an upsert log and saved session rows. */
const db = vi.hoisted(() => ({
  games: [] as { id: number; category: string }[],
  upserts: [] as Record<string, unknown>[][],
  sessions: [] as Record<string, unknown>[],
}))

vi.mock('./supabase.ts', () => {
  // Every query builder method returns the builder; awaiting it gives the rows for its table.
  const query = (table: string) => {
    const rows = () => (table === 'games' ? db.games : table === 'game_sessions' ? db.sessions : [])
    const builder: Record<string, unknown> = {
      then: (resolve: (v: unknown) => void) => resolve({ data: rows(), error: null }),
      maybeSingle: async () => ({ data: { longest_streak: 2 }, error: null }),
      upsert: async (r: Record<string, unknown>[]) => {
        db.upserts.push(r)
        return { error: null }
      },
    }
    for (const m of ['select', 'eq', 'order', 'range']) builder[m] = () => builder
    return builder
  }
  return { supabase: { from: query } }
})

async function load() {
  vi.resetModules() // The game id lookup is cached per module.
  return import('./sessions.ts')
}

const colorWord = (): GameResult =>
  makeResult('colorword', 1100, {
    id: '11111111-1111-1111-1111-111111111111',
    finishedAt: '2026-11-23T15:00:00.000Z',
    stats: ['19 of 20 correct'],
    highlight: '19/20',
    details: { correct: 19, wrong: 1, rounds: 20, avgResponseMs: 812 },
  })

beforeEach(() => {
  localStorage.clear()
  db.upserts.length = 0
  db.sessions.length = 0
  db.games = [
    { id: 1, category: 'memory' },
    { id: 2, category: 'colors' },
    { id: 3, category: 'numbers' },
    { id: 4, category: 'colorword' },
  ]
})

describe('flushPending', () => {
  it('uploads a Color & Word game with its correct, wrong and response time in details', async () => {
    const { flushPending, queueResults } = await load()
    queueResults(USER, [colorWord()])

    expect(await flushPending(USER)).toEqual([])
    expect(db.upserts).toHaveLength(1)
    expect(db.upserts[0][0]).toMatchObject({
      game_id: 4,
      score: 1100,
      details: { stats: ['19 of 20 correct'], highlight: '19/20', correct: 19, wrong: 1, rounds: 20, avgResponseMs: 812 },
    })
  })

  it('keeps a game the database does not list yet queued, and still uploads the others', async () => {
    db.games = db.games.filter((g) => g.category !== 'colorword')
    const { flushPending, queueResults } = await load()
    const memory = makeResult('memory', 900, { id: '22222222-2222-2222-2222-222222222222' })
    queueResults(USER, [colorWord(), memory])

    const left = await flushPending(USER)
    expect(left.map((r) => r.gameId)).toEqual(['colorword'])
    expect(db.upserts[0].map((r) => r.game_id)).toEqual([1])
  })
})

describe('fetchProgress', () => {
  it('reads the details back onto the result', async () => {
    db.sessions.push({
      client_session_id: 'abc',
      game_id: 4,
      score: 1100,
      played_at: '2026-11-23T15:00:00.000Z',
      duration_sec: 31,
      hints_used: 0,
      hint_penalty: 0,
      details: { stats: ['19 of 20 correct'], highlight: '19/20', correct: 19, wrong: 1, rounds: 20, avgResponseMs: 812 },
    })
    const { fetchProgress } = await load()

    const saved = await fetchProgress(USER)
    expect(saved?.longestStreak).toBe(2)
    expect(saved?.results[0]).toMatchObject({
      gameId: 'colorword',
      points: 1100,
      highlight: '19/20',
      details: { correct: 19, wrong: 1, rounds: 20, avgResponseMs: 812 },
    })
  })
})
