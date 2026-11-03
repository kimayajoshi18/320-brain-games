-- Game progress for signed-in players.
-- Run once in the Supabase SQL Editor. Safe to run again.

-- 1. The details the app shows for a past game. The score alone isn't enough
--    (Numbers shows a time, Colors shows "5/5", results show stat chips).
alter table public.game_sessions
  add column if not exists duration_sec integer check (duration_sec >= 0),
  add column if not exists details jsonb;

-- 2. Players can only read user_game_stats, so the trigger that fills it from
--    game_sessions has to run with the table owner's rights.
alter function public.puzzlr_update_game_stats() security definer set search_path = '';

-- 3. Keep `progress` (the daily-three streak) up to date. A day counts once every
--    game has been played at least once on it, in the player's own time zone.
--    last_played_day is the last day the daily three were finished.
create or replace function public.puzzlr_update_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text;
  play_day date;
  last_day date;
  streak integer;
begin
  select p.timezone into tz from public.profiles p where p.id = new.user_id;
  if tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    tz := 'UTC';
  end if;
  play_day := (new.played_at at time zone tz)::date;

  -- The day isn't finished until every game has a session on it.
  if (select count(distinct s.game_id)
        from public.game_sessions s
       where s.user_id = new.user_id
         and (s.played_at at time zone tz)::date = play_day)
     < (select count(*) from public.games) then
    return new;
  end if;

  insert into public.progress (user_id) values (new.user_id) on conflict (user_id) do nothing;
  select pr.last_played_day, pr.current_streak into last_day, streak
    from public.progress pr
   where pr.user_id = new.user_id
     for update;

  -- Already counted, or an older day uploaded late: nothing to change.
  if last_day is not null and last_day >= play_day then
    return new;
  end if;

  streak := case when last_day = play_day - 1 then streak + 1 else 1 end;
  update public.progress
     set current_streak = streak,
         longest_streak = greatest(longest_streak, streak),
         last_played_day = play_day
   where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists puzzlr_progress_on_session on public.game_sessions;
create trigger puzzlr_progress_on_session
  after insert on public.game_sessions
  for each row execute function public.puzzlr_update_progress();
