// Testing the Symbol Recall game screen
import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MISTAKE_PENALTY_SECONDS, symbolsPoints } from '../../lib/scoring.ts'
import { createGuestState } from '../../state/store.ts'
import { TODAY } from '../../test/fixtures.ts'
import { renderWithApp } from '../../test/render.tsx'
import { createRounds, isOdd, QUESTION_COUNT, SYMBOLS, type Round } from './rounds.ts'
import SymbolsGame, { STUDY_MS_PER_PAIR } from './SymbolsGame.tsx'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

/** Moves on from studying and answers the odd-or-even questions correctly. */
function getToRecall(round: Round) {
  click('I’ve got them')
  for (const n of round.distractors) click(isOdd(n) ? /^Odd/ : /^Even/)
}

/** Picks a number, then lets the right/wrong mark finish. */
function recall(n: number) {
  click(String(n))
  act(() => vi.advanceTimersByTime(1000))
}

const wrongNumber = (n: number) => (n === 9 ? 1 : n + 1)

describe('SymbolsGame', () => {
  // TODAY is before Symbol Recall joined the daily games, so a guest gets the practice seed for 0 games played.
  const rounds = createRounds(`symbols:${TODAY}:0`)
  const start = () => renderWithApp(<SymbolsGame />, { state: createGuestState(TODAY), route: '/play/symbols' })

  it('shows the first three pairs to study', () => {
    start()
    const pairs = within(screen.getByRole('list', { name: 'Pairs to remember' })).getAllByRole('listitem')
    expect(pairs).toHaveLength(3)
    rounds[0].pairs.forEach((p, i) => {
      expect(within(pairs[i]).getByRole('img', { name: SYMBOLS[p.symbol] })).toBeInTheDocument()
      expect(pairs[i]).toHaveTextContent(String(p.number))
    })
    expect(screen.getByText('Round 1 of 4 · 3 pairs')).toBeInTheDocument()
    expect(screen.getByText('Practice · Symbol Recall')).toBeInTheDocument()
  })

  it('hides the pairs behind an odd-or-even task, then asks for each symbol', () => {
    start()
    click('I’ve got them')
    expect(screen.queryByRole('list', { name: 'Pairs to remember' })).not.toBeInTheDocument()
    expect(screen.getByTestId('symbols-distractor')).toHaveTextContent(String(rounds[0].distractors[0]))

    for (const n of rounds[0].distractors) click(isOdd(n) ? /^Odd/ : /^Even/)
    expect(screen.getByText('Which number went with this symbol?')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: SYMBOLS[rounds[0].questions[0].symbol] })).toBeInTheDocument()
  })

  it('moves on from studying by itself once the time is up', () => {
    start()
    act(() => vi.advanceTimersByTime(3 * STUDY_MS_PER_PAIR))
    expect(screen.getByTestId('symbols-distractor')).toBeInTheDocument()
  })

  it('marks a right and a wrong number, with a time penalty for the wrong one', () => {
    start()
    getToRecall(rounds[0])
    const [first, second] = rounds[0].questions

    click(String(first.number))
    expect(screen.getByRole('status')).toHaveTextContent('✓ Correct')
    act(() => vi.advanceTimersByTime(1000))

    click(String(wrongNumber(second.number)))
    expect(screen.getByRole('status')).toHaveTextContent(`✗ It was ${second.number}`)
    expect(screen.getByRole('timer')).toHaveTextContent(`+${MISTAKE_PENALTY_SECONDS}s`)
  })

  it('takes the number keys during recall', () => {
    start()
    getToRecall(rounds[0])
    fireEvent.keyDown(window, { key: String(rounds[0].questions[0].number) })
    expect(screen.getByRole('status')).toHaveTextContent('✓ Correct')
  })

  it('adds a pair for the next round', () => {
    start()
    getToRecall(rounds[0])
    for (const q of rounds[0].questions) recall(q.number)
    expect(screen.getByText('Round 2 of 4 · 4 pairs')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Pairs to remember' })).getAllByRole('listitem')).toHaveLength(4)
  })

  it('saves accuracy, response time and points once every symbol is answered', () => {
    const { actions } = start()
    let asked = 0
    for (const round of rounds) {
      getToRecall(round)
      for (const q of round.questions) recall(asked++ === 4 ? wrongNumber(q.number) : q.number)
    }

    expect(actions.recordResult).toHaveBeenCalledTimes(1)
    const result = vi.mocked(actions.recordResult).mock.calls[0][0]
    expect(result).toMatchObject({ gameId: 'symbols', highlight: `${QUESTION_COUNT - 1}/${QUESTION_COUNT}` })
    expect(result.stats[0]).toBe(`${QUESTION_COUNT - 1} of ${QUESTION_COUNT} remembered`)
    expect(result.stats[1]).toMatch(/^\d+\.\d\ds per answer$/)
    expect(result.stats).toContain('1 wrong answer')
    expect(result.details).toMatchObject({ correct: QUESTION_COUNT - 1, wrong: 1, rounds: 4, maxPairs: 6, oddEvenRight: 12 })
    expect(result.details?.avgResponseMs).toBeGreaterThanOrEqual(0)
    // durationSec includes the penalty; symbolsPoints adds it itself.
    const clockSeconds = result.durationSec - MISTAKE_PENALTY_SECONDS
    expect(result.points).toBe(symbolsPoints({ seconds: clockSeconds, wrongAnswers: 1 }))
  })
})
