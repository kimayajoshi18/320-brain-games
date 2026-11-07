import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { renderWithApp } from '../test/render.tsx'
import Home from './Home.tsx'

it('displays the guest progress and gives the user an option to sign in', async()=>{
    const user = userEvent.setup()
    const {actions} = renderWithApp(<Home />, {route: '/home'})
    expect(screen.getByRole('heading', {level:1})).toHaveTextContent('0 of 3 done')
    await user.click(screen.getByRole('button', {name: 'Sign in to keep it'}))
    expect(actions.signIn).toHaveBeenCalledOnce()
})