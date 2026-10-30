import type { User } from '@supabase/supabase-js'
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { ACHIEVEMENTS } from '../data/achievements.ts'
import { createDemoAccount } from '../data/mock.ts'
import * as achievementData from '../lib/achievementData.ts'
import { setTimezone, todayKey } from '../lib/date.ts'
import * as gameData from '../lib/gameData.ts'
import * as profileData from '../lib/profileData.ts'
import { displayNameFor, ensureProfile } from '../lib/profiles.ts'
import { supabase } from '../lib/supabase.ts'
import { AppStateContext, type AppActions } from './context.ts'
import * as store from './store.ts'
import type { AppState, RemoteProfile, RemoteSnapshot } from './types.ts'

// Sign-in is real Google auth through Supabase when VITE_SUPABASE_* is set; otherwise it is the
// demo sign-in. For signed-in players, results and the survey are also saved to Supabase (see
// lib/gameData.ts) and loaded back on sign-in; localStorage (one entry per Supabase user) stays as a
// cache so the app works if the database cannot be reached. Guest progress only lives for the
// browser tab and is never sent to the database: "progress isn't saved until they sign in".
const ACCOUNT_KEY = 'puzzlr:account'
const SIGNED_IN_KEY = 'puzzlr:signed-in'
const GUEST_KEY = 'puzzlr:guest'

function read(storage: Storage, key: string): AppState | null {
  try {
    const raw = storage.getItem(key)
    return raw ? store.withDefaults(JSON.parse(raw) as AppState) : null
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

/** The Supabase user id when this player's progress belongs in the database; guests and the demo account have none. */
function databaseUser(state: AppState): string | null {
  return supabase && state.account.kind === 'google' ? (state.account.userId ?? null) : null
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
  | { type: 'hydrate'; snapshot: RemoteSnapshot }
  | { type: 'hydrateProfile'; userId: string; profile: RemoteProfile }
  | { type: 'earned'; ids: string[] }
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
    case 'hydrate':
      return state.account.kind === 'google' && state.account.userId === action.snapshot.userId
        ? store.hydrateFromRemote(state, action.snapshot)
        : state
    case 'hydrateProfile':
      return state.account.kind === 'google' && state.account.userId === action.userId
        ? store.hydrateProfile(state, action.profile)
        : state
    case 'earned':
      return store.addEarned(state, action.ids)
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
  // The user whose saved data has been loaded during this page visit.
  const syncedFor = useRef<string | null>(null)
  // Achievements are only recorded once the player's saved data has been loaded.
  const [synced, setSynced] = useState(!supabase)

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
    // Create the profile row, then load the player's saved data into the app. The app stays blank
    // until this finishes (or gives up) so nothing is played against half-loaded data.
    const sync = async (user: User) => {
      try {
        await ensureProfile(user)
        // Wait for the sign-in to reach the app state before reading it.
        for (let i = 0; i < 25 && latest.current.account.kind !== 'google'; i++) {
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
        const loaded = await profileData.loadProfile(user.id)
        if (loaded) setTimezone(loaded.timezone)
        const today = todayKey()
        dispatch({ type: 'newDay', today })
        const local = store.rollToDay(latest.current, today)
        const snapshot = await gameData.loadAndSync(user.id, local)
        const earned = await achievementData.loadEarned(user.id, local.earned)
        if (loaded) {
          dispatch({ type: 'hydrateProfile', userId: user.id, profile: loaded.profile })
          void profileData.pushLocalProfile(user.id, local, loaded.profile)
        }
        if (snapshot) dispatch({ type: 'hydrate', snapshot })
        if (earned) dispatch({ type: 'earned', ids: earned })
      } finally {
        setSynced(true)
        setAuthReady(true)
      }
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep this callback synchronous; Supabase can deadlock if it awaits other auth calls in here.
      if (session?.user) {
        dispatch({ type: 'authUser', user: session.user })
        sessionStorage.removeItem(GUEST_KEY) // The guest's progress is now part of the account.
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && syncedFor.current !== session.user.id) {
          syncedFor.current = session.user.id
          setTimeout(() => void sync(session.user), 0)
        }
      } else if (event === 'SIGNED_OUT') {
        syncedFor.current = null
        setSynced(false)
        dispatch({ type: 'replace', state: store.createGuestState(todayKey()) })
      }
      if (event === 'INITIAL_SESSION' && !session?.user) setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Record newly earned achievements for signed-in players.
  useEffect(() => {
    const userId = databaseUser(state)
    if (!userId || !synced) return
    const fresh = ACHIEVEMENTS.filter((a) => a.earned(state) && !state.earned.includes(a.id)).map((a) => a.id)
    if (fresh.length === 0) return
    dispatch({ type: 'earned', ids: fresh })
    void achievementData.saveEarned(userId, fresh)
  }, [state, synced])

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
      completeOnboarding: (answers) => {
        dispatch({ type: 'completeOnboarding', answers })
        const userId = databaseUser(latest.current)
        if (userId) void profileData.saveSurvey(userId, answers)
      },
      recordResult: (played) => {
        // The tab may have been open past midnight, so count the play on the real current day.
        const today = todayKey()
        const result = { ...played, playedAt: today }
        const before = store.rollToDay(latest.current, today)
        dispatch({ type: 'newDay', today })
        dispatch({ type: 'recordResult', result })
        const userId = databaseUser(before)
        if (!userId) return
        // Same rules as the reducer, so the numbers saved are the numbers the player sees.
        const after = store.recordResult(before, result)
        latest.current = after
        const finishedDay = after.completedDays.length > before.completedDays.length
        const progress = finishedDay
          ? { currentStreak: store.currentStreak(after), longestStreak: after.bestStreak, lastPlayedDay: after.today }
          : null
        void gameData.saveResult(userId, result, progress)
      },
      updateProfile: (changes) => {
        dispatch({ type: 'updateProfile', changes })
        const userId = databaseUser(latest.current)
        if (userId) void profileData.saveProfileChanges(userId, changes)
      },
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
