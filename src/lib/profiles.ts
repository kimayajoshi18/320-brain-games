import type { User } from '@supabase/supabase-js'
import { isGameId } from '../data/games.ts'
import type { Onboarding, PlayTime, Profile } from '../state/types.ts'
import { supabase } from './supabase.ts'

// The `profiles` row is created by the `puzzlr_handle_new_user` trigger when someone signs up,
// so the frontend only ever reads and updates it (signed-in users have no INSERT grant).
//
// Column mapping:
//   display_name   -> Profile.name
//   recovery_phone -> Profile.recoveryPhone
//   reminder       -> Profile.reminder
//   goals          -> Onboarding.focus (game categories: memory, numbers, colors)
//   play_time      -> Onboarding.when
//   survey         -> { completed_at } once the onboarding survey is done (or skipped); null before
//   timezone       -> the browser's IANA time zone, kept up to date on sign-in

const COLUMNS = 'display_name, recovery_phone, reminder, goals, play_time, survey, timezone'
const PLAY_TIMES: PlayTime[] = ['commute', 'morning', 'evening', 'whenever']

interface ProfileRow {
  display_name: string
  recovery_phone: string | null
  reminder: string | null
  goals: string[]
  play_time: string | null
  survey: { completed_at?: string } | null
  timezone: string
}

export interface RemoteProfile {
  profile: Profile
  /** Null when the player has never been through the onboarding survey. */
  onboarding: Onboarding | null
}

/** Best display name we can get from the Google account. */
export function displayNameFor(user: User): string {
  const meta = user.user_metadata ?? {}
  return (meta.full_name as string) || (meta.name as string) || user.email?.split('@')[0] || 'Player'
}

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/**
 * Loads the signed-in player's profile row. Returns null (and logs why) if it can't be read,
 * so the app can keep going with whatever it has cached.
 */
export async function fetchProfile(userId: string): Promise<RemoteProfile | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle<ProfileRow>()
  if (error) {
    console.error('Could not load profile:', error.message)
    return null
  }
  if (!data) {
    console.error(`No profiles row for user ${userId}. The puzzlr_handle_new_user trigger should have created it.`)
    return null
  }

  const timeZone = browserTimeZone()
  if (timeZone && timeZone !== data.timezone) void saveRow(userId, { timezone: timeZone })

  return {
    profile: { name: data.display_name, recoveryPhone: data.recovery_phone, reminder: data.reminder },
    onboarding: data.survey
      ? {
          complete: true,
          focus: data.goals.filter(isGameId),
          when: PLAY_TIMES.find((t) => t === data.play_time) ?? null,
        }
      : null,
  }
}

async function saveRow(userId: string, row: Partial<ProfileRow>): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('profiles').update(row).eq('id', userId)
  if (error) console.error('Could not save profile:', error.message)
}

/** Saves account settings changed on the profile page. */
export function saveProfile(userId: string, changes: Partial<Profile>): Promise<void> {
  const row: Partial<ProfileRow> = {}
  if (changes.name !== undefined) row.display_name = changes.name
  if (changes.recoveryPhone !== undefined) row.recovery_phone = changes.recoveryPhone
  if (changes.reminder !== undefined) row.reminder = changes.reminder
  return saveRow(userId, row)
}

/** Saves the onboarding survey answers, plus the reminder they set. */
export function saveOnboarding(userId: string, answers: Omit<Onboarding, 'complete'>, reminder?: string | null): Promise<void> {
  return saveRow(userId, {
    goals: answers.focus,
    play_time: answers.when,
    survey: { completed_at: new Date().toISOString() },
    ...(reminder !== undefined && { reminder }),
  })
}
