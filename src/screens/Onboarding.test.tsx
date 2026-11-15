// Testing the 7-step onboarding survey
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

type User = ReturnType<typeof userEvent.setup>

// Answers steps 1 to 4 (train Colors, then the three radio questions) and stops on the play time step.
async function toWhenStep(user: User) {
  await user.click(screen.getByRole('button', { name: /Noticing details/ }))
  await user.click(next())
  await user.click(screen.getByRole('radio', { name: 'Sometimes' }))
  await user.click(next())
  await user.click(screen.getByRole('radio', { name: 'Rarely' }))
  await user.click(next())
  await user.click(screen.getByRole('radio', { name: 'Okay' }))
  await user.click(next())
}

// The header also has a Skip button, so the age step's Skip is the last one.
const skipAge = () => screen.getAllByRole('button', { name: 'Skip' }).at(-1)!

describe('Onboarding', () => {
  it('only lets you continue after picking something to train', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument()
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

    // Steps 2 to 4: one answer each.
    expect(screen.getByText('Step 2 of 7')).toBeInTheDocument()
    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'Sometimes' }))
    expect(screen.getByRole('radio', { name: 'Sometimes' })).toHaveAttribute('aria-checked', 'true')
    await user.click(next())
    expect(screen.getByText('Step 3 of 7')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Rarely' }))
    await user.click(next())
    expect(screen.getByText('Step 4 of 7')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Okay' }))
    await user.click(next())

    // Step 5: play time is a multi-select.
    expect(screen.getByText('Step 5 of 7')).toBeInTheDocument()
    expect(next()).toBeDisabled()
    const evening = screen.getByRole('button', { name: /^Evening/ })
    await user.click(evening)
    expect(evening).toHaveAttribute('aria-pressed', 'true')
    await user.click(next())

    // Step 6: the age range is optional, and the button says Skip until one is picked.
    expect(screen.getByText('Step 6 of 7')).toBeInTheDocument()
    expect(next).toThrow()
    await user.click(screen.getByRole('radio', { name: '25 to 34' }))
    await user.click(next())

    // Step 7: the plan puts the focus game first and shows the reminder.
    expect(screen.getByRole('heading', { name: 'Your plan' })).toBeInTheDocument()
    const plan = screen.getAllByRole('listitem')
    expect(plan[0]).toHaveTextContent('Colors')
    expect(plan[0]).toHaveTextContent('Focus')
    expect(screen.getByText(/We'll remind you at 7:00pm/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Play as guest' }))
    expect(actions.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        focus: ['colors'],
        when: 'evening',
        answers: expect.objectContaining({
          forget: ['sometimes'],
          attention: ['rarely'],
          numbers: ['okay'],
          when: ['evening'],
          age: ['25-34'],
        }),
      }),
    )
    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('keeps the answers when going back a step', async () => {
    const user = userEvent.setup()
    renderOnboarding()

    await user.click(screen.getByRole('button', { name: /Noticing details/ }))
    await user.click(next())
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Noticing details/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('stays put while Google sign-in redirects', async () => {
    const user = userEvent.setup()
    const { actions } = renderOnboarding()

    await toWhenStep(user)
    await user.click(screen.getByRole('button', { name: /^Morning/ }))
    await user.click(next())
    await user.click(skipAge())
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    // signIn resolves to null (the page is leaving for Google), so no navigation.
    expect(actions.completeOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ focus: ['colors'], when: 'morning', answers: expect.objectContaining({ when: ['morning'] }) }),
    )
    expect(actions.signIn).toHaveBeenCalledOnce()
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument()
  })

  it('skipping saves empty answers and goes home', async () => {
    const user = userEvent.setup()
    const { actions } = renderOnboarding()

    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(actions.completeOnboarding).toHaveBeenCalledWith({ focus: [], when: null, answers: {} })
    expect(screen.getByText('Home screen')).toBeInTheDocument()
  })

  it('offers a signed-in player "Start playing" instead of the sign-in choices', async () => {
    const user = userEvent.setup()
    renderOnboarding(signedInState())

    await toWhenStep(user)
    await user.click(screen.getByRole('button', { name: /^Whenever/ }))
    await user.click(next())
    await user.click(skipAge())

    expect(screen.getByText('No reminders. Play whenever you like.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start playing' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play as guest' })).not.toBeInTheDocument()
    expect(screen.queryByText('Keep your progress?')).not.toBeInTheDocument()
  })
})