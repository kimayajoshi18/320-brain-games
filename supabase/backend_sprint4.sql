-- Sprint 4 backend. Run once in the Supabase SQL editor; safe to run again.
-- Run supabase/game_progress.sql first (it creates the streak trigger this file builds on).
-- Clients never write user_game_stats, progress or user_achievements: triggers do.

-- ---------- Constraints the app and the triggers rely on ----------

create or replace function pg_temp.has_unique(tbl regclass, cols text[]) returns boolean
language sql as $$
  select exists (
    select 1 from pg_index i
    where i.indrelid = tbl and i.indisunique and i.indpred is null and i.indexprs is null
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
            where a.attrelid = i.indrelid and a.attnum = any (i.indkey::int2[]))
        = (select array_agg(c order by c) from unnest(cols) c)
  )
$$;

do $$
begin
  if not pg_temp.has_unique('public.user_game_stats', array['user_id', 'game_id']) then
    alter table public.user_game_stats add constraint user_game_stats_user_game_key unique (user_id, game_id);
  end if;
  if not pg_temp.has_unique('public.progress', array['user_id']) then
    alter table public.progress add constraint progress_user_key unique (user_id);
  end if;
  if not pg_temp.has_unique('public.game_sessions', array['client_session_id']) then
    alter table public.game_sessions add constraint game_sessions_client_session_id_key unique (client_session_id);
  end if;
  -- The app uploads with ON CONFLICT (user_id, client_session_id).
  if not pg_temp.has_unique('public.game_sessions', array['user_id', 'client_session_id']) then
    alter table public.game_sessions add constraint game_sessions_user_client_session_key unique (user_id, client_session_id);
  end if;
  if not pg_temp.has_unique('public.user_achievements', array['user_id', 'achievement_id']) then
    alter table public.user_achievements add constraint user_achievements_user_achievement_key unique (user_id, achievement_id);
  end if;
end $$;

-- ---------- Columns ----------

alter table public.profiles
  add column if not exists survey jsonb,
  add column if not exists reminder text;

-- The recovery phone option was removed from the app.
alter table public.profiles drop column if exists recovery_phone;

alter table public.game_sessions
  add column if not exists hints_used integer not null default 0,
  add column if not exists hint_penalty integer not null default 0;

alter table public.user_game_stats
  add column if not exists recent_scores integer[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_game_stats_recent_scores_max3') then
    alter table public.user_game_stats
      add constraint user_game_stats_recent_scores_max3 check (cardinality(recent_scores) <= 3);
  end if;
end $$;

-- ---------- New players get a profile row ----------

create or replace function public.puzzlr_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Player'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
declare t record;
begin
  for t in
    select tgname from pg_trigger
     where tgrelid = 'auth.users'::regclass
       and tgfoid = 'public.puzzlr_handle_new_user'::regproc
       and not tgisinternal
  loop
    execute format('drop trigger %I on auth.users', t.tgname);
  end loop;
end $$;

create trigger puzzlr_handle_new_user_on_signup
  after insert on auth.users
  for each row execute function public.puzzlr_handle_new_user();

-- ---------- Best, last and the last three scores per game ----------

-- Recomputed from game_sessions each time, so a play uploaded late (offline) lands in the right place.
create or replace function public.puzzlr_update_game_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer[];
  last_at timestamptz;
begin
  select array_agg(r.score order by r.played_at desc, r.id desc), max(r.played_at)
    into recent, last_at
    from (
      select s.score, s.played_at, s.id
        from public.game_sessions s
       where s.user_id = new.user_id and s.game_id = new.game_id
       order by s.played_at desc, s.id desc
       limit 3
    ) r;

  insert into public.user_game_stats (user_id, game_id, best_score, last_score, last_played_at, recent_scores)
  values (new.user_id, new.game_id, new.score, recent[1], last_at, recent)
  on conflict (user_id, game_id) do update
    set best_score     = greatest(user_game_stats.best_score, excluded.best_score),
        last_score     = excluded.last_score,
        last_played_at = excluded.last_played_at,
        recent_scores  = excluded.recent_scores;
  return new;
end;
$$;

do $$
declare t record;
begin
  for t in
    select tgname from pg_trigger
     where tgrelid = 'public.game_sessions'::regclass
       and tgfoid = 'public.puzzlr_update_game_stats'::regproc
       and not tgisinternal
  loop
    execute format('drop trigger %I on public.game_sessions', t.tgname);
  end loop;
end $$;

create trigger puzzlr_game_stats_on_session
  after insert on public.game_sessions
  for each row execute function public.puzzlr_update_game_stats();

update public.user_game_stats st
   set recent_scores = coalesce((
     select array_agg(r.score order by r.played_at desc, r.id desc)
       from (
         select s.score, s.played_at, s.id
           from public.game_sessions s
          where s.user_id = st.user_id and s.game_id = st.game_id
          order by s.played_at desc, s.id desc
          limit 3
       ) r
   ), '{}');

-- ---------- Achievements ----------

alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_own" on public.user_achievements;
drop policy if exists "user_achievements_insert_own" on public.user_achievements;

create policy "user_achievements_select_own" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_achievements_insert_own" on public.user_achievements
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Matches the rows of `achievements` by name, case-insensitively. A name with no row is skipped.
create or replace function public.puzzlr_award_achievements(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  played integer;
  longest integer;
  best_memory integer;
  best_numbers integer;
  best_colors integer;
begin
  select count(*) into played from public.game_sessions where user_id = p_user;
  select coalesce(max(longest_streak), 0) into longest from public.progress where user_id = p_user;
  select
    coalesce(max(s.score) filter (where lower(g.category) = 'memory'), 0),
    coalesce(max(s.score) filter (where lower(g.category) = 'numbers'), 0),
    coalesce(max(s.score) filter (where lower(g.category) = 'colors'), 0)
    into best_memory, best_numbers, best_colors
    from public.game_sessions s
    join public.games g on g.id = s.game_id
   where s.user_id = p_user;

  insert into public.user_achievements (user_id, achievement_id, earned_at)
  select p_user, a.id, now()
    from public.achievements a
    join (values
      ('7-day streak', longest >= 7),
      ('30-day streak', longest >= 30),
      ('50 games', played >= 50),
      ('Memory gold', best_memory >= 1200),
      ('Number silver', best_numbers >= 1100),
      ('Colors gold', best_colors >= 1200)
    ) as earned(name, ok) on lower(trim(a.name)) = lower(trim(earned.name))
   where earned.ok
  on conflict (user_id, achievement_id) do nothing;
end;
$$;

create or replace function public.puzzlr_award_achievements_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.puzzlr_award_achievements(new.user_id);
  return new;
end;
$$;

drop trigger if exists puzzlr_achievements_on_session on public.game_sessions;
create trigger puzzlr_achievements_on_session
  after insert on public.game_sessions
  for each row execute function public.puzzlr_award_achievements_trigger();

drop trigger if exists puzzlr_achievements_on_progress on public.progress;
create trigger puzzlr_achievements_on_progress
  after insert or update on public.progress
  for each row execute function public.puzzlr_award_achievements_trigger();

revoke execute on function public.puzzlr_award_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.puzzlr_award_achievements_trigger() from public, anon, authenticated;
revoke execute on function public.puzzlr_update_game_stats() from public, anon, authenticated;
revoke execute on function public.puzzlr_handle_new_user() from public, anon, authenticated;

-- ---------- Friends ----------

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- One row per pair, whichever way round the request was sent.
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;

-- Only the status can be changed, and only by the addressee (accepting).
revoke update on public.friendships from anon, authenticated;
grant update (status) on public.friendships to authenticated;

drop policy if exists "friendships_select_own" on public.friendships;
drop policy if exists "friendships_insert_requester" on public.friendships;
drop policy if exists "friendships_accept_addressee" on public.friendships;
drop policy if exists "friendships_delete_either" on public.friendships;

create policy "friendships_select_own" on public.friendships
  for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));
