import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase.ts'

/** Best display name we can get from the Google account. */
export function displayNameFor(user: User): string {
  const meta = user.user_metadata ?? {}
  return (meta.full_name as string) || (meta.name as string) || user.email?.split('@')[0] || 'Player'
}

/**
 * Makes sure the signed-in user has a row in the `profiles` table.
 * Existing rows are left alone. Never throws: a failure here must not block sign-in.
 *
 * NOTE: assumes `profiles` has `id` (uuid, = auth.users.id) and `display_name` columns.
 * If the real column names differ, change them here.
 */
export async function ensureProfile(user: User): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, display_name: displayNameFor(user) }, { onConflict: 'id', ignoreDuplicates: true })
  if (error) console.warn('Could not create profile row:', error.message)
}
