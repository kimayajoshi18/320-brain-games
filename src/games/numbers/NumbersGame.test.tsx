// Testing the Number Grid game screen
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createGuestState } from '../../state/store.ts'
import { TODAY } from '../../test/fixtures.ts'
import { numbersPoints } from '../../lib/scoring.ts'
import { renderWithApp } from '../../test/render.tsx'
import NumbersGame from './NumbersGame.tsx'
import { createPuzzle, SIZE } from './puzzle.ts'

// A guest who hasn't played Numbers today gets the daily puzzle, so the test can rebuild it.
const puzzle = createPuzzle(`numbers:${TODAY}`)

const cellName = (i: number) => `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}`
const answer = (i: number) => {
  const cell = puzzle.cells[i]
  return cell.kind === 'number' ? String(cell.answer) : ''
}

function play() {
  return renderWithApp(<NumbersGame />, { state: createGuestState(TODAY), route: '/play/numbers' })
}

describe('NumbersGame', () => {
  it('adds a penalty for a wrong entry and leaves the cell open', async () => {
    const user = userEvent.setup()
    play()
    const [first] = puzzle.blanks
    const cell = screen.getByRole('textbox', { name: cellName(first) })

    await user.type(cell, `${(Number(answer(first)) + 1) % 100}{Enter}`)

    expect(screen.getByText('+3s')).toBeInTheDocument()
    expect(cell).toHaveValue('')
    expect(cell).not.toHaveAttribute('readonly')
  })

  it('saves the round once every blank is solved', async () => {
    const user = userEvent.setup()
    const { actions } = play()

    for (const i of puzzle.blanks) {
      await user.type(screen.getByRole('textbox', { name: cellName(i) }), `${answer(i)}{Enter}`)
    }

    await waitFor(() => expect(actions.recordResult).toHaveBeenCalledOnce())
    expect(actions.recordResult).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 'numbers', hintsUsed: 0, stats: expect.arrayContaining(['4 of 4 solved']) }),
    )
  })

  it('scores the round with its wrong entries and saves them in details', async () => {
    const user = userEvent.setup()
    const { actions } = play()
    const [first] = puzzle.blanks

    await user.type(screen.getByRole('textbox', { name: cellName(first) }), `${(Number(answer(first)) + 1) % 100}{Enter}`)
    for (const i of puzzle.blanks) {
      await user.type(screen.getByRole('textbox', { name: cellName(i) }), `${answer(i)}{Enter}`)
    }

    await waitFor(() => expect(actions.recordResult).toHaveBeenCalledOnce())
    const result = vi.mocked(actions.recordResult).mock.calls[0][0]
    expect(result.details).toEqual({ blanks: 4, wrongEntries: 1, hints: 0 })
    expect(result.stats).toContain('1 wrong entry')
    // The saved time includes the 3-second penalty; the points add it back from the raw time.
    expect(result.points).toBe(numbersPoints({ seconds: result.durationSec - 3, wrongEntries: 1 }))
  })

  it('shows the hint as a whole equation without filling anything in', async () => {
    const user = userEvent.setup()
    play()

    await user.click(screen.getByRole('button', { name: 'Hint' }))

    expect(document.querySelectorAll('.numbers-cell.hinted')).toHaveLength(5)
    for (const i of puzzle.blanks) expect(screen.getByRole('textbox', { name: cellName(i) })).toHaveValue('')
  })
})