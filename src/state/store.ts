import { GAME_IDS, type GameId } from '../data/games.ts'
import { addDays, weekdayIndex, type DayKey } from '../lib/date.ts'
import type { AppState, GameResult, Onboarding, Profile } from './types.ts'

export const STREAK_REWARDS: { day: number; tier: string }[] = [
  { day: 3, tier: 'bronze' },
  { day: 7, tier: 'silver' },
  { day: 14, tier: 'gold' },
  { day: 30, tier: 'platinum' },
]

export function createGuestState(today: DayKey): AppState {
  return {
    account: { kind: 'guest' },
    onboarding: { complete: false, focus: [], when: null },
    today,
    todayResults: {},
    completedDays: [],
    bestStreak: 0,
    topScores: { memory: [], numbers: [], colors: [] },
    gamesPlayed: 0,
    lastResult: null,
  }
}

/** Moves the state onto a new calendar day, clearing yesterday's three. */
export function rollToDay(state: AppState, today: DayKey): AppState {
  if (state.today === today) return state
  return { ...state, today, todayResults: {} }
}

export function recordResult(state: AppState, result: GameResult): AppState {
  const daily = !state.todayResults[result.gameId]
  const previous = state.topScores[result.gameId]
  const newBest = previous.length > 0 && result.points > previous[0].points
  const topScores = {
    ...state.topScores,
    [result.gameId]: [...previous, result].sort((a, b) => b.points - a.points).slice(0, 3),
  }

  let { todayResults, completedDays, bestStreak } = state
  if (daily) {
    todayResults = { ...todayResults, [result.gameId]: result }
    const allDone = GAME_IDS.every((id) => todayResults[id])
    if (allDone && !completedDays.includes(state.today)) {
      completedDays = [...completedDays, state.today]
      bestStreak = Math.max(bestStreak, streakEndingAt(completedDays, state.today))
    }
  }

  return {
    ...state,
    todayResults,
    completedDays,
    bestStreak,
    topScores,
    gamesPlayed: state.gamesPlayed + 1,
    lastResult: { result, newBest, daily },
  }
}

export function completeOnboarding(state: AppState, answers: Omit<Onboarding, 'complete'>): AppState {
  return { ...state, onboarding: { ...answers, complete: true } }
}

export function updateProfile(state: AppState, changes: Partial<Profile>): AppState {
  if (state.account.kind !== 'google') return state
  return { ...state, account: { kind: 'google', profile: { ...state.account.profile, ...changes } } }
}

/**
 * Signs a guest in to an account, carrying over anything they did as a guest
 * so a first game isn't lost when they decide to keep their progress.
 */
export function mergeGuestIntoAccount(account: AppState, guest: AppState): AppState {
  let merged = rollToDay(account, guest.today)
  // Answers the guest just gave are newer than whatever the account has.
  if (guest.onboarding.complete) merged = { ...merged, onboarding: guest.onboarding }
  for (const id of GAME_IDS) {
    const result = guest.todayResults[id]
    if (result) merged = recordResult(merged, result)
  }
  return { ...merged, lastResult: guest.lastResult ?? merged.lastResult }
}

// ---------- Selectors ----------

function streakEndingAt(days: DayKey[], end: DayKey): number {
  const set = new Set(days)
  let count = 0
  for (let day = end; set.has(day); day = addDays(day, -1)) count++
  return count
}

/** Consecutive completed days up to today (or yesterday, if today isn't finished yet). */
export function currentStreak(state: AppState): number {
  const set = new Set(state.completedDays)
  const end = set.has(state.today) ? state.today : addDays(state.today, -1)
  return streakEndingAt(state.completedDays, end)
}

/** Today's three in play order: the player's focus areas first, then the rest. */
export function dailyOrder(state: AppState): GameId[] {
  const focus = GAME_IDS.filter((id) => state.onboarding.focus.includes(id))
  return [...focus, ...GAME_IDS.filter((id) => !focus.includes(id))]
}

export function nextDailyGame(state: AppState): GameId | null {
  return dailyOrder(state).find((id) => !state.todayResults[id]) ?? null
}

export function dailyDoneCount(state: AppState): number {
  return GAME_IDS.filter((id) => state.todayResults[id]).length
}

/** Monday-to-Sunday cells for the current week; true when that day's three were finished. */
export function weekCells(state: AppState): boolean[] {
  const monday = addDays(state.today, -weekdayIndex(state.today))
  const set = new Set(state.completedDays)
  return Array.from({ length: 7 }, (_, i) => set.has(addDays(monday, i)))
}

export function bestResult(state: AppState, gameId: GameId): GameResult | undefined {
  return state.topScores[gameId][0]
}

/** Highest points across all games, optionally only counting plays on or after `since`. */
export function bestPoints(state: AppState, since?: DayKey): number {
  const all = GAME_IDS.flatMap((id) => state.topScores[id])
  return all.filter((r) => !since || r.playedAt >= since).reduce((max, r) => Math.max(max, r.points), 0)
}

export function nextReward(state: AppState): { day: number; tier: string } | undefined {
  const streak = currentStreak(state)
  return STREAK_REWARDS.find((r) => r.day > streak)
}
