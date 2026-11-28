// Testing how Memory Match deals its cards
import { describe, expect, it } from 'vitest'
import { cardCountForRound, columnsForCount, createDeck, deckSeed, LAST_ROUND, ROUND_CARDS, TOTAL_PAIRS } from './deck.ts'

describe('cardCountForRound', () => {
  it('adds cards each round, up to 16 in the last', () => {
    expect([1, 2, 3, 4, 5].map(cardCountForRound)).toEqual([4, 6, 8, 12, 16])
    expect(LAST_ROUND).toBe(5)
  })

  it('stays in range for rounds outside 1 to 5', () => {
    expect(cardCountForRound(0)).toBe(4)
    expect(cardCountForRound(9)).toBe(16)
  })

  it('has 23 pairs across the whole game', () => {
    expect(TOTAL_PAIRS).toBe(23)
  })
})

describe('columnsForCount', () => {
  it('lays out 2, 3 or 4 columns', () => {
    expect(columnsForCount(4)).toBe(2)
    expect(columnsForCount(6)).toBe(3)
    expect(columnsForCount(8)).toBe(4)
    expect(columnsForCount(16)).toBe(4)
  })
})

describe('createDeck', () => {
  it.each(ROUND_CARDS.map((cards, i) => [i + 1, cards]))('deals round %i as %i cards, every symbol exactly twice', (round, cards) => {
    const deck = createDeck(round, `seed-${round}`)
    expect(deck).toHaveLength(cards)
    expect(new Set(deck.map((c) => c.id)).size).toBe(cards)

    const counts = new Map<string, number>()
    for (const card of deck) counts.set(card.symbol, (counts.get(card.symbol) ?? 0) + 1)
    expect(counts.size).toBe(cards / 2)
    expect([...counts.values()].every((n) => n === 2)).toBe(true)
  })

  it('deals the same cards for the same seed', () => {
    const seed = deckSeed('2026-11-23', 0, 3)
    expect(createDeck(3, seed)).toEqual(createDeck(3, seed))
  })

  it('deals different cards for a different day or play', () => {
    const a = createDeck(5, deckSeed('2026-11-23', 0, 5))
    expect(createDeck(5, deckSeed('2026-11-24', 0, 5))).not.toEqual(a)
    expect(createDeck(5, deckSeed('2026-11-23', 1, 5))).not.toEqual(a)
  })
})