create policy "friendships_insert_requester" on public.friendships
  for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
create policy "friendships_accept_addressee" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
create policy "friendships_delete_either" on public.friendships
  for delete to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- Sends a friend request by email. It answers the same whether or not the email has an account,
-- so it cannot be used to find out who is signed up. If they already asked you, it accepts.
create or replace function public.puzzlr_add_friend(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  other uuid;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  select u.id into other from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if other is null or other = me then
    return;
  end if;
  update public.friendships
     set status = 'accepted'
   where requester_id = other and addressee_id = me and status = 'pending';
  insert into public.friendships (requester_id, addressee_id) values (me, other) on conflict do nothing;
end;
$$;

-- Requests waiting for the signed-in player to accept, with the sender's display name only.
create or replace function public.puzzlr_friend_requests()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, p.display_name::text
    from public.friendships f
    join public.profiles p on p.id = f.requester_id
   where f.addressee_id = (select auth.uid()) and f.status = 'pending'
   order by f.created_at;
$$;

-- ---------- Leaderboard ----------

-- p_game_id is a games.category ('memory', 'numbers', 'colors') or 'all' for the best single score in any game.
-- p_period 'week' starts on Monday 00:00 UTC, 'month' on the 1st 00:00 UTC. Returns display names and scores only.
create or replace function public.puzzlr_leaderboard(p_game_id text, p_period text, p_friends_only boolean)
returns table (display_name text, score integer, rank integer, is_you boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with since as (
    select case p_period
             when 'week' then date_trunc('week', now() at time zone 'UTC') at time zone 'UTC'
             when 'month' then date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'
           end as at
  ),
  players as (
    select (select auth.uid()) as uid
    union
    select case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
      from public.friendships f
     where f.status = 'accepted'
       and (f.requester_id = (select auth.uid()) or f.addressee_id = (select auth.uid()))
  ),
  best as (
    select s.user_id, max(s.score)::integer as top
      from public.game_sessions s
      join public.games g on g.id = s.game_id
     where s.played_at >= (select at from since)
       and (p_game_id is null or lower(p_game_id) = 'all' or lower(g.category) = lower(p_game_id))
       and (not p_friends_only or s.user_id in (select uid from players))
     group by s.user_id
  )
  select p.display_name::text,
         b.top,
         (rank() over (order by b.top desc))::integer,
         b.user_id = (select auth.uid())
    from best b
    join public.profiles p on p.id = b.user_id
   where (select auth.uid()) is not null
   order by b.top desc, p.display_name
   limit 50;
$$;

revoke execute on function public.puzzlr_add_friend(text) from public, anon;
revoke execute on function public.puzzlr_friend_requests() from public, anon;
revoke execute on function public.puzzlr_leaderboard(text, text, boolean) from public, anon;
grant execute on function public.puzzlr_add_friend(text) to authenticated;
grant execute on function public.puzzlr_friend_requests() to authenticated;
grant execute on function public.puzzlr_leaderboard(text, text, boolean) to authenticated;
