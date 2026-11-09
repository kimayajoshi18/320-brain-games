import { supabase } from './supabase.ts'

// Achievements are awarded by database triggers after each game_sessions insert; the app only reads them.

export interface EarnedAchievement {
  name: string
  earnedAt: string
}

/** The signed-in player's earned achievements, or null (and a console error) if they could not be loaded. */
export async function fetchEarnedAchievements(): Promise<EarnedAchievement[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('user_achievements').select('earned_at, achievements(name)')
  if (error) {
    console.error('Could not load achievements:', error.message)
    return null
  }
  const rows = data as unknown as { earned_at: string; achievements: { name: string } | { name: string }[] | null }[]
  return rows.flatMap((row) => {
    const joined = Array.isArray(row.achievements) ? row.achievements[0] : row.achievements
    return joined ? [{ name: joined.name, earnedAt: row.earned_at }] : []
  })
}
