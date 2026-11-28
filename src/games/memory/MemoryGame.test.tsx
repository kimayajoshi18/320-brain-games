// Testing the Memory Match game screen
import { act, fireEvent, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryPoints, unfinishedPoints } from '../../lib/scoring.ts'
import { createGuestState } from '../../state/store.ts'
import { TODAY } from '../../test/fixtures.ts'
import { renderWithApp } from '../../test/render.tsx'
import { createDeck, deckSeed, LAST_ROUND, TIME_LIMIT, TOTAL_PAIRS, type Card } from './deck.ts'
import MemoryGame, { MISMATCH_MS, ROUND_PAUSE_MS } from './MemoryGame.tsx'

// A fresh guest has played no games, so the decks can be rebuilt from the seed.
const deckFor = (round: number) => createDeck(round, deckSeed(TODAY, 0, round))

function start() {
  return renderWithApp(
    <Routes>
      <Route path="/play/memory" element={<MemoryGame />} />
      <Route path="/results" element={<p>Results screen</p>} />
    </Routes>,
    { state: createGuestState(TODAY), route: '/play/memory' },
  )
}

const cards = () => within(screen.getByRole('grid', { name: 'Memory card grid' })).getAllByRole('button')
const flip = (index: number) => fireEvent.click(cards()[index])

/** Index pairs of matching cards in a deck. */
function pairsIn(deck: Card[]): [number, number][] {
  const bySymbol = new Map<string, number[]>()
  deck.forEach((card, i) => bySymbol.set(card.symbol, [...(bySymbol.get(card.symbol) ?? []), i]))
  return [...bySymbol.values()].map(([a, b]) => [a, b])
}

/** Two cards that don't match. */
function mismatchIn(deck: Card[]): [number, number] {
  const second = deck.findIndex((c) => c.symbol !== deck[0].symbol)
  return [0, second]
}

