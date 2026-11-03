//Passing a fixed state and a set of mock actions to not render the real AppStateProvider

import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { AppStateContext, type AppActions } from '../state/context.ts'
import { createGuestState } from '../state/store.ts'
import type { AppState } from '../state/types.ts'

export function renderWithApp(
    ui: ReactElement,
    {state = createGuestState('2026-11-02'), route ='/',}: {state?:AppState; route?: string} ={}
){
    const mockActions: AppActions = {
        completeOnboarding: vi.fn(),
        recordResult: vi.fn(),
        updateProfile: vi.fn(),
        signIn: vi.fn().mockResolvedValue(null),
        signOut: vi.fn(),
    }
    render(
        <AppStateContext.Provider value = {{state, actions: mockActions}}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </AppStateContext.Provider>
    )
    return {actions: mockActions}
}
