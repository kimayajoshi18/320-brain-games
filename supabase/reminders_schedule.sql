-- Hourly reminder emails. Safe to re-run. Run after supabase/backend_sprint4.sql.
-- Deploy the send-reminders function first and create the two vault secrets (see the steps below).
--
-- Vault secrets this file reads (create them once in the SQL editor):
--   select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'project_url');
--   select vault.create_secret('THE-SAME-VALUE-AS-REMINDERS_CRON_SECRET', 'reminders_cron_secret');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Players whose saved reminder hour is the current hour in their own time zone and who have not
-- finished every game today. Only the service role can call this.
create or replace function public.puzzlr_reminder_targets()
returns table (user_id uuid, email text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  with zoned as (
    select p.id,
           p.display_name,
           p.reminder,
           case when exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p.timezone)
                then p.timezone else 'UTC' end as tz
      from public.profiles p
     where p.reminder is not null
  ),
  hours as (
    select z.*,
           (now() at time zone z.tz) as local_now,
           case when z.reminder ~* '^\s*\d{1,2}:\d{2}\s*(am|pm)\s*$'
                then extract(hour from to_timestamp(lower(trim(z.reminder)), 'HH12:MIam')::timestamp)::integer
           end as reminder_hour
      from zoned z
  )
  select l.id, u.email::text, l.display_name::text
    from hours l
    join auth.users u on u.id = l.id
   where u.email is not null
     and extract(hour from l.local_now)::integer = l.reminder_hour
     and (select count(distinct s.game_id)
            from public.game_sessions s
           where s.user_id = l.id
             and (s.played_at at time zone l.tz)::date = l.local_now::date)
         < (select count(*) from public.games);
$$;

revoke execute on function public.puzzlr_reminder_targets() from public, anon, authenticated;
grant execute on function public.puzzlr_reminder_targets() to service_role;

-- Run at the start of every hour.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-reminders') then
    perform cron.unschedule('send-reminders');
  end if;
end $$;

select cron.schedule(
  'send-reminders',
  '0 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
