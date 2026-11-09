import type { GameId } from '../data/games.ts'
import { supabase } from './supabase.ts'

export type Period = 'week' | 'month'

export interface LeaderboardRow {
  name: string
  score: number
  rank: number
  isYou: boolean
}

export interface FriendRequest {
  id: string
  name: string
}

// The leaderboard and friends all go through database functions (supabase/backend_sprint4.sql),
// which only ever return display names and scores.

/** Null when the leaderboard could not be loaded. */
export async function fetchLeaderboard(game: GameId | 'all', period: Period, friendsOnly: boolean): Promise<LeaderboardRow[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('puzzlr_leaderboard', {
    p_game_id: game,
    p_period: period,
    p_friends_only: friendsOnly,
  })
  if (error) {
    console.error('Could not load the leaderboard:', error.message)
    return null
  }
  return (data as { display_name: string; score: number; rank: number; is_you: boolean }[]).map((r) => ({
    name: r.display_name,
    score: r.score,
    rank: r.rank,
    isYou: r.is_you,
  }))
}

/** Sends a friend request. It succeeds whether or not the email has an account. */
export async function addFriendByEmail(email: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('puzzlr_add_friend', { p_email: email })
  if (error) console.error('Could not send the friend request:', error.message)
  return !error
}

export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('puzzlr_friend_requests')
  if (error) {
    console.error('Could not load friend requests:', error.message)
    return []
  }
  return (data as { id: string; display_name: string }[]).map((r) => ({ id: r.id, name: r.display_name }))
}

/** Accepts a request, or turns it down by deleting it. */
export async function answerFriendRequest(id: string, accept: boolean): Promise<boolean> {
  if (!supabase) return false
  const { error } = accept
    ? await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)
    : await supabase.from('friendships').delete().eq('id', id)
  if (error) console.error('Could not answer the friend request:', error.message)
  return !error
}
