// Testing the 3-step onboarding survey
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { AppState } from '../state/types.ts'
import { signedInState } from '../test/fixtures.ts'
import { renderWithApp } from '../test/render.tsx'
import Onboarding from './Onboarding.tsx'

function renderOnboarding(state?: AppState) {
  return renderWithApp(
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/home" element={<p>Home screen</p>} />
    </Routes>,
    { state, route: '/onboarding' },
  )
}

const next = () => screen.getByRole('button', { name: 'Next' })

describe('Onboarding', () => {
  it('only lets you continue after picking something to train', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    expect(next()).toBeDisabled()

    const colors = screen.getByRole('button', { name: /Noticing details/ })
    await user.click(colors)
    expect(colors).toHaveAttribute('aria-pressed', 'true')
    expect(next()).toBeEnabled()

    // Clicking again un-selects it.
    await user.click(colors)
    expect(colors).toHaveAttribute('aria-pressed', 'false')
    expect(next()).toBeDisabled()
  })

  it('walks a guest through the survey and saves their answers', async () => {
    const user = userEvent.setup()
    const { actions } = renderOnboarding()

    // Step 1: pick Colors.
    await user.click(screen.getByRole('button', { name: /Noticing details/ }))
    await user.click(next())

    // Step 2: pick a play time.
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /^Evening/ }))
    expect(screen.getByRole('radio', { name: /^Evening/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(next())

    // Step 3: the plan puts the focus game first and shows the reminder.
    expect(screen.getByRole('heading', { name: 'Your plan' })).toBeInTheDocument()
    const plan = screen.getAllByRole('listitem')
    expect(plan[0]).toHaveTextContent('Colors')
    expect(plan[0]).toHaveTextContent('Focus')
    expect(screen.getByText(/We'll remind you at 7:00pm/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Play as guest' }))
    expect(actions.completeOnboarding).toHaveBeenCalledWith({ focus: ['colors'], when: 'evening' })
    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('keeps the answers when going back a step', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    await user.click(screen.getByRole('button', { name: /Noticing details/ }))
    await user.click(next())
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Noticing details/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('stays put while Google sign-in redirects', async () => {
    const user = userEvent.setup()
    const { actions } = renderOnboarding()

    await user.click(screen.getByRole('button', { name: /Noticing details/ }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: /^Morning/ }))
    await user.click(next())
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    // signIn resolves to null (the page is leaving for Google), so no navigation.
    expect(actions.completeOnboarding).toHaveBeenCalledWith({ focus: ['colors'], when: 'morning' })
    expect(actions.signIn).toHaveBeenCalledOnce()
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument()
  })

  it('skipping saves empty answers and goes home', async () => {
    const user = userEvent.setup()
    const { actions } = renderOnboarding()

    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(actions.completeOnboarding).toHaveBeenCalledWith({ focus: [], when: null })
    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('offers a signed-in player "Start playing" instead of the sign-in choices', async () => {
    const user = userEvent.setup()
    renderOnboarding(signedInState())

    await user.click(screen.getByRole('button', { name: /Noticing details/ }))
    await user.click(next())
    await user.click(screen.getByRole('radio', { name: /^Whenever/ }))
    await user.click(next())

    expect(screen.getByText('No reminders. Play whenever you like.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start playing' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play as guest' })).not.toBeInTheDocument()
    expect(screen.queryByText('Keep your progress?')).not.toBeInTheDocument()
  })
})
