// Testing the results screen shown after a game ends
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { GAME_IDS } from '../data/games.ts'
import { createGuestState, recordResult } from '../state/store.ts'
import type { AppState } from '../state/types.ts'
import { makeResult, signedInState, TODAY } from '../test/fixtures.ts'
import { renderWithApp } from '../test/render.tsx'
import Results from './Results.tsx'

// Results navigates away, so render it inside routes that show where we ended up.
function renderResults(state: AppState) {
  return renderWithApp(
    <Routes>
      <Route path="/results" element={<Results />} />
      <Route path="/home" element={<p>Home screen</p>} />
      <Route path="/play/:gameId" element={<p>Play screen</p>} />
    </Routes>,
    { state, route: '/results' },
  )
}

describe('Results', () => {
  it('redirects to home when there is no result to show', () => {
    renderResults(createGuestState(TODAY))
    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('shows the score, stats and a new personal best after the first daily game', () => {
    renderResults(recordResult(createGuestState(TODAY), makeResult('colors', 930)))

    expect(screen.getByRole('heading', { name: '930 points' })).toBeInTheDocument()
    expect(screen.getByText('New personal best')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 today')).toBeInTheDocument()
    expect(screen.getAllByText('5/5 found').length).toBeGreaterThan(0)
  })

  it('goes to the next daily game', async () => {
    const user = userEvent.setup()
    renderResults(recordResult(createGuestState(TODAY), makeResult('colors')))

    await user.click(screen.getByRole('button', { name: 'Next game' }))
    expect(screen.getByText('Play screen')).toBeInTheDocument()
  })

  it('shows the streak and a way back home once all three games are done', async () => {
    const user = userEvent.setup()
    let state = createGuestState(TODAY)
    for (const id of GAME_IDS) state = recordResult(state, makeResult(id))
    renderResults(state)

    expect(screen.getByText(/All three done/)).toHaveTextContent('Your streak is now 1 day.')
    expect(screen.queryByRole('button', { name: 'Next game' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('asks a guest to sign in to keep the score', async () => {
    const user = userEvent.setup()
    const { actions } = renderResults(recordResult(createGuestState(TODAY), makeResult('colors')))

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(actions.signIn).toHaveBeenCalledOnce()
  })

  it('shows a signed-in player their top 3 instead of the sign-in panel', () => {
    let state = signedInState()
    for (const points of [500, 900, 700]) state = recordResult(state, makeResult('colors', points))
    renderResults(state)

    const top = screen.getByRole('complementary', { name: 'Your top 3' })
    expect(top).toHaveTextContent('900')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['900', '700', '500'])
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()
  })

  it('copies the score to the clipboard when the share sheet is not available', async () => {
    // userEvent.setup() swaps in a fake clipboard; jsdom has no navigator.share.
    const user = userEvent.setup()
    renderResults(recordResult(createGuestState(TODAY), makeResult('colors', 930)))

    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toContain('I scored 930 points in Spot The Difference')
  })
})
