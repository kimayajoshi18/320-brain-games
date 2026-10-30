import type { SupabaseClient } from '@supabase/supabase-js'
import { isGameId } from '../data/games.ts'
import { SURVEY, columnValue } from '../data/survey.ts'
import type { AppState, Onboarding, PlayTime, Profile, RemoteProfile } from '../state/types.ts'
import { browserTimezone, isValidTimezone } from './date.ts'
import { attempt, inOrder, warn } from './dbUtil.ts'
import { supabase } from './supabase.ts'

// Everything that reads or writes the `profiles` row. The base fields and the extras (survey,
// recovery_phone, reminder) are separate updates so a missing extras column never blocks the base ones.

const PLAY_TIMES: PlayTime[] = ['commute', 'morning', 'evening', 'whenever']
const MISSING_COLUMN = '42703'

async function updateRow(db: SupabaseClient, userId: string, what: string, fields: object) {
  await attempt(what, async () => {
    const { error } = await db.from('profiles').update(fields).eq('id', userId)
    if (error && error.code !== MISSING_COLUMN) throw error
  })
}

/** The player's saved profile and the time zone to use for "today". Null if the row could not be read. */
export function loadProfile(userId: string): Promise<{ profile: RemoteProfile; timezone: string } | null> {
  return inOrder(() => loadProfileNow(userId))
}

async function loadProfileNow(userId: string) {
  const db = supabase
  if (!db) return null
  try {
    const base = await db
      .from('profiles')
      .select('display_name, age_range, timezone, goals, play_time')
      .eq('id', userId)
      .maybeSingle()
    if (base.error) throw base.error

    const extrasQuery = await db.from('profiles').select('survey, recovery_phone, reminder').eq('id', userId).maybeSingle()
    if (extrasQuery.error && extrasQuery.error.code !== MISSING_COLUMN) warn('read profile extras', extrasQuery.error)
    const extrasRow = extrasQuery.error ? null : extrasQuery.data
    const survey = extrasRow?.survey

    const row = base.data
    // The column defaults to UTC, so UTC with a different browser zone means it was never set.
    let timezone: string = row?.timezone && isValidTimezone(row.timezone) ? row.timezone : browserTimezone()
    if (row && timezone === 'UTC' && browserTimezone() !== 'UTC') {
      timezone = browserTimezone()
      await updateRow(db, userId, 'save the time zone', { timezone })
    }

    const profile: RemoteProfile = {
      displayName: row?.display_name ?? null,
      ageRange: row?.age_range ?? null,
      goals: ((row?.goals ?? []) as string[]).filter(isGameId),
      playTime: PLAY_TIMES.find((t) => t === row?.play_time) ?? null,
      extras: extrasQuery.error
        ? null
        : {
            survey: survey && typeof survey === 'object' ? (survey as Record<string, string>) : null,
            recoveryPhone: extrasRow?.recovery_phone ?? null,
            reminder: extrasRow?.reminder ?? null,
          },
    }
    return { profile, timezone }
  } catch (error) {
    warn('load the profile', error)
    return null
  }
}

/** Saves the survey answers. Empty answers (a skipped survey) never overwrite what is saved. */
export function saveSurvey(userId: string, answers: Omit<Onboarding, 'complete'>): Promise<void> {
  return inOrder(() => saveSurveyNow(userId, answers))
}

async function saveSurveyNow(userId: string, answers: Omit<Onboarding, 'complete'>) {
  const db = supabase
  if (!db) return
  if (answers.focus.length === 0 && !answers.when && Object.keys(answers.answers).length === 0) return
  const base: Record<string, unknown> = { goals: answers.focus, play_time: answers.when }
  for (const q of SURVEY) {
    if (q.kind === 'choice' && q.column === 'age_range' && answers.answers[q.id]) {
      base.age_range = columnValue(q, answers.answers[q.id])
    }
  }
  await updateRow(db, userId, 'save the survey', base)
  await updateRow(db, userId, 'save the survey answers', { survey: answers.answers })
}

/** Saves a change made on the profile page: the name is a base field, the rest are extras. */
export function saveProfileChanges(userId: string, changes: Partial<Profile>): Promise<void> {
  return inOrder(async () => {
    const db = supabase
    if (!db) return
    if (changes.name !== undefined) await updateRow(db, userId, 'save the name', { display_name: changes.name })
    const extras: Record<string, string | null> = {}
    if (changes.recoveryPhone !== undefined) extras.recovery_phone = changes.recoveryPhone
    if (changes.reminder !== undefined) extras.reminder = changes.reminder
    if (Object.keys(extras).length > 0) await updateRow(db, userId, 'save profile details', extras)
  })
}

const sameList = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join()
const sameAnswers = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a).sort()
  return sameList(keys, Object.keys(b)) && keys.every((k) => a[k] === b[k])
}

/**
 * Pushes what this device has that the profile lacks: a survey finished here (including one a guest
 * answered before signing in), and a recovery phone or reminder the profile has no value for.
 */
export function pushLocalProfile(userId: string, local: AppState, remote: RemoteProfile): Promise<void> {
  return inOrder(async () => {
    const db = supabase
    if (!db) return
    const o = local.onboarding
    if (o.complete) {
      const age = SURVEY.find((q) => q.kind === 'choice' && q.column === 'age_range')
      const ageChanged = age && o.answers[age.id] && columnValue(age, o.answers[age.id]) !== remote.ageRange
      const differs =
        !sameList(o.focus, remote.goals) ||
        o.when !== remote.playTime ||
        ageChanged ||
        (remote.extras !== null && !sameAnswers(o.answers, remote.extras.survey ?? {}))
      if (differs) await saveSurveyNow(userId, o)
    }
    if (local.account.kind === 'google' && remote.extras) {
      const { recoveryPhone, reminder } = local.account.profile
      const extras: Record<string, string> = {}
      if (recoveryPhone && !remote.extras.recoveryPhone) extras.recovery_phone = recoveryPhone
      if (reminder && !remote.extras.reminder) extras.reminder = reminder
      if (Object.keys(extras).length > 0) await updateRow(db, userId, 'save profile details', extras)
    }
  })
}
