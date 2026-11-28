import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { createGuestState } from '../state/store.ts'
import { renderWithApp } from '../test/render.tsx'
import Home from './Home.tsx'

it('displays the guest progress and gives the user an option to sign in', async()=>{
    const user = userEvent.setup()
    const {actions} = renderWithApp(<Home />, {route: '/home'})
    expect(screen.getByRole('heading', {level:1})).toHaveTextContent('0 of 4 done')
    await user.click(screen.getByRole('button', {name: 'Sign in to keep it'}))
    expect(actions.signIn).toHaveBeenCalledOnce()
})
it('shows Symbol Recall with the other daily games from 2026-11-28, the day it joined', ()=>{
    renderWithApp(<Home />, {state: createGuestState('2026-11-28'), route: '/home'})
    expect(screen.getByRole('heading', {level:1})).toHaveTextContent('0 of 5 done')
    const daily = document.querySelector<HTMLElement>('.daily-cards')!
    expect(within(daily).getAllByRole('listitem')).toHaveLength(5)
    expect(within(daily).getByText('Symbols')).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Symbols'})).toHaveAttribute('href', '/play/symbols')
})
