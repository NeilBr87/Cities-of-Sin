-- ============================================================================
-- Schedule the weekly economy.
--
-- PREREQUISITE: pg_cron must be enabled first, in the Supabase dashboard under
--   Database -> Extensions -> search "pg_cron" -> toggle on
--
-- This migration deliberately FAILS if the extension is missing, rather than
-- printing a notice and being marked as applied. A migration that silently did
-- nothing would leave the economy permanently frozen with no trace of why — the
-- kick-up and racket income would simply never run, and the only symptom would
-- be players wondering where their money was.
--
-- Both earlier migrations (the M2 kick-up and the M3 racket payout) carried
-- guarded blocks that tried to schedule and found no pg_cron. Migrations only
-- run once, so this file is what actually does it.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception
      'pg_cron is not enabled. Turn it on in the dashboard (Database -> Extensions -> pg_cron), then run this migration again.'
      using errcode = 'P0001';
  end if;
end $$;

-- Idempotent: drop any previous definition of each job before re-creating it,
-- so this file is safe to re-run and safe to edit later.
do $$
begin
  perform cron.unschedule('weekly-rackets')
    where exists (select 1 from cron.job where jobname = 'weekly-rackets');
  perform cron.unschedule('weekly-kickup')
    where exists (select 1 from cron.job where jobname = 'weekly-kickup');

  -- Order matters. Rackets pay out five minutes before the kick-up collects, so
  -- racket income is in hand and gets taxed in the same week it was earned.
  -- Monday 02:55 UTC, then 03:00 UTC.
  perform cron.schedule('weekly-rackets', '55 2 * * 1', 'select public.run_weekly_rackets()');
  perform cron.schedule('weekly-kickup',  '0 3 * * 1',  'select public.run_weekly_kickup()');
end $$;

-- Both functions are idempotent per ISO week — the kick-up through a unique
-- index on (week_start, from_id), racket income through rackets.last_paid_week —
-- so a retry, an overlapping run or a manual trigger cannot double-charge
-- anybody or pay a racket twice.

comment on function public.run_weekly_kickup() is
  'Weekly 10% kick-up. Scheduled Mondays 03:00 UTC. Idempotent per ISO week.';
comment on function public.run_weekly_rackets() is
  'Weekly racket income. Scheduled Mondays 02:55 UTC. Idempotent per ISO week.';
