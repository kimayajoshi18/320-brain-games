import { createRandom } from '../../lib/random.ts'

export const SYMBOLS = ['★', '♦', '♣', '♠', '♥', '▲', '●', '■']
/** Seconds before the game ends, finished or not. */
export const TIME_LIMIT = 120
/** Cards in each round; finishing the last one finishes the game. */
export const ROUND_CARDS = [4, 6, 8, 12, 16] as const
export const LAST_ROUND = ROUND_CARDS.length
/** Pairs across every round (2 + 3 + 4 + 6 + 8). */
export const TOTAL_PAIRS = ROUND_CARDS.reduce((sum, cards) => sum + cards / 2, 0)

export interface Card {
  /** Cards that match share a symbol; ids are unique within a round. */
  id: number
  symbol: string
}

export function cardCountForRound(round: number): number {
  return ROUND_CARDS[Math.min(Math.max(round, 1), LAST_ROUND) - 1]
}

export function columnsForCount(count: number): number {
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
}

/** Seed for a round, so the same day and play count always deal the same cards. */
export const deckSeed = (today: string, gamesPlayed: number, round: number) => `memory:${today}:${gamesPlayed}:${round}`

/** A shuffled deck for a round: each symbol appears on exactly two cards. */
export function createDeck(round: number, seed: string): Card[] {
  const pairs = cardCountForRound(round) / 2
  const rand = createRandom(seed)
  const chosen = rand.shuffle(SYMBOLS).slice(0, pairs)
  const cards = chosen.flatMap((symbol, i) => [
    { id: i * 2, symbol },
    { id: i * 2 + 1, symbol },
  ])
  return rand.shuffle(cards)
}
