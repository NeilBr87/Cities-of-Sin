-- ============================================================================
-- Fix the function grant model.
--
-- The earlier migrations revoked EXECUTE from PUBLIC and assumed that was
-- enough. It was not. Supabase ships default privileges that grant EXECUTE on
-- functions in `public` DIRECTLY to the `anon` and `authenticated` roles, so a
-- revoke aimed at PUBLIC leaves those grants untouched.
--
-- The observable effect: every internal helper — apply_tick(), require_*(),
-- family_json(), and worst of all run_weekly_kickup() — was callable by anybody
-- holding the anon key. None of them could be made to leak another player's
-- data or move money into the caller's pocket, because they all either check
-- auth.uid() themselves or are keyed to a character the caller must own, and
-- run_weekly_kickup() is idempotent per ISO week. But an anonymous caller could
-- still have forced the weekly collection to run early, which is a real effect
-- on a live economy.
--
-- This migration revokes from the actual roles and re-grants exactly the
-- intended surface.
--
-- ⚠️ NOTE FOR EVERY FUTURE MIGRATION: default privileges are flipped to
-- deny at the bottom of this file. A new RPC is unreachable until you add an
-- explicit `grant execute ... to authenticated`. That is deliberate — forgetting
-- a grant produces a loud "permission denied", whereas forgetting a revoke
-- produces a silent hole.
-- ============================================================================

-- ------------------------------------------------ take it all back first --

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      -- Leave the auth trigger alone: it is fired by supabase_auth_admin during
      -- signup, and is harmless to call directly (it returns a trigger type and
      -- errors immediately outside a trigger context).
      and p.proname <> 'handle_new_user'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;

-- ---------------------------------------------------- signed-out surface --

-- The signup form checks a username before a session exists. That is the only
-- thing an anonymous visitor needs. (The landing page reads cities and districts
-- straight through PostgREST, which is table RLS, not a function.)
grant execute on function public.username_available(text) to anon, authenticated;

-- ------------------------------------------------- signed-in surface: M1 --

grant execute on function
  public.get_me(),
  public.create_character(text, text, text, public.life_path, text),
  public.list_crimes(),
  public.commit_crime(text),
  public.move_to_district(text),
  public.fly_to_city(text),
  public.launder(bigint),
  public.vault_deposit(bigint),
  public.vault_withdraw(bigint),
  public.post_bail(),
  public.send_chat(text, text),
  public.update_bio(text),
  public.leaderboard(text)
to authenticated;

-- Called from inside RLS policy expressions, which evaluate as the querying
-- role rather than as a definer. Without these the policies fail closed and the
-- game reads as completely empty.
grant execute on function
  public.can_read_channel(text),
  public.current_character_id(),
  public.is_banned()
to authenticated;

-- ------------------------------------------------- signed-in surface: M2 --

grant execute on function
  public.list_families(text),
  public.get_family(uuid),
  public.found_family(text, text, text),
  public.update_family(text, text, text),
  public.disband_family(),
  public.join_family(uuid),
  public.leave_family(),
  public.make_member(uuid),
  public.promote_to_captain(uuid, text),
  public.demote_captain(uuid),
  public.kick_from_family(uuid),
  public.join_crew(uuid),
  public.leave_crew(),
  public.kick_from_crew(uuid),
  public.vote_out_boss(),
  public.family_deposit(bigint),
  public.family_withdraw(bigint),
  public.expand_to_city(text)
to authenticated;

-- Everything not named above is now callable only by the definer — which is
-- exactly what the internal helpers need, since a SECURITY DEFINER function
-- runs as its owner and needs no grant to call another of its own kind:
--   cfg, clamp, display_name, crime_success_chance, apply_tick,
--   require_character, require_mafia, crew_name_for, family_json,
--   run_weekly_kickup
--
-- run_weekly_kickup() is now reachable only from pg_cron (which runs as
-- postgres) or from a SQL editor session.

-- ----------------------------------------------------------- deny by default --

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;
