import { createContext, useContext } from 'react'
import type { GameResult, Onboarding, Profile, AppState } from './types.ts'

export interface AppActions {
  completeOnboarding: (answers: Omit<Onboarding, 'complete'>) => void
  recordResult: (result: GameResult) => void
  updateProfile: (changes: Partial<Profile>) => void
  /**
   * Mock Google sign-in. Keeps any progress made as a guest.
   * Returns whether the player has already been through onboarding.
   */
  signIn: () => { onboarded: boolean }
  signOut: () => void
}

export const AppStateContext = createContext<{ state: AppState; actions: AppActions } | null>(null)

export function useAppState() {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside <AppStateProvider>')
  return value
}
