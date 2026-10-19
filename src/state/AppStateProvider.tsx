import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { createDemoAccount } from '../data/mock.ts'
import { todayKey } from '../lib/date.ts'
import { AppStateContext, type AppActions } from './context.ts'
import * as store from './store.ts'
import type { AppState } from './types.ts'

// Signed-in progress is kept in localStorage (standing in for a server).
// Guest progress only lives for the browser tab: "progress isn't saved until they sign in".
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

function loadInitialState(): AppState {
  const today = todayKey()
  const signedIn = localStorage.getItem(SIGNED_IN_KEY) === '1'
  const saved = signedIn ? read(localStorage, ACCOUNT_KEY) : read(sessionStorage, GUEST_KEY)
  return store.rollToDay(saved ?? store.createGuestState(today), today)
}

type Action =
  | { type: 'newDay'; today: string }
  | { type: 'replace'; state: AppState }
  | { type: 'completeOnboarding'; answers: Parameters<AppActions['completeOnboarding']>[0] }
  | { type: 'recordResult'; result: Parameters<AppActions['recordResult']>[0] }
  | { type: 'updateProfile'; changes: Parameters<AppActions['updateProfile']>[0] }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'newDay':
      return store.rollToDay(state, action.today)
    case 'replace':
      return action.state
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

  // Persist after every change.
  useEffect(() => {
    latest.current = state
    if (state.account.kind === 'google') {
      write(localStorage, ACCOUNT_KEY, state)
      write(localStorage, SIGNED_IN_KEY, '1')
    } else {
      write(sessionStorage, GUEST_KEY, state)
    }
  }, [state])

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
      signIn: () => {
        const guest = latest.current
        const account = read(localStorage, ACCOUNT_KEY) ?? createDemoAccount(todayKey())
        sessionStorage.removeItem(GUEST_KEY)
        dispatch({ type: 'replace', state: store.mergeGuestIntoAccount(account, guest) })
      },
      signOut: () => {
        localStorage.removeItem(SIGNED_IN_KEY)
        dispatch({ type: 'replace', state: store.createGuestState(todayKey()) })
      },
    }),
    [],
  )

  const value = useMemo(() => ({ state, actions }), [state, actions])
  return <AppStateContext value={value}>{children}</AppStateContext>
}
