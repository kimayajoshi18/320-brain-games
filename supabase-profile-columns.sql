-- Run this in the Supabase SQL editor. It is safe to run more than once.
-- The app keeps working without it: the base profile fields are saved separately from these extras.

alter table public.profiles
  add column if not exists survey jsonb,
  add column if not exists recovery_phone text,
  add column if not exists reminder text;

-- user_achievements: each player can read and add only their own rows.
alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_own" on public.user_achievements;
drop policy if exists "user_achievements_insert_own" on public.user_achievements;

create policy "user_achievements_select_own" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_achievements_insert_own" on public.user_achievements
  for insert to authenticated with check (user_id = (select auth.uid()));
