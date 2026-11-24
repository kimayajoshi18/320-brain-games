// Testing the Color & Word round generator
import { describe, expect, it } from 'vitest'
import { BLOCK_SIZE, createRounds, isMatch, MISMATCHES_PER_BLOCK, ROUND_COUNT, summarize } from './rounds.ts'

describe('createRounds', () => {
  const seeds = Array.from({ length: 50 }, (_, i) => `colorword:test:${i}`)

  it('builds the same rounds from the same seed, and different ones from another seed', () => {
    expect(createRounds('a')).toEqual(createRounds('a'))
    expect(createRounds('a')).not.toEqual(createRounds('b'))
  })

  it('mixes matching and mismatched rounds, with more mismatches later on', () => {
    for (const seed of seeds) {
      const rounds = createRounds(seed)
      expect(rounds).toHaveLength(ROUND_COUNT)
      const perBlock = MISMATCHES_PER_BLOCK.map(
        (_, b) => rounds.slice(b * BLOCK_SIZE, (b + 1) * BLOCK_SIZE).filter((r) => !isMatch(r)).length,
      )
      expect(perBlock).toEqual(MISMATCHES_PER_BLOCK)
      expect(rounds.some(isMatch)).toBe(true)
    }
    // Later blocks never have fewer mismatches than earlier ones.
    expect([...MISMATCHES_PER_BLOCK].sort((a, b) => a - b)).toEqual(MISMATCHES_PER_BLOCK)
  })

  it('never repeats the same word in the same ink twice in a row', () => {
    for (const seed of seeds) {
      const rounds = createRounds(seed)
      for (let i = 1; i < rounds.length; i++) {
        expect(rounds[i]).not.toEqual(rounds[i - 1])
      }
    }
  })
})

describe('summarize', () => {
  it('counts right and wrong answers and averages the response time', () => {
    expect(
      summarize([
        { correct: true, ms: 600 },
        { correct: false, ms: 1000 },
        { correct: true, ms: 801 },
      ]),
    ).toEqual({ correct: 2, wrong: 1, averageMs: 800 })
  })

  it('reports zero average time with no answers', () => {
    expect(summarize([])).toEqual({ correct: 0, wrong: 0, averageMs: 0 })
  })
})
