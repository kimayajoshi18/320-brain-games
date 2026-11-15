-- Streak fixes. Run after supabase/game_progress.sql and supabase/backend_sprint4.sql. Safe to re-run.
-- A day counts once every game has a session on it, in the player's own time zone (profiles.timezone).
-- The streak is worked out again from all of the player's sessions each time, so a session that
-- arrives late (played offline, uploaded later, in any order) can no longer be skipped.

create or replace function public.puzzlr_recompute_progress(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
  needed integer;
  best_run integer;
  cur_run integer;
  last_day date;
begin
  select p.timezone into tz from public.profiles p where p.id = p_user;
  if tz is null or not exists (select 1 from pg_catalog.pg_timezone_names n where n.name = tz) then
    tz := 'UTC';
  end if;
  select count(*) into needed from public.games;
  if needed = 0 then
    return;
  end if;

  with days as (
    select (s.played_at at time zone tz)::date as d
      from public.game_sessions s
     where s.user_id = p_user
     group by 1
    having count(distinct s.game_id) >= needed
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

create or replace function public.puzzlr_update_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.puzzlr_recompute_progress(new.user_id);
  return new;
end;
$$;

drop trigger if exists puzzlr_progress_on_session on public.game_sessions;
create trigger puzzlr_progress_on_session
  after insert on public.game_sessions
  for each row execute function public.puzzlr_update_progress();

revoke execute on function public.puzzlr_recompute_progress(uuid) from public, anon, authenticated;
revoke execute on function public.puzzlr_update_progress() from public, anon, authenticated;

-- Fix the numbers already stored.
select public.puzzlr_recompute_progress(u.user_id)
  from (select distinct user_id from public.game_sessions) u;
