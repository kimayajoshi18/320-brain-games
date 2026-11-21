-- Color & Word (the Stroop test) as the fourth daily game.
-- Run after supabase/streak_fixes.sql, in the Supabase SQL editor. Safe to re-run.
--
-- Sessions, best scores, the leaderboard and achievements already work for any row in `games`,
-- so this adds the game and makes the streak aware of when each game joined the daily set.
-- Without that, adding a fourth game would make every earlier three-game day stop counting and
-- reset everyone's streak.

-- ---------- The game ----------

alter table public.games drop constraint if exists games_category_check;
alter table public.games
  add constraint games_category_check check (category in ('memory', 'numbers', 'colors', 'colorword'));

-- First day a game is part of the daily set; null means from the start.
-- The app has the same date in src/data/games.ts (COLORWORD_DAILY_FROM).
alter table public.games add column if not exists daily_from date;

-- games.id has no default, so take the next one.
insert into public.games (id, name, category, description, how_it_helps, daily_from)
select (select coalesce(max(id), 0) + 1 from public.games),
       'Color & Word',
       'colorword',
       'Pick the color of the ink a color name is printed in, not the word.',
       'Practices ignoring a distraction to stay on task (the Stroop effect).',
       date '2026-11-21'
 where not exists (select 1 from public.games where category = 'colorword');

-- ---------- Streak ----------

-- Same as streak_fixes.sql, except a day counts once the player has a session for every game
-- that was part of the daily set on that day (daily_from on or before it).
create or replace function public.puzzlr_recompute_progress(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
  best_run integer;
  cur_run integer;
  last_day date;
begin
  select p.timezone into tz from public.profiles p where p.id = p_user;
  if tz is null or not exists (select 1 from pg_catalog.pg_timezone_names n where n.name = tz) then
    tz := 'UTC';
  end if;
  if not exists (select 1 from public.games) then
    return;
  end if;

  with played as (
    select (s.played_at at time zone tz)::date as d, s.game_id
      from public.game_sessions s
     where s.user_id = p_user
     group by 1, 2
  ),
  days as (
    select distinct p.d
      from played p
     where not exists (
       select 1
         from public.games g
        where (g.daily_from is null or g.daily_from <= p.d)
          and not exists (select 1 from played q where q.d = p.d and q.game_id = g.id)
     )
  ),
  runs as (
    select d, d - (row_number() over (order by d))::integer as grp from days
  ),
  sized as (
    select count(*)::integer as len, max(d) as last_d from runs group by grp
  )
  select max(len),
         (select z.len from sized z order by z.last_d desc limit 1),
         max(last_d)
    into best_run, cur_run, last_day
    from sized;

  if last_day is null then
    return;
  end if;

  insert into public.progress (user_id, current_streak, longest_streak, last_played_day)
  values (p_user, cur_run, best_run, last_day)
  on conflict (user_id) do update
    set current_streak  = excluded.current_streak,
        longest_streak  = greatest(progress.longest_streak, excluded.longest_streak),
        last_played_day = excluded.last_played_day;
end;
$$;

revoke execute on function public.puzzlr_recompute_progress(uuid) from public, anon, authenticated;

-- ---------- Wording ----------

update public.achievements set description = 'Finish all the daily games 7 days in a row' where name = '7-day streak';
update public.achievements set description = 'Finish all the daily games 30 days in a row' where name = '30-day streak';

-- Recompute stored streaks with the new rule (nothing changes for days before Color & Word joined).
select public.puzzlr_recompute_progress(u.user_id)
  from (select distinct user_id from public.game_sessions) u;
