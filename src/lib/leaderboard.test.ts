// Testing the leaderboard and friend calls to Supabase
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriendByEmail, answerFriendRequest, fetchFriendRequests, fetchLeaderboard } from './leaderboard.ts'

type Reply = { data?: unknown; error: { message: string } | null }

/** A stand-in Supabase client that records every call and replies with `reply`. */
const db = vi.hoisted(() => ({
  reply: { data: null, error: null } as Reply,
  calls: [] as unknown[][],
}))

vi.mock('./supabase.ts', () => {
  const builder = (table: string) => {
    const self = {
      update: (values: unknown) => (db.calls.push(['update', table, values]), self),
      delete: () => (db.calls.push(['delete', table]), self),
      eq: (column: string, value: unknown) => (db.calls.push(['eq', column, value]), self),
      then: (resolve: (v: Reply) => void) => resolve(db.reply),
    }
    return self
  }
  return {
    supabase: {
      rpc: async (name: string, args?: unknown) => (db.calls.push(['rpc', name, args]), db.reply),
      from: builder,
    },
  }
})

beforeEach(() => {
  db.calls.length = 0
  db.reply = { data: null, error: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('fetchLeaderboard', () => {
  it('asks the database function for the game, period and audience, and renames the columns', async () => {
    db.reply = {
      data: [
        { display_name: 'Grace', score: 1290, rank: 1, is_you: false },
        { display_name: 'Ada', score: 1100, rank: 2, is_you: true },
      ],
      error: null,
    }

    const rows = await fetchLeaderboard('memory', 'month', true)
    expect(db.calls).toEqual([['rpc', 'puzzlr_leaderboard', { p_game_id: 'memory', p_period: 'month', p_friends_only: true }]])
    expect(rows).toEqual([
      { name: 'Grace', score: 1290, rank: 1, isYou: false },
      { name: 'Ada', score: 1100, rank: 2, isYou: true },
    ])
  })

  it('returns null when the database refuses', async () => {
    db.reply = { data: null, error: { message: 'permission denied' } }
    expect(await fetchLeaderboard('all', 'week', false)).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('fetchFriendRequests', () => {
  it('lists who sent each request', async () => {
    db.reply = { data: [{ requester_id: 'u-grace', display_name: 'Grace' }], error: null }
    expect(await fetchFriendRequests()).toEqual([{ requesterId: 'u-grace', name: 'Grace' }])
    expect(db.calls).toEqual([['rpc', 'puzzlr_friend_requests', undefined]])
  })

  it('returns no requests on an error', async () => {
    db.reply = { data: null, error: { message: 'offline' } }
    expect(await fetchFriendRequests()).toEqual([])
  })
})

describe('addFriendByEmail', () => {
  it('sends the email to the database function', async () => {
    expect(await addFriendByEmail('grace@example.com')).toBe(true)
    expect(db.calls).toEqual([['rpc', 'puzzlr_add_friend', { p_email: 'grace@example.com' }]])
  })

  it('reports a failure', async () => {
    db.reply = { error: { message: 'offline' } }
    expect(await addFriendByEmail('grace@example.com')).toBe(false)
  })
})

describe('answerFriendRequest', () => {
  it('accepts by marking the friendship accepted', async () => {
    expect(await answerFriendRequest('u-grace', true)).toBe(true)
    expect(db.calls).toEqual([
      ['update', 'friendships', { status: 'accepted' }],
      ['eq', 'requester_id', 'u-grace'],
    ])
  })

  it('declines by deleting the request', async () => {
    expect(await answerFriendRequest('u-grace', false)).toBe(true)
    expect(db.calls).toEqual([
      ['delete', 'friendships'],
      ['eq', 'requester_id', 'u-grace'],
    ])
  })

  it('reports a failure, e.g. before the delete grant is in place', async () => {
    db.reply = { error: { message: 'permission denied for table friendships' } }
    expect(await answerFriendRequest('u-grace', false)).toBe(false)
  })
})
