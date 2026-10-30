import type { SupabaseClient } from '@supabase/supabase-js'
import { ACHIEVEMENTS } from '../data/achievements.ts'
import { attempt, inOrder, warn } from './dbUtil.ts'
import { supabase } from './supabase.ts'

// Earned achievements live in `user_achievements`. The app's achievements are matched to the
// `achievements` table by name (case-insensitive); one without a match is skipped with a warning.

let dbIds: Promise<Map<string, number>> | null = null

/** App achievement id -> row id in the achievements table. */
function loadDbIds(db: SupabaseClient): Promise<Map<string, number>> {
  dbIds ??= fetchDbIds(db).catch((error) => {
    dbIds = null
    throw error
  })
  return dbIds
}

async function fetchDbIds(db: SupabaseClient) {
  const { data, error } = await db.from('achievements').select('id, name')
  if (error) throw error
  const rows = (data ?? []) as { id: number; name: string }[]
  const ids = new Map<string, number>()
  for (const a of ACHIEVEMENTS) {
    const row = rows.find((r) => r.name.trim().toLowerCase() === a.name.trim().toLowerCase())
    if (row) ids.set(a.id, row.id)
    else console.warn(`No row in the achievements table matches "${a.name}"; it will not be saved.`)
  }
  return ids
}

async function insertEarned(db: SupabaseClient, userId: string, achievementId: number) {
  const { error } = await db.from('user_achievements').insert({ user_id: userId, achievement_id: achievementId })
  if (error && error.code !== '23505') throw error // 23505: already stored.
}

/** Records newly earned achievements for the player. */
export function saveEarned(userId: string, localIds: string[]): Promise<void> {
  return inOrder(async () => {
    const db = supabase
    if (!db || localIds.length === 0) return
    await attempt('save achievements', async () => {
      const ids = await loadDbIds(db)
      for (const id of localIds) {
        const dbId = ids.get(id)
        if (dbId !== undefined) await insertEarned(db, userId, dbId)
      }
    })
  })
}

/**
 * Loads the achievements the player has earned and uploads any this device knows about that the
 * database does not. Resolves to the combined list of app achievement ids, or null on failure.
 */
export function loadEarned(userId: string, localIds: string[]): Promise<string[] | null> {
  return inOrder(async () => {
    const db = supabase
    if (!db) return null
    try {
      const ids = await loadDbIds(db)
      const { data, error } = await db.from('user_achievements').select('achievement_id').eq('user_id', userId)
      if (error) throw error
      const earnedDb = new Set(((data ?? []) as { achievement_id: number }[]).map((r) => r.achievement_id))
      const earned = new Set(localIds)
      for (const [id, dbId] of ids) if (earnedDb.has(dbId)) earned.add(id)
      for (const id of localIds) {
        const dbId = ids.get(id)
        if (dbId !== undefined && !earnedDb.has(dbId)) await attempt('save achievements', () => insertEarned(db, userId, dbId))
      }
      return [...earned]
    } catch (error) {
      warn('load achievements', error)
      return null
    }
  })
}
