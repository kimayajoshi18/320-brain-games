import type { User } from '@supabase/supabase-js'
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { createDemoAccount } from '../data/mock.ts'
import { todayKey } from '../lib/date.ts'
import { displayNameFor, ensureProfile } from '../lib/profiles.ts'
import { supabase } from '../lib/supabase.ts'
import { AppStateContext, type AppActions } from './context.ts'
import * as store from './store.ts'
import type { AppState } from './types.ts'

// Sign-in is real Google auth through Supabase when VITE_SUPABASE_* is set; otherwise it is the
// demo sign-in. Game progress is still kept in localStorage (one entry per Supabase user) until
// the game tables are wired up. Guest progress only lives for the browser tab:
// "progress isn't saved until they sign in".
const ACCOUNT_KEY = 'puzzlr:account'
const SIGNED_IN_KEY = 'puzzlr:signed-in'
const GUEST_KEY = 'puzzlr:guest'

function read(storage: Storage, key: string): AppState | null {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as AppState) : null
  } catch {
    return null
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    // Storage can be full or blocked (private mode); the app still works in memory.
  }
}

/** Where a signed-in player's saved progress lives. Real users each get their own entry. */
function accountKey(userId?: string): string {
  return userId ? `${ACCOUNT_KEY}:${userId}` : ACCOUNT_KEY
}

/** Saved progress for a Supabase user, or a fresh account if this is their first sign-in. */
function accountForUser(user: User, today: string): AppState {
  const saved = read(localStorage, accountKey(user.id))
  if (saved) return saved
  return {
    ...store.createGuestState(today),
    account: { kind: 'google', userId: user.id, profile: { name: displayNameFor(user), recoveryPhone: null, reminder: null } },
  }
}

function loadInitialState(): AppState {
  const today = todayKey()
  // With Supabase, the session decides who is signed in; AppStateProvider restores the account once it knows.
  const signedIn = !supabase && localStorage.getItem(SIGNED_IN_KEY) === '1'
  const saved = signedIn ? read(localStorage, ACCOUNT_KEY) : read(sessionStorage, GUEST_KEY)
  return store.rollToDay(saved ?? store.createGuestState(today), today)
}

type Action =
  | { type: 'newDay'; today: string }
  | { type: 'replace'; state: AppState }
  | { type: 'signIn'; account: AppState }
  | { type: 'authUser'; user: User }
  | { type: 'completeOnboarding'; answers: Parameters<AppActions['completeOnboarding']>[0] }
  | { type: 'recordResult'; result: Parameters<AppActions['recordResult']>[0] }
  | { type: 'updateProfile'; changes: Parameters<AppActions['updateProfile']>[0] }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'newDay':
      return store.rollToDay(state, action.today)
    case 'replace':
      return action.state
    case 'signIn':
      return state.account.kind === 'google' ? state : store.mergeGuestIntoAccount(action.account, state)
    case 'authUser': {
      if (state.account.kind === 'google' && state.account.userId === action.user.id) return state
      const account = accountForUser(action.user, todayKey())
      // A guest's progress is carried over; a different signed-in user is replaced outright.
      return state.account.kind === 'guest' ? store.mergeGuestIntoAccount(account, state) : account
    }
    case 'completeOnboarding':
      return store.completeOnboarding(state, action.answers)
    case 'recordResult':
      return store.recordResult(state, action.result)
    case 'updateProfile':
      return store.updateProfile(state, action.changes)
  }
}

export default function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)
  const latest = useRef(state)
  // With Supabase we must wait to hear whether a session exists before showing any screen.
  const [authReady, setAuthReady] = useState(!supabase)

  // Persist after every change.
  useEffect(() => {
    latest.current = state
    if (state.account.kind === 'google') {
      write(localStorage, accountKey(state.account.userId), state)
      if (!supabase) write(localStorage, SIGNED_IN_KEY, '1')
    } else {
      write(sessionStorage, GUEST_KEY, state)
    }
  }, [state])

  // Follow the Supabase session: signing in (including coming back from Google), reloads and sign-out.
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep this callback synchronous; Supabase can deadlock if it awaits other auth calls in here.
      if (session?.user) {
        dispatch({ type: 'authUser', user: session.user })
        sessionStorage.removeItem(GUEST_KEY) // The guest's progress is now part of the account.
        if (event === 'SIGNED_IN') setTimeout(() => void ensureProfile(session.user), 0)
      } else if (event === 'SIGNED_OUT') {
        dispatch({ type: 'replace', state: store.createGuestState(todayKey()) })
      }
      if (event === 'INITIAL_SESSION') setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Start a fresh daily three when the app is reopened on a new day.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') dispatch({ type: 'newDay', today: todayKey() })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const actions = useMemo<AppActions>(
    () => ({
      completeOnboarding: (answers) => dispatch({ type: 'completeOnboarding', answers }),
      recordResult: (result) => dispatch({ type: 'recordResult', result }),
      updateProfile: (changes) => dispatch({ type: 'updateProfile', changes }),
      signIn: async () => {
        if (supabase) {
          // Let the pending guest state (e.g. onboarding answers) reach sessionStorage before we leave the page.
          await new Promise((resolve) => setTimeout(resolve, 0))
          write(sessionStorage, GUEST_KEY, latest.current)
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
          })
          if (error) console.error('Google sign-in failed:', error.message)
          return null
        }
        const account = read(localStorage, ACCOUNT_KEY) ?? createDemoAccount(todayKey())
        sessionStorage.removeItem(GUEST_KEY)
        dispatch({ type: 'signIn', account })
        return { onboarded: account.onboarding.complete || latest.current.onboarding.complete }
      },
      signOut: () => {
        if (supabase) {
          void supabase.auth.signOut() // The SIGNED_OUT event above resets the app to a guest.
          return
        }
        localStorage.removeItem(SIGNED_IN_KEY)
        dispatch({ type: 'replace', state: store.createGuestState(todayKey()) })
      },
    }),
    [],
  )

  const value = useMemo(() => ({ state, actions }), [state, actions])
  if (!authReady) return null
  return <AppStateContext value={value}>{children}</AppStateContext>
}
