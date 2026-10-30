import { GAME_IDS, type GameId } from '../data/games.ts'
import { addDays, weekdayIndex, type DayKey } from '../lib/date.ts'
import { SURVEY, struggleScore } from '../data/survey.ts'
import { formatNumber } from '../lib/format.ts'
import type { AppState, GameResult, Onboarding, PlayTime, Profile, RemoteProfile, RemoteSnapshot } from './types.ts'

const REMINDERS: Record<PlayTime, string | null> = {
  commute: '8:00am',
  morning: '8:00am',
  evening: '7:00pm',
  whenever: null,
}

/** Default daily reminder for when the player said they usually play. */
export function reminderFor(when: PlayTime): string | null {
  return REMINDERS[when]
}

export function createGuestState(today: DayKey): AppState {
  return {
    account: { kind: 'guest' },
    onboarding: { complete: false, focus: [], when: null, answers: {} },
    today,
    todayResults: {},
    completedDays: [],
    bestStreak: 0,
    topScores: { memory: [], numbers: [], colors: [] },
    gamesPlayed: 0,
    lastResult: null,
    earned: [],
  }
}

/** Fills in fields that states saved by an older version of the app do not have. */
export function withDefaults(state: AppState): AppState {
  return { ...state, onboarding: { ...state.onboarding, answers: state.onboarding.answers ?? {} }, earned: state.earned ?? [] }
}

/** Moves the state onto a new calendar day, clearing yesterday's three. */
export function rollToDay(state: AppState, today: DayKey): AppState {
  if (state.today === today) return state
  return { ...state, today, todayResults: {} }
}

export function recordResult(state: AppState, result: GameResult): AppState {
  const daily = !state.todayResults[result.gameId]
  const previous = state.topScores[result.gameId]
  const newBest = previous.length === 0 || result.points > previous[0].points
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
  const next = { ...state, onboarding: { ...answers, complete: true } }
  return answers.when ? updateProfile(next, { reminder: reminderFor(answers.when) }) : next
}

export function updateProfile(state: AppState, changes: Partial<Profile>): AppState {
  if (state.account.kind !== 'google') return state
  return { ...state, account: { ...state.account, profile: { ...state.account.profile, ...changes } } }
}

/**
 * Signs a guest in to an account, carrying over anything they did as a guest
 * so a first game isn't lost when they decide to keep their progress.
 */
export function mergeGuestIntoAccount(account: AppState, guest: AppState): AppState {
  let merged = rollToDay(account, guest.today)
  // Survey answers the guest just gave are newer than whatever the account has.
  // A guest who skipped the survey doesn't overwrite anything.
  const answers = guest.onboarding
  if (answers.complete && (answers.when !== null || answers.focus.length > 0 || Object.keys(answers.answers).length > 0)) {
    merged = completeOnboarding(merged, { focus: answers.focus, when: answers.when, answers: answers.answers })
  }
  for (const id of GAME_IDS) {
    const result = guest.todayResults[id]
    if (result) merged = recordResult(merged, result)
  }
  return { ...merged, lastResult: guest.lastResult ?? merged.lastResult }
}

/**
 * Rebuilds progress from what Supabase holds. The database has no duration, stats chips or
 * highlight text, so a result that is also in `state` (same game, day and score) keeps the richer
 * local copy, and any other result gets defaults.
 */
export function hydrateFromRemote(state: AppState, remote: RemoteSnapshot): AppState {
  const local = [...GAME_IDS.flatMap((id) => state.topScores[id]), ...Object.values(state.todayResults)]
  const toResult = (s: RemoteSnapshot['sessions'][number]): GameResult =>
    local.find((r) => r.gameId === s.gameId && r.playedAt === s.playedAt && r.points === s.points) ?? {
      gameId: s.gameId,
      points: s.points,
      durationSec: 0,
      stats: [],
      highlight: formatNumber(s.points),
      playedAt: s.playedAt,
    }

  const topScores = { ...state.topScores }
  const todayResults = { ...state.todayResults }
  for (const id of GAME_IDS) {
    const plays = remote.sessions.filter((s) => s.gameId === id)
    topScores[id] = [...plays]
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map(toResult)
    // Only the first play of the day counts toward the daily three.
    const first = plays.find((s) => s.playedAt === state.today)
    if (first) todayResults[id] = toResult(first)
  }

  return {
    ...state,
    topScores,
    todayResults,
    completedDays: remote.completedDays,
    bestStreak: remote.longestStreak,
    gamesPlayed: remote.gamesPlayed,
  }
}

/**
 * Merges the saved profile into the app state. A survey already finished on this device is kept
 * (it is pushed to the profile instead); a new device takes the saved one. The saved name,
 * recovery phone and reminder win when they are set.
 */
export function hydrateProfile(state: AppState, remote: RemoteProfile): AppState {
  let next = state
  if (!state.onboarding.complete && (remote.goals.length > 0 || remote.playTime || remote.extras?.survey)) {
    const answers: Record<string, string> = { ...remote.extras?.survey }
    for (const q of SURVEY) {
      if (q.kind !== 'choice' || !q.column) continue
      const saved = q.column === 'play_time' ? remote.playTime : remote.ageRange
      const match = saved && q.options.find((o) => (o.dbValue !== undefined ? o.dbValue : o.id) === saved)
      if (match) answers[q.id] = match.id
    }
    next = completeOnboarding(next, { focus: remote.goals, when: remote.playTime, answers })
  }
  const changes: Partial<Profile> = {}
  if (remote.displayName) changes.name = remote.displayName
  if (remote.extras?.recoveryPhone) changes.recoveryPhone = remote.extras.recoveryPhone
  if (remote.extras?.reminder) changes.reminder = remote.extras.reminder
  return updateProfile(next, changes)
}

export function addEarned(state: AppState, ids: string[]): AppState {
  const fresh = ids.filter((id) => !state.earned.includes(id))
  return fresh.length > 0 ? { ...state, earned: [...state.earned, ...fresh] } : state
}

/** Days on which every game has at least one play, oldest first. */
export function completedDaysFrom(plays: { gameId: GameId; playedAt: DayKey }[]): DayKey[] {
  const byDay = new Map<DayKey, Set<GameId>>()
  for (const { gameId, playedAt } of plays) byDay.set(playedAt, (byDay.get(playedAt) ?? new Set()).add(gameId))
  return [...byDay].filter(([, games]) => GAME_IDS.every((id) => games.has(id))).map(([day]) => day).sort()
}

/** Longest run of consecutive days in `days`. */
export function longestStreakOf(days: DayKey[]): number {
  return days.reduce((best, day) => Math.max(best, streakEndingAt(days, day)), 0)
}

/** Streak that is still alive on `today`: counts back from today, or from yesterday if today isn't finished. */
export function currentStreakOf(days: DayKey[], today: DayKey): number {
  return streakEndingAt(days, days.includes(today) ? today : addDays(today, -1))
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
  return currentStreakOf(state.completedDays, state.today)
}

/**
 * Today's three in play order: the player's focus areas first, then the rest, with the games the
 * survey answers say they struggle with most coming first. Ties keep the default order.
 */
export function dailyOrder(state: AppState): GameId[] {
  const focus = GAME_IDS.filter((id) => state.onboarding.focus.includes(id))
  const rest = GAME_IDS.filter((id) => !focus.includes(id))
  const answers = state.onboarding.answers
  return [...focus, ...rest.sort((a, b) => struggleScore(answers, b) - struggleScore(answers, a))]
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
