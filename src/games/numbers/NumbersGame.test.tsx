// Testing the Number Grid game screen
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createGuestState } from '../../state/store.ts'
import { TODAY } from '../../test/fixtures.ts'
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

  it('shows the hint as a whole equation without filling anything in', async () => {
    const user = userEvent.setup()
    play()

    await user.click(screen.getByRole('button', { name: 'Hint' }))

    expect(document.querySelectorAll('.numbers-cell.hinted')).toHaveLength(5)
    for (const i of puzzle.blanks) expect(screen.getByRole('textbox', { name: cellName(i) })).toHaveValue('')
  })
})