/** Matches every pair in the round, then waits out the "Round complete" pause. */
function clearRound(round: number) {
  for (const [a, b] of pairsIn(deckFor(round))) {
    flip(a)
    flip(b)
  }
  act(() => vi.advanceTimersByTime(ROUND_PAUSE_MS))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('MemoryGame', () => {
  it('starts on round 1 with four face-down cards', () => {
    start()
    expect(cards()).toHaveLength(4)
    for (const card of cards()) expect(card).toHaveAccessibleName('Face-down card')
    expect(screen.getByText(`Round 1 of ${LAST_ROUND}`)).toBeInTheDocument()
    expect(screen.getByText('0 moves')).toBeInTheDocument()
    expect(screen.getByText('0/2 matched')).toBeInTheDocument()
  })

  it('keeps a matching pair face up and counts the move', () => {
    start()
    const deck = deckFor(1)
    const [a, b] = pairsIn(deck)[0]
    flip(a)
    expect(cards()[a]).toHaveAccessibleName(`Card: ${deck[a].symbol}`)
    flip(b)

    expect(cards()[a]).toBeDisabled()
    expect(cards()[b]).toBeDisabled()
    expect(cards()[b]).toHaveAccessibleName(`Card: ${deck[b].symbol}`)
    expect(screen.getByText('1 move')).toBeInTheDocument()
    expect(screen.getByText('1/2 matched')).toBeInTheDocument()
  })

  it('turns a pair that does not match back over, and ignores taps until then', () => {
    start()
    const deck = deckFor(1)
    const [a, b] = mismatchIn(deck)
    flip(a)
    flip(b)
    expect(cards()[b]).toHaveAccessibleName(`Card: ${deck[b].symbol}`)

    // A third card can't be turned while the two are showing.
    const other = deck.findIndex((_, i) => i !== a && i !== b)
    flip(other)
    expect(cards()[other]).toHaveAccessibleName('Face-down card')

    act(() => vi.advanceTimersByTime(MISMATCH_MS))
    expect(cards()[a]).toHaveAccessibleName('Face-down card')
    expect(cards()[b]).toHaveAccessibleName('Face-down card')
    expect(screen.getByText('1 move')).toBeInTheDocument()
    expect(screen.getByText('0/2 matched')).toBeInTheDocument()
  })

  it('does not count tapping the same card twice as a move', () => {
    start()
    flip(0)
    flip(0)
    expect(screen.getByText('0 moves')).toBeInTheDocument()
    expect(cards()[0]).not.toHaveAccessibleName('Face-down card')
  })

  it('moves on to a bigger board after a round is cleared', () => {
    start()
    const [[a, b], [c, d]] = pairsIn(deckFor(1))
    flip(a)
    flip(b)
    flip(c)
    flip(d)
    expect(screen.getByRole('status')).toHaveTextContent('Round Complete!')
    expect(screen.getByRole('status')).toHaveTextContent('Starting round 2...')

    act(() => vi.advanceTimersByTime(ROUND_PAUSE_MS))
    expect(cards()).toHaveLength(6)
    expect(screen.getByText(`Round 2 of ${LAST_ROUND}`)).toBeInTheDocument()
    expect(screen.getByText('0 moves')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('saves the score, moves and misses after the last round and shows the results', () => {
    const { actions } = start()
    const [a, b] = mismatchIn(deckFor(1))
    flip(a)
    flip(b)
    act(() => vi.advanceTimersByTime(MISMATCH_MS))
    for (let round = 1; round < LAST_ROUND; round++) clearRound(round)

    // Clearing the last round says so instead of announcing a round 6.
    for (const [x, y] of pairsIn(deckFor(LAST_ROUND))) {
      flip(x)
      flip(y)
    }
    expect(screen.getByRole('status')).toHaveTextContent('All rounds cleared!')
    expect(actions.recordResult).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(ROUND_PAUSE_MS))
    expect(actions.recordResult).toHaveBeenCalledTimes(1)
    const result = vi.mocked(actions.recordResult).mock.calls[0][0]
    expect(result).toMatchObject({
      gameId: 'memory',
      highlight: `Round ${LAST_ROUND}`,
      playedAt: TODAY,
      details: { moves: TOTAL_PAIRS + 1, wrongPairs: 1, pairs: TOTAL_PAIRS, rounds: LAST_ROUND },
    })
    expect(result.stats).toEqual(expect.arrayContaining(['All rounds cleared', `${TOTAL_PAIRS + 1} moves`, '1 missed pair']))
    expect(result.points).toBe(memoryPoints({ seconds: result.durationSec, wrongPairs: 1 }))
    expect(screen.getByText('Results screen')).toBeInTheDocument()
  })

  it('ends the game when time runs out and scores the pairs found so far', () => {
    const { actions } = start()
    clearRound(1)
    act(() => vi.advanceTimersByTime(TIME_LIMIT * 1000))

    expect(actions.recordResult).toHaveBeenCalledTimes(1)
    const result = vi.mocked(actions.recordResult).mock.calls[0][0]
    expect(result).toMatchObject({
      gameId: 'memory',
      durationSec: TIME_LIMIT,
      highlight: 'Round 2',
      details: { moves: 2, wrongPairs: 0, pairs: 2, rounds: 1 },
    })
    expect(result.stats).toContain('Reached round 2')
    expect(result.points).toBe(unfinishedPoints(2 / TOTAL_PAIRS))
    expect(screen.getByText('Results screen')).toBeInTheDocument()

    // The clock stops: nothing more is saved.
    act(() => vi.advanceTimersByTime(10_000))
    expect(actions.recordResult).toHaveBeenCalledTimes(1)
  })

  it('restarts from round 1 with the count reset', () => {
    start()
    clearRound(1)
    flip(0)
    expect(screen.getByText(`Round 2 of ${LAST_ROUND}`)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Restart Game' }))
    expect(cards()).toHaveLength(4)
    expect(screen.getByText(`Round 1 of ${LAST_ROUND}`)).toBeInTheDocument()
    expect(screen.getByText('0 moves')).toBeInTheDocument()
    for (const card of cards()) expect(card).toHaveAccessibleName('Face-down card')
  })
})
