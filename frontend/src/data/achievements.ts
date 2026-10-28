import { bestResult } from '../state/store.ts'
import type { AppState } from '../state/types.ts'

export interface Achievement {
  id: string
  name: string
  /** How to earn it, shown as a tooltip. */
  how: string
  earned: (state: AppState) => boolean
}

const bestPointsFor = (state: AppState, id: 'memory' | 'numbers' | 'colors') => bestResult(state, id)?.points ?? 0

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'streak-7', name: '7-day streak', how: 'Finish the daily three 7 days in a row', earned: (s) => s.bestStreak >= 7 },
  { id: 'memory-gold', name: 'Memory gold', how: 'Score 1,200 in Memory', earned: (s) => bestPointsFor(s, 'memory') >= 1200 },
  { id: 'games-50', name: '50 games', how: 'Play 50 games', earned: (s) => s.gamesPlayed >= 50 },
  { id: 'numbers-silver', name: 'Number silver', how: 'Score 1,100 in Numbers', earned: (s) => bestPointsFor(s, 'numbers') >= 1100 },
  { id: 'streak-30', name: '30-day streak', how: 'Finish the daily three 30 days in a row', earned: (s) => s.bestStreak >= 30 },
  { id: 'colors-gold', name: 'Colors gold', how: 'Score 1,200 in Colors', earned: (s) => bestPointsFor(s, 'colors') >= 1200 },
]
