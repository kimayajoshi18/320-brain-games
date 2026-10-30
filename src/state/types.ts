import type { GameId } from '../data/games.ts'
import type { DayKey } from '../lib/date.ts'

export type PlayTime = 'commute' | 'morning' | 'evening' | 'whenever'

export interface GameResult {
  gameId: GameId
  points: number
  durationSec: number
  /** Game-specific stats shown as chips on the results screen, e.g. "14 moves". */
  stats: string[]
  /** How this result reads in the high-score table, e.g. "1,240", "2:04" or "5/5". */
  highlight: string
  playedAt: DayKey
}

export interface Onboarding {
  complete: boolean
  /** Games the player wants to work on; these go first in the daily three. */
  focus: GameId[]
  when: PlayTime | null
  /** Answers to the other survey questions, by question id (see data/survey.ts). */
  answers: Record<string, string>
}

export interface Profile {
  name: string
  recoveryPhone: string | null
  /** Daily reminder time, e.g. "8:00am", or null for none. */
  reminder: string | null
}

export type Account = { kind: 'guest' } | { kind: 'google'; profile: Profile; /** Supabase auth user id. Absent for the demo account. */ userId?: string }

export interface LastResult {
  result: GameResult
  newBest: boolean
  /** True when this play counted toward today's three (first play of the day). */
  daily: boolean
}

export interface AppState {
  account: Account
  onboarding: Onboarding
  /** The calendar day the `todayResults` belong to. */
  today: DayKey
  /** Daily-three results for `today`; only the first play of each game counts. */
  todayResults: Partial<Record<GameId, GameResult>>
  /** Every day the player finished all three games. Drives the streak and learning path. */
  completedDays: DayKey[]
  bestStreak: number
  /** Up to three highest-scoring results per game. */
  topScores: Record<GameId, GameResult[]>
  gamesPlayed: number
  lastResult: LastResult | null
  /** Ids from data/achievements.ts that this signed-in player has earned. */
  earned: string[]
}

/** One row of `game_sessions`, reduced to what the app needs. `playedAt` is the local calendar day. */
export interface RemoteSession {
  gameId: GameId
  points: number
  playedAt: DayKey
}

/** Everything loaded from Supabase for a signed-in player, ready to merge into the app state. */
export interface RemoteSnapshot {
  userId: string
  /** Oldest first. */
  sessions: RemoteSession[]
  completedDays: DayKey[]
  longestStreak: number
  gamesPlayed: number
}

/** What the `profiles` row holds. `extras` is null when the optional columns do not exist yet. */
export interface RemoteProfile {
  displayName: string | null
  ageRange: string | null
  goals: GameId[]
  playTime: PlayTime | null
  extras: { survey: Record<string, string> | null; recoveryPhone: string | null; reminder: string | null } | null
}
