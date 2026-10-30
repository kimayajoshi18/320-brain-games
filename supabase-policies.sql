-- Row Level Security policies for Puzzlr.
-- Run this in the Supabase SQL editor. It is safe to run more than once.
-- Each player can read and write only their own rows. The games and achievements
-- tables are read-only for everyone.

-- ---------- Turn RLS on ----------
alter table public.profiles        enable row level security;
alter table public.game_sessions   enable row level security;
alter table public.user_game_stats enable row level security;
alter table public.progress        enable row level security;
alter table public.games           enable row level security;
alter table public.achievements    enable row level security;

-- ---------- profiles (key: id = auth user id) ----------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- game_sessions (a play is written once and never changed) ----------
drop policy if exists "game_sessions_select_own" on public.game_sessions;
drop policy if exists "game_sessions_insert_own" on public.game_sessions;

create policy "game_sessions_select_own" on public.game_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "game_sessions_insert_own" on public.game_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------- user_game_stats ----------
drop policy if exists "user_game_stats_select_own" on public.user_game_stats;
drop policy if exists "user_game_stats_insert_own" on public.user_game_stats;
drop policy if exists "user_game_stats_update_own" on public.user_game_stats;

create policy "user_game_stats_select_own" on public.user_game_stats
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_game_stats_insert_own" on public.user_game_stats
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_game_stats_update_own" on public.user_game_stats
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- progress ----------
drop policy if exists "progress_select_own" on public.progress;
drop policy if exists "progress_insert_own" on public.progress;
drop policy if exists "progress_update_own" on public.progress;

create policy "progress_select_own" on public.progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "progress_insert_own" on public.progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "progress_update_own" on public.progress
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- games and achievements (read only) ----------
drop policy if exists "games_read_all" on public.games;
drop policy if exists "achievements_read_all" on public.achievements;

create policy "games_read_all" on public.games
  for select to anon, authenticated using (true);
create policy "achievements_read_all" on public.achievements
  for select to anon, authenticated using (true);

-- ---------- Checks (run these by hand, they change nothing) ----------
-- The app upserts with ON CONFLICT (user_id, game_id) on user_game_stats and ON CONFLICT (user_id)
-- on progress, and profiles on id. Each needs a primary key or unique constraint on those columns.
-- This lists the key columns of each table; compare with the above.
--
-- select tc.table_name, tc.constraint_type, string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
-- from information_schema.table_constraints tc
-- join information_schema.key_column_usage kcu
--   on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
-- where tc.table_schema = 'public'
--   and tc.table_name in ('profiles', 'user_game_stats', 'progress', 'game_sessions')
--   and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
-- group by tc.table_name, tc.constraint_name, tc.constraint_type
-- order by tc.table_name;
--
-- If user_game_stats has no key on (user_id, game_id), or progress none on (user_id), add it, e.g.:
-- alter table public.user_game_stats add primary key (user_id, game_id);
-- alter table public.progress add primary key (user_id);
-- If game_sessions has no unique constraint on client_session_id, add one so a retry cannot double-insert:
-- alter table public.game_sessions add constraint game_sessions_client_session_id_key unique (client_session_id);
