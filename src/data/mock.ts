import { addDays, type DayKey } from '../lib/date.ts'
import { formatDuration, formatNumber } from '../lib/format.ts'
import type { AppState, GameResult } from '../state/types.ts'

/**
 * Demo data standing in for a real backend. The Google sign-in is mocked and
 * signs everyone in as "Sam R.", with numbers matching the wireframes.
 */
export function createDemoAccount(today: DayKey): AppState {
  const memory = (points: number, daysAgo: number, moves: number, time: number, accuracy: number): GameResult => ({
    gameId: 'memory',
    points,
    durationSec: time,
    stats: [`${moves} moves`, formatDuration(time), `${accuracy}% accuracy`],
    highlight: formatNumber(points),
    playedAt: addDays(today, -daysAgo),
  })
  const numbers = (points: number, daysAgo: number, time: number): GameResult => ({
    gameId: 'numbers',
    points,
    durationSec: time,
    stats: [formatDuration(time), 'No mistakes'],
    highlight: formatDuration(time),
    playedAt: addDays(today, -daysAgo),
  })
  const colors = (points: number, daysAgo: number, found: number, time: number): GameResult => ({
    gameId: 'colors',
    points,
    durationSec: time,
    stats: [`${found} of 5 found`, formatDuration(time)],
    highlight: `${found}/5`,
    playedAt: addDays(today, -daysAgo),
  })

  const todaysMemory = memory(1240, 0, 14, 52, 86)

  return {
    account: {
      kind: 'google',
      profile: { name: 'Sam R.', recoveryPhone: null, reminder: '8:00am' },
    },
    onboarding: { complete: true, focus: [], when: 'commute' },
    today,
    todayResults: { memory: todaysMemory },
    // A 12-day streak running up to yesterday.
    completedDays: Array.from({ length: 12 }, (_, i) => addDays(today, i - 12)),
    bestStreak: 19,
    topScores: {
      memory: [todaysMemory, memory(1105, 3, 16, 58, 81), memory(980, 9, 19, 59, 74)],
      numbers: [numbers(1150, 2, 124), numbers(1020, 6, 141), numbers(940, 11, 156)],
      colors: [colors(1080, 1, 5, 44), colors(990, 5, 5, 51), colors(760, 8, 4, 60)],
    },
    gamesPlayed: 57,
    lastResult: null,
  }
}

export interface Friend {
  name: string
  week: number
  allTime: number
}

export const FRIENDS: Friend[] = [
  { name: 'Alex', week: 1380, allTime: 1520 },
  { name: 'Priya', week: 1190, allTime: 1640 },
  { name: 'Jordan', week: 960, allTime: 1050 },
  { name: 'Mei', week: 910, allTime: 1200 },
]
