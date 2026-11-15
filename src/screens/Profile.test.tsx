// Testing the profile screen: player card, account settings and high scores
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { createGuestState, recordResult } from '../state/store.ts'
import type { AppState } from '../state/types.ts'
import { makeResult, signedInState, TODAY } from '../test/fixtures.ts'
import { renderWithApp } from '../test/render.tsx'
import Profile from './Profile.tsx'

function renderProfile(state: AppState) {
  return renderWithApp(
    <Routes>
      <Route path="/profile" element={<Profile />} />
      <Route path="/" element={<p>Landing screen</p>} />
    </Routes>,
    { state, route: '/profile' },
  )
}

describe('Profile as a guest', () => {
  it('shows a guest card and offers sign-in', async () => {
    const user = userEvent.setup()
    const { actions } = renderProfile(createGuestState(TODAY))

    expect(screen.getByRole('heading', { level: 1, name: 'Guest' })).toBeInTheDocument()
    expect(screen.getByText("Playing as a guest. Progress isn't saved.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(actions.signIn).toHaveBeenCalledOnce()
  })

  it('shows a dash for games with no high score', () => {
    renderProfile(recordResult(createGuestState(TODAY), makeResult('colors', 930)))

    const scores = screen.getAllByRole('definition').map((dd) => dd.textContent)
    expect(scores).toEqual(['–', '–', '930'])
  })
})

describe('Profile high scores', () => {
  it('shows points for every game, not the result text', () => {
    let state = createGuestState(TODAY)
    state = recordResult(state, makeResult('colors', 1240, { highlight: '5/5' }))
    state = recordResult(state, makeResult('numbers', 980, { highlight: '2:04' }))
    state = recordResult(state, makeResult('memory', 1100, { highlight: '1,100' }))
    renderProfile(state)

    const scores = screen.getAllByRole('definition').map((dd) => dd.textContent)
    expect(scores).toEqual(['1,100', '980', '1,240'])
  })
})

describe('Profile when signed in', () => {
  it("shows the player's name, initials and best streak", () => {
    renderProfile({ ...signedInState(), bestStreak: 4 })

    expect(screen.getByRole('heading', { level: 1, name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getByText('AL')).toBeInTheDocument()
    expect(screen.getByText(/Best streak/)).toHaveTextContent('4 days')
  })

  it('changes and turns off the daily reminder', async () => {
    const user = userEvent.setup()
    const { actions } = renderProfile(signedInState())
    const reminder = screen.getByRole('combobox', { name: /Reminder/ })

    expect(reminder).toHaveValue('8:00am')
    await user.selectOptions(reminder, '7:00pm')
    expect(actions.updateProfile).toHaveBeenLastCalledWith({ reminder: '7:00pm' })

    await user.selectOptions(reminder, 'Off')
    expect(actions.updateProfile).toHaveBeenLastCalledWith({ reminder: null })
  })

  it('signs out and returns to the landing page', async () => {
    const user = userEvent.setup()
    const { actions } = renderProfile(signedInState())

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(actions.signOut).toHaveBeenCalledOnce()
    expect(screen.getByText('Landing screen')).toBeInTheDocument()
  })
})