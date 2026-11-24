import type { DayKey } from '../lib/date.ts'

export type GameId = 'memory' | 'numbers' | 'colors' | 'colorword'

export interface GameInfo {
  id: GameId
  /** Short name used on tiles, chips and tables: "Memory". */
  name: string
  /** Full title shown while playing: "Spot The Difference". */
  title: string
  /** What the game trains, used in onboarding. */
  trains: string
  /** "Why this helps" blurb on the results screen. */
  why: string
  /** Whether the game has a real implementation yet (only Colors is designed). */
  playable: boolean
  /**
   * First day the game is part of the daily set. Days before it were complete without it, so
   * adding a game doesn't break anyone's streak. Must match games.daily_from in the database.
   */
  dailyFrom?: DayKey
}

/** The day Color & Word joined the daily games (supabase/color_word.sql uses the same date). */
export const COLORWORD_DAILY_FROM: DayKey = '2026-11-21'

export const GAMES: Record<GameId, GameInfo> = {
  memory: {
    id: 'memory',
    name: 'Memory',
    title: 'Memory Match',
    trains: 'Remembering things',
    why: 'Matching pairs trains short-term memory. (Placeholder: source needed.)',
    playable: true,
  },
  numbers: {
    id: 'numbers',
    name: 'Numbers',
    title: 'Number Grid',
    trains: 'Thinking with numbers',
    why: 'Number puzzles exercise working memory and logical reasoning. (Placeholder: source needed.)',
    playable: true,
  },
  colors: {
    id: 'colors',
    name: 'Colors',
    title: 'Spot The Difference',
    trains: 'Noticing details',
    why: 'Practice makes visual search faster. In a five-day study, people got quicker at spotting a target, and brain recordings showed they were directing their attention to it sooner and more strongly. (Clark et al., 2015, Journal of Neuroscience)',
    playable: true,
  },
  colorword: {
    id: 'colorword',
    name: 'Color Word',
    title: 'Color & Word',
    trains: 'Staying focused',
    why: 'Naming the ink color while ignoring the word means holding back the habit of reading. That slowdown on mismatched words is the Stroop effect, one of the most studied results in attention research. (Stroop, 1935, Journal of Experimental Psychology; MacLeod, 1991, Psychological Bulletin)',
    playable: true,
    dailyFrom: COLORWORD_DAILY_FROM,
  },
}

export const GAME_IDS: GameId[] = ['memory', 'numbers', 'colors', 'colorword']

/** The games that make up the daily set on `day`. Finishing all of them adds the day to the streak. */
export function dailyGames(day: DayKey): GameId[] {
  return GAME_IDS.filter((id) => {
    const from = GAMES[id].dailyFrom
    return !from || from <= day
  })
}

export function isGameId(value: string | undefined): value is GameId {
  return (GAME_IDS as (string | undefined)[]).includes(value)
}
