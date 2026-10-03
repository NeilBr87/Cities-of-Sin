-- ============================================================================
-- Extend get_me() with family and crew standing.
--
-- CREATE OR REPLACE keeps the existing grants, so the authenticated role does
-- not lose access when this runs.
-- ============================================================================

create or replace function public.get_me()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c        public.characters%rowtype;
  v_id     uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = 'P0001';
  end if;

  select id into v_id
  from public.characters
  where profile_id = auth.uid() and died_at is null
  limit 1;

  -- Signed in with no character yet is a normal state, not an error: the client
  -- routes to character creation on a null character.
  if v_id is null then
    select jsonb_build_object(
      'character', null,
      'profile', to_jsonb(p) - 'id',
      'vault', coalesce(v.balance, 0),
      'has_dead_character', exists (
        select 1 from public.characters
        where profile_id = auth.uid() and died_at is not null
      )
    )
    into v_result
    from public.profiles p
    left join public.vaults v on v.profile_id = p.id
    where p.id = auth.uid();
    return v_result;
  end if;

  c := public.apply_tick(v_id);

  select jsonb_build_object(
    'character', to_jsonb(c)
      || jsonb_build_object(
           'display_name', public.display_name(c),
           'jailed', c.jail_until is not null and c.jail_until > now(),
           'jail_seconds_left', greatest(0, extract(epoch from (coalesce(c.jail_until, now()) - now()))::int),
           'immune', c.immune_until > now()
         ),
    'city', to_jsonb(ct),
    'district', to_jsonb(d),
    'profile', to_jsonb(p) - 'id',
    'vault', coalesce(vt.balance, 0),
    -- Enough to render the header and gate the menus. The full roster comes
    -- from get_family() when the player actually opens the family page.
    'family', case when fam.id is null then null else jsonb_build_object(
        'id', fam.id,
        'name', fam.name,
        'logo', fam.logo,
        'motto', fam.motto,
        'city_id', fam.city_id,
        'treasury', fam.treasury,
        'is_boss', fam.boss_id = c.id
      ) end,
    'crew', case when cw.id is null then null else jsonb_build_object(
        'id', cw.id,
        'name', cw.name,
        'district_id', cw.district_id,
        'is_captain', cw.captain_id = c.id
      ) end,
    'server_time', now()
  )
  into v_result
  from public.cities ct
  join public.districts d on d.id = c.district_id
  join public.profiles p on p.id = c.profile_id
  left join public.vaults vt on vt.profile_id = c.profile_id
  left join public.families fam on fam.id = c.family_id and fam.disbanded_at is null
  left join public.crews cw on cw.id = c.crew_id
  where ct.id = c.city_id;

  return v_result;
end;
$$;
