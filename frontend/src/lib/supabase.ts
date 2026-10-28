import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * The shared Supabase client, or null when the env vars are missing.
 * With no client the app falls back to the demo sign-in (see AppStateProvider),
 * so the frontend still runs for anyone who has not set up a .env.local yet.
 */
export const supabase = url && anonKey ? createClient(url, anonKey) : null
