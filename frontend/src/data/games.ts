export type GameId = 'memory' | 'numbers' | 'colors'

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
}

export const GAMES: Record<GameId, GameInfo> = {
  memory: {
    id: 'memory',
    name: 'Memory',
    title: 'Memory Match',
    trains: 'Remembering things',
    why: 'Matching pairs trains short-term memory. (Placeholder: source needed.)',
    playable: false,
  },
  numbers: {
    id: 'numbers',
    name: 'Numbers',
    title: 'Number Grid',
    trains: 'Thinking with numbers',
    why: 'Number puzzles exercise working memory and logical reasoning. (Placeholder: source needed.)',
    playable: false,
  },
  colors: {
    id: 'colors',
    name: 'Colors',
    title: 'Spot The Difference',
    trains: 'Noticing details',
    why: 'Spotting differences trains visual attention and scanning. (Placeholder: source needed.)',
    playable: true,
  },
}

export const GAME_IDS: GameId[] = ['memory', 'numbers', 'colors']

export function isGameId(value: string | undefined): value is GameId {
  return value === 'memory' || value === 'numbers' || value === 'colors'
}
