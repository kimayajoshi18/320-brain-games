import { GAMES, GAME_IDS } from '../data/games.ts'
import type { AppState } from './types.ts'

export interface StreakReward {
  day: number
  tier: string
}

/** Streak rewards sit on the path at these days. */
export const STREAK_REWARDS: StreakReward[] = [
  { day: 3, tier: 'bronze' },
  { day: 7, tier: 'silver' },
  { day: 14, tier: 'gold' },
  { day: 30, tier: 'platinum' },
]

export type StepStatus = 'done' | 'today' | 'locked'

export interface PathStep {
  day: number
  status: StepStatus
  reward: StreakReward | null
  label: string
  /** Shorter label for narrow screens. */
  shortLabel: string
}

export interface LearningPath {
  /** Days finished before the first step shown, collapsed into one line. */
  hiddenDone: number
  steps: PathStep[]
  /** The day being worked on now (finished today counts as still "today"). */
  currentDay: number
  todayDone: boolean
  nextReward: StreakReward | null
  /** Days finished so far, for progress toward `nextReward`. */
  progress: number
}

const STEPS_BEFORE_TODAY = 4
const STEPS_AFTER_TODAY = 3
const MIN_STEPS = 8

/** Each finished daily three moves the player one step along the path. */
export function buildPath(state: AppState): LearningPath {
  const finished = state.completedDays.length
  const todayDone = state.completedDays.includes(state.today)
  const currentDay = todayDone ? finished : finished + 1
  const nextReward = STREAK_REWARDS.find((r) => r.day > finished) ?? null

  const first = Math.max(1, currentDay - STEPS_BEFORE_TODAY)
  const last = Math.max(currentDay + STEPS_AFTER_TODAY, first + MIN_STEPS - 1, nextReward?.day ?? 0)

  // Non-reward days are labelled with a featured game, cycling through all three.
  let gameIndex = 0
  const steps: PathStep[] = []
  for (let day = 1; day <= last; day++) {
    const reward = STREAK_REWARDS.find((r) => r.day === day) ?? null
    const status: StepStatus = day < currentDay || (day === currentDay && todayDone) ? 'done' : day === currentDay ? 'today' : 'locked'
    let label: string
    let shortLabel: string
    if (reward) {
      label = `${reward.day}-day streak · ${reward.tier}`
      shortLabel = `${reward.day}-day · ${reward.tier}`
    } else {
      const game = GAMES[GAME_IDS[gameIndex++ % GAME_IDS.length]]
      label = status === 'today' ? `Day ${day} · Today’s three` : status === 'done' ? `Day ${day} · ${game.name}` : `Day ${day}`
      shortLabel = label
    }
    if (day >= first) steps.push({ day, status, reward, label, shortLabel })
  }

  return { hiddenDone: first - 1, steps, currentDay, todayDone, nextReward, progress: finished }
}
