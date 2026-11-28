// Testing the Symbol Recall round generator
import { describe, expect, it } from 'vitest'
import {
  createRounds,
  DIGITS,
  DISTRACTORS_PER_ROUND,
  isOdd,
  PAIRS_PER_ROUND,
  QUESTION_COUNT,
  summarize,
  SYMBOLS,
} from './rounds.ts'

describe('createRounds', () => {
  const seeds = Array.from({ length: 50 }, (_, i) => `symbols:test:${i}`)

  it('builds the same rounds from the same seed, and different ones from another seed', () => {
    expect(createRounds('a')).toEqual(createRounds('a'))
    expect(createRounds('a')).not.toEqual(createRounds('b'))
  })

  it('starts with 3 pairs and adds one each round', () => {
    expect(PAIRS_PER_ROUND).toEqual([3, 4, 5, 6])
    expect(QUESTION_COUNT).toBe(18)
    for (const seed of seeds) {
      expect(createRounds(seed).map((r) => r.pairs.length)).toEqual(PAIRS_PER_ROUND)
    }
  })

  it('never gives two symbols in a round the same number, or repeats a symbol', () => {
    for (const seed of seeds) {
      for (const round of createRounds(seed)) {
        expect(new Set(round.pairs.map((p) => p.symbol)).size).toBe(round.pairs.length)
        expect(new Set(round.pairs.map((p) => p.number)).size).toBe(round.pairs.length)
        for (const p of round.pairs) {
          expect(Object.keys(SYMBOLS)).toContain(p.symbol)
          expect(DIGITS).toContain(p.number)
        }
      }
    }
  })

  it('asks every studied pair exactly once', () => {
    for (const seed of seeds) {
      for (const round of createRounds(seed)) {
        expect([...round.questions].sort((a, b) => a.number - b.number)).toEqual(
          [...round.pairs].sort((a, b) => a.number - b.number),
        )
      }
    }
  })

  it('picks the pairs at random rather than from a fixed list', () => {
    const firstRounds = seeds.map((seed) => JSON.stringify(createRounds(seed)[0].pairs))
    expect(new Set(firstRounds).size).toBeGreaterThan(seeds.length * 0.9)
    const usedSymbols = new Set(seeds.flatMap((seed) => createRounds(seed).flatMap((r) => r.pairs.map((p) => p.symbol))))
    expect(usedSymbols.size).toBe(Object.keys(SYMBOLS).length)
  })

  it('gives each round two-digit odd-or-even numbers, both odd and even', () => {
    const all = seeds.flatMap((seed) => createRounds(seed).flatMap((r) => r.distractors))
    for (const seed of seeds) {
      for (const round of createRounds(seed)) expect(round.distractors).toHaveLength(DISTRACTORS_PER_ROUND)
    }
    expect(all.every((n) => n >= 10 && n <= 99)).toBe(true)
    expect(all.some(isOdd)).toBe(true)
    expect(all.some((n) => !isOdd(n))).toBe(true)
  })
})

describe('summarize', () => {
  it('counts right and wrong answers, averages the response time and adds up the seconds', () => {
    expect(
      summarize([
        { correct: true, ms: 600 },
        { correct: false, ms: 1000 },
        { correct: true, ms: 801 },
      ]),
    ).toEqual({ correct: 2, wrong: 1, averageMs: 800, seconds: 2.401 })
  })

  it('reports zeros with no answers', () => {
    expect(summarize([])).toEqual({ correct: 0, wrong: 0, averageMs: 0, seconds: 0 })
  })
})
