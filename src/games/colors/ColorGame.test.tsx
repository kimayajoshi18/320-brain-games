// Testing the Spot The Difference game screen
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithApp } from '../../test/render.tsx'
import ColorGame from './ColorGame.tsx'

describe('ColorGame', () => {
  it('charges points for a hint instead of adding time', async () => {
    const user = userEvent.setup()
    renderWithApp(<ColorGame />, { route: '/play/colors' })

    await user.click(screen.getByRole('button', { name: 'Hint' }))

    expect(screen.getByText('−100 pts')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName('Time 0:00')
  })

  it('shows the hint as an area on both scenes, not a mark on the exact shape', async () => {
    const user = userEvent.setup()
    renderWithApp(<ColorGame />, { route: '/play/colors' })

    await user.click(screen.getByRole('button', { name: 'Hint' }))

    const hints = document.querySelectorAll('.scene-hint')
    expect(hints).toHaveLength(2)
    for (const hint of hints) {
      expect(hint.tagName).toBe('rect')
      expect(hint).toHaveAttribute('width', '200')
      expect(hint).toHaveAttribute('height', '150')
    }
  })
})
