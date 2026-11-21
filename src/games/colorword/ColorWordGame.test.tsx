// Testing the Color & Word game screen
import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { colorWordPoints, MISTAKE_PENALTY_SECONDS } from '../../lib/scoring.ts'
import { createGuestState } from '../../state/store.ts'
import { TODAY } from '../../test/fixtures.ts'
import { renderWithApp } from '../../test/render.tsx'
import ColorWordGame from './ColorWordGame.tsx'
import { createRounds, INKS, ROUND_COUNT, type Ink } from './rounds.ts'

const LABEL = (ink: Ink) => ink[0].toUpperCase() + ink.slice(1)
const wrongInk = (ink: Ink) => INKS.find((c) => c !== ink)!

/** Clicks the button for an ink, then lets the right/wrong mark finish. */
function answer(ink: Ink) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${LABEL(ink)}`) }))
  act(() => vi.advanceTimersByTime(1000))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ColorWordGame', () => {
  // A guest who hasn't played today gets the daily words, so the test can rebuild them.
  const rounds = createRounds(`colorword:${TODAY}`)
  const start = () => renderWithApp(<ColorWordGame />, { state: createGuestState(TODAY), route: '/play/colorword' })

  it('shows the word in its ink, four color buttons and the progress', () => {
    start()
    const word = document.querySelector('.colorword-word')!
    expect(word).toHaveTextContent(rounds[0].word.toUpperCase())
    expect(word).toHaveAttribute('data-ink', rounds[0].ink)
    expect(word).toHaveClass(`ink-${rounds[0].ink}`)
    for (const ink of INKS) expect(screen.getByRole('button', { name: new RegExp(`^${LABEL(ink)}`) })).toBeInTheDocument()
    expect(screen.getByText(`Round 1 of ${ROUND_COUNT}`)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('marks the ink color right, not the word', () => {
    start()
    const mismatch = rounds.findIndex((r) => r.word !== r.ink)
    for (let i = 0; i < mismatch; i++) answer(rounds[i].ink)

    // Picking the color the word spells is wrong when the ink differs.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${LABEL(rounds[mismatch].word)}`) }))
    expect(screen.getByRole('status')).toHaveTextContent(`✗ It was ${rounds[mismatch].ink}`)
    expect(screen.getByRole('timer')).toHaveTextContent(`+${MISTAKE_PENALTY_SECONDS}s`)

    act(() => vi.advanceTimersByTime(1000))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${LABEL(rounds[mismatch + 1].ink)}`) }))
    expect(screen.getByRole('status')).toHaveTextContent('✓ Correct')
  })

  it('ignores taps while the last answer is still being shown', () => {
    start()
    answer(rounds[0].ink)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${LABEL(rounds[1].ink)}`) }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${LABEL(wrongInk(rounds[1].ink))}`) }))
    expect(screen.getByRole('status')).toHaveTextContent('✓ Correct')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  })

  it('takes the first letter of a color from the keyboard', () => {
    start()
    fireEvent.keyDown(window, { key: rounds[0].ink[0] })
    expect(screen.getByRole('status')).toHaveTextContent('✓ Correct')
  })

  it('saves accuracy, response time and points once every round is answered', () => {
    const { actions } = start()
    rounds.forEach((round, i) => answer(i === 3 ? wrongInk(round.ink) : round.ink))

    expect(actions.recordResult).toHaveBeenCalledTimes(1)
    const result = vi.mocked(actions.recordResult).mock.calls[0][0]
    expect(result).toMatchObject({ gameId: 'colorword', highlight: `${ROUND_COUNT - 1}/${ROUND_COUNT}` })
    expect(result.stats[0]).toBe(`${ROUND_COUNT - 1} of ${ROUND_COUNT} correct`)
    expect(result.stats[1]).toMatch(/^\d+\.\d\ds per answer$/)
    expect(result.stats).toContain('1 wrong answer')
    expect(result.details).toMatchObject({ correct: ROUND_COUNT - 1, wrong: 1, rounds: ROUND_COUNT })
    expect(result.details?.avgResponseMs).toBeGreaterThanOrEqual(0)
    // durationSec includes the penalty; colorWordPoints adds it itself.
    const clockSeconds = result.durationSec - MISTAKE_PENALTY_SECONDS
    expect(result.points).toBe(colorWordPoints({ seconds: clockSeconds, wrongAnswers: 1 }))
  })
})
