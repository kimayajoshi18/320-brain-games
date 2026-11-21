import { createRandom } from '../../lib/random.ts'

// Color & Word (the Stroop test): a color name is shown in some ink color, and the player
// picks the ink color, not the word.

export const INKS = ['red', 'blue', 'green', 'yellow'] as const
export type Ink = (typeof INKS)[number]

export interface Round {
  /** The color name that is written, e.g. "red" shows as RED. */
  word: Ink
  /** The color the word is drawn in. This is always the right answer. */
  ink: Ink
}

/** How many of each block of rounds have a word that doesn't match its ink. Rises through the game. */
export const MISMATCHES_PER_BLOCK = [2, 3, 4, 4]
export const BLOCK_SIZE = 5
export const ROUND_COUNT = MISMATCHES_PER_BLOCK.length * BLOCK_SIZE

export const isMatch = (round: Round) => round.word === round.ink

/**
 * The rounds for one game. Every block of five mixes matching and mismatched rounds, with more
 * mismatches in later blocks, so the game starts easy and gets harder. The same word in the
 * same ink never comes up twice in a row, so each new round is visibly new.
 */
export function createRounds(seed: string): Round[] {
  const rand = createRandom(seed)
  const rounds: Round[] = []
  for (const mismatches of MISMATCHES_PER_BLOCK) {
    const kinds = rand.shuffle(Array.from({ length: BLOCK_SIZE }, (_, i) => i < mismatches))
    for (const mismatch of kinds) {
      const prev = rounds.at(-1)
      let round: Round
      do {
        const ink = rand.pick(INKS)
        const word = mismatch ? rand.pick(INKS.filter((c) => c !== ink)) : ink
        round = { word, ink }
      } while (prev && prev.word === round.word && prev.ink === round.ink)
      rounds.push(round)
    }
  }
  return rounds
}

export interface Answer {
  correct: boolean
  /** Milliseconds from the word appearing to the tap. */
  ms: number
}

export interface Summary {
  correct: number
  wrong: number
  /** Mean response time in milliseconds, 0 when nothing was answered. */
  averageMs: number
}

export function summarize(answers: Answer[]): Summary {
  const correct = answers.filter((a) => a.correct).length
  const totalMs = answers.reduce((sum, a) => sum + a.ms, 0)
  return {
    correct,
    wrong: answers.length - correct,
    averageMs: answers.length ? Math.round(totalMs / answers.length) : 0,
  }
}
