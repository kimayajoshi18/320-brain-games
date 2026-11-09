-- Seeds the achievements the app defines (src/data/achievements.ts). Safe to re-run.
-- Run after supabase/backend_sprint4.sql. The last statement awards them for games already played.

create unique index if not exists achievements_name_key on public.achievements (name);

-- The app has no tiers, so the gold and silver ones use the word from their name and the rest are 'milestone'.
-- The rules live in puzzlr_award_achievements (backend_sprint4.sql), matched by name.
do $$
declare
  has_default boolean;
begin
  select column_default is not null or is_identity = 'YES' into has_default
    from information_schema.columns
   where table_schema = 'public' and table_name = 'achievements' and column_name = 'id';

  if has_default then
    insert into public.achievements (name, tier, description)
    select v.name, v.tier, v.description
      from (values
        ('7-day streak', 'milestone', 'Finish the daily three 7 days in a row'),
        ('Memory gold', 'gold', 'Score 1,200 in Memory'),
        ('50 games', 'milestone', 'Play 50 games'),
        ('Number silver', 'silver', 'Score 1,100 in Numbers'),
        ('30-day streak', 'milestone', 'Finish the daily three 30 days in a row'),
        ('Colors gold', 'gold', 'Score 1,200 in Colors')
      ) as v(name, tier, description)
    on conflict (name) do nothing;
  else
    insert into public.achievements (id, name, tier, description)
    select (select coalesce(max(id), 0) from public.achievements) + row_number() over (order by v.ord),
           v.name, v.tier, v.description
      from (values
        (1, '7-day streak', 'milestone', 'Finish the daily three 7 days in a row'),
        (2, 'Memory gold', 'gold', 'Score 1,200 in Memory'),
        (3, '50 games', 'milestone', 'Play 50 games'),
        (4, 'Number silver', 'silver', 'Score 1,100 in Numbers'),
        (5, '30-day streak', 'milestone', 'Finish the daily three 30 days in a row'),
        (6, 'Colors gold', 'gold', 'Score 1,200 in Colors')
      ) as v(ord, name, tier, description)
     where not exists (select 1 from public.achievements a where a.name = v.name)
    on conflict (name) do nothing;
  end if;
end $$;

-- Award what players have already earned.
select public.puzzlr_award_achievements(u.user_id)
  from (select user_id from public.game_sessions union select user_id from public.progress) u;
