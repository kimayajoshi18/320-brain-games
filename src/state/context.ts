import { createContext, useContext } from 'react'
import type { GameResult, Onboarding, Profile, AppState } from './types.ts'

export interface AppActions {
  completeOnboarding: (answers: Omit<Onboarding, 'complete'>) => void
  recordResult: (result: GameResult) => void
  updateProfile: (changes: Partial<Profile>) => void
  /**
   * Google sign-in. With Supabase configured this redirects to Google and
   * resolves to null (the page leaves); the player is signed in when they come back.
   * Without Supabase it signs in a demo player and resolves to whether they have
   * already been through onboarding. Progress made as a guest is kept either way.
   */
  signIn: () => Promise<{ onboarded: boolean } | null>
  signOut: () => void
}

export const AppStateContext = createContext<{ state: AppState; actions: AppActions } | null>(null)

export function useAppState() {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside <AppStateProvider>')
  return value
}
