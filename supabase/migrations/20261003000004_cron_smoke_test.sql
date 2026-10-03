-- ============================================================================
-- Smoke-test the two weekly economy functions.
--
-- Both are revoked from anon and authenticated, so the only ways to execute
-- them are pg_cron (which runs as postgres) and a migration (which also runs as
-- postgres). That means a planning error in either — most plausibly the
-- `for update of` on the racket cursor's joined query — would otherwise stay
-- invisible until 02:55 on a Monday, and then fail into a log nobody reads.
--
-- Calling them here proves the bodies plan and execute. Both are idempotent per
-- ISO week, so running them now cannot double-charge anybody or pay a racket
-- twice when the real schedule fires.
-- ============================================================================

do $$
declare
  v_rackets jsonb;
  v_kickup  jsonb;
begin
  v_rackets := public.run_weekly_rackets();
  v_kickup  := public.run_weekly_kickup();

  raise notice 'run_weekly_rackets() -> %', v_rackets;
  raise notice 'run_weekly_kickup()  -> %', v_kickup;

  -- Both must return a shaped result rather than null.
  if v_rackets is null or v_kickup is null then
    raise exception 'A weekly economy function returned null.' using errcode = 'P0001';
  end if;
  if not (v_rackets ? 'week_start') or not (v_kickup ? 'week_start') then
    raise exception 'A weekly economy function returned an unexpected shape.'
      using errcode = 'P0001';
  end if;
end $$;

-- Confirm both jobs are actually registered, so a silently-missing schedule
-- cannot pass for a working one.
do $$
declare
  v_jobs int;
begin
  select count(*) into v_jobs
  from cron.job
  where jobname in ('weekly-rackets', 'weekly-kickup');

  if v_jobs <> 2 then
    raise exception 'Expected 2 scheduled jobs, found %.', v_jobs using errcode = 'P0001';
  end if;
end $$;
