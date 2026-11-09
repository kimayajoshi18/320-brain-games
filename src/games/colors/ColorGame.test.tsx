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
})
