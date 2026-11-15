// Testing the points shared by all three games
import { describe, expect, it } from 'vitest'
import { colorsPoints, memoryPoints, numbersPoints, penaltySeconds } from './scoring.ts'

describe('penaltySeconds', () => {
  it('adds 3 seconds per mistake and 5 per hint', () => {
    expect(penaltySeconds({})).toBe(0)
    expect(penaltySeconds({ mistakes: 2 })).toBe(6)
    expect(penaltySeconds({ hints: 2 })).toBe(10)
    expect(penaltySeconds({ mistakes: 1, hints: 1 })).toBe(8)
  })
})

describe('colorsPoints', () => {
  it('gives 750 plus 6 points for each second under 90', () => {
    expect(colorsPoints({ seconds: 60 })).toBe(930)
    expect(colorsPoints({ seconds: 90 })).toBe(750)
  })

  it('never goes below 750 for a finished round', () => {
    expect(colorsPoints({ seconds: 300 })).toBe(750)
    expect(colorsPoints({ seconds: 80, wrongTaps: 10, hints: 5 })).toBe(750)
  })

  it('counts a hint as 5 seconds and a wrong tap as 3', () => {
    expect(colorsPoints({ seconds: 60, hints: 1 })).toBe(900)
    expect(colorsPoints({ seconds: 60, wrongTaps: 1 })).toBe(912)
  })
})

describe('memoryPoints and numbersPoints', () => {
  it('use the same scale as colors', () => {
    expect(memoryPoints({ seconds: 60 })).toBe(930)
    expect(numbersPoints({ seconds: 60 })).toBe(930)
  })

  it('charge mistakes and hints the same way', () => {
    expect(memoryPoints({ seconds: 60, wrongPairs: 2, hints: 1 })).toBe(930 - 11 * 6)
    expect(numbersPoints({ seconds: 60, wrongEntries: 2, hints: 1 })).toBe(930 - 11 * 6)
  })
})
