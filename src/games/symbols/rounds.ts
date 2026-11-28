import { createRandom } from '../../lib/random.ts'

// Symbol Recall: memorize a few symbol–number pairs, answer a short odd-or-even task so they
// can't be rehearsed, then say which number went with each symbol.

/** The symbols a round can use, with the names a screen reader says for them. */
export const SYMBOLS = {
  '★': 'star',
  '●': 'circle',
  '▲': 'triangle',
  '■': 'square',
  '◆': 'diamond',
  '♥': 'heart',
  '♣': 'club',
  '♠': 'spade',
  '☀': 'sun',
  '☂': 'umbrella',
  '♪': 'note',
  '✿': 'flower',
} as const
export type Glyph = keyof typeof SYMBOLS
const GLYPHS = Object.keys(SYMBOLS) as Glyph[]

/** The numbers a symbol can stand for. */
export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/** Pairs to memorize in each round: start with 3 and add one each round. */
export const PAIRS_PER_ROUND = [3, 4, 5, 6]
export const QUESTION_COUNT = PAIRS_PER_ROUND.reduce((sum, n) => sum + n, 0)
/** Odd-or-even questions between studying and recalling. */
export const DISTRACTORS_PER_ROUND = 3

export interface Pair {
  symbol: Glyph
  number: number
}

export interface Round {
  /** The pairs to study, in the order they are shown. */
  pairs: Pair[]
  /** Two-digit numbers for the odd-or-even task. */
  distractors: number[]
  /** The same pairs in the order they are asked. */
  questions: Pair[]
}

export const isOdd = (n: number) => n % 2 === 1

/**
 * The rounds for one game. Each round draws different symbols and different numbers, so no two
 * symbols in a round share a number, and asks them back in a new order.
 */
export function createRounds(seed: string): Round[] {
  const rand = createRandom(seed)
  return PAIRS_PER_ROUND.map((count) => {
    const symbols = rand.shuffle(GLYPHS).slice(0, count)
    const numbers = rand.shuffle(DIGITS).slice(0, count)
    const pairs = symbols.map((symbol, i) => ({ symbol, number: numbers[i] }))
    return {
      pairs,
      distractors: Array.from({ length: DISTRACTORS_PER_ROUND }, () => rand.int(10, 99)),
      questions: rand.shuffle(pairs),
    }
  })
}

export interface Answer {
  correct: boolean
  /** Milliseconds from the symbol appearing to the answer. */
  ms: number
}

export interface Summary {
  correct: number
  wrong: number
  /** Mean response time in milliseconds, 0 when nothing was answered. */
  averageMs: number
  /** Total time spent answering, in seconds. */
  seconds: number
}

export function summarize(answers: Answer[]): Summary {
  const correct = answers.filter((a) => a.correct).length
  const totalMs = answers.reduce((sum, a) => sum + a.ms, 0)
  return {
    correct,
    wrong: answers.length - correct,
    averageMs: answers.length ? Math.round(totalMs / answers.length) : 0,
    seconds: totalMs / 1000,
  }
}
