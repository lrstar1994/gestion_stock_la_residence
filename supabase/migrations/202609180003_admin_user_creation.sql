-- Création administrative d'utilisateurs par invitation.
-- Dépendances : socle PIN, profiles, role_permissions, sensitive_action_audit,
-- et profile_location_access / set_profile_location_access de 202609160001.

insert into stock.role_permissions(role, permission)
values ('direction'::stock.user_role, 'profiles.create_direction')
on conflict (role, permission) do nothing;

delete from stock.role_permissions
where permission = 'profiles.create_direction'
  and role <> 'direction'::stock.user_role;

create or replace function stock.list_user_creation_roles()
returns text[]
language plpgsql
stable
security definer
set search_path = pg_catalog, stock, auth
as $$
declare
  v_roles text[];
begin
  if not exists (
    select 1 from stock.profiles p
    where p.user_id = auth.uid()
      and p.role = 'direction'::stock.user_role
      and p.status = 'active'::stock.user_status
  ) then
    raise exception 'Profil Direction actif requis';
  end if;

  select array_agg(r.role_value::text order by r.ordinality)
    into v_roles
  from unnest(enum_range(null::stock.user_role)) with ordinality as r(role_value, ordinality);

  return coalesce(v_roles, '{}'::text[]);
end;
$$;

revoke all on function stock.list_user_creation_roles() from public, anon;
grant execute on function stock.list_user_creation_roles() to authenticated;

create or replace function stock.finalize_invited_user_profile(
  p_auth_user_id uuid,
  p_full_name text,
  p_role stock.user_role,
  p_status stock.user_status,
  p_location_ids uuid[] default '{}'::uuid[],
  p_direction_pin text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_actor_id uuid;
  v_profile_id uuid;
  v_location_ids uuid[] := coalesce(p_location_ids, '{}'::uuid[]);
begin
  select p.id into v_actor_id
  from stock.profiles p
  where p.user_id = auth.uid()
    and p.role = 'direction'::stock.user_role
    and p.status = 'active'::stock.user_status
  for update;

  if v_actor_id is null then
    raise exception 'Profil Direction actif requis';
  end if;
  if p_auth_user_id is null then
    raise exception 'Compte Auth cible requis';
  end if;
  if nullif(btrim(p_full_name), '') is null or char_length(btrim(p_full_name)) < 2 then
    raise exception 'Le nom complet doit contenir au moins 2 caractères';
  end if;
  if p_status not in ('active'::stock.user_status, 'inactive'::stock.user_status) then
    raise exception 'Statut utilisateur invalide';
  end if;
  if coalesce(cardinality(v_location_ids), 0) <> (
    select count(distinct location_id) from unnest(v_location_ids) as x(location_id)
  ) then
    raise exception 'Une localisation est sélectionnée plusieurs fois';
  end if;
  if p_role in ('direction'::stock.user_role, 'controleur'::stock.user_role)
    and cardinality(v_location_ids) > 0 then
    raise exception 'Direction et Contrôleur ne nécessitent pas d’affectation de localisation';
  end if;

  if p_role = 'direction'::stock.user_role then
    perform stock.assert_sensitive_action(
      'profiles.create_direction', p_direction_pin,
      'profile.create_direction', 'profile', null, null,
      jsonb_build_object('role', p_role::text)
    );
  end if;

  select p.id into v_profile_id
  from stock.profiles p
  where p.user_id = p_auth_user_id
  for update;

  if v_profile_id is null then
    raise exception 'Le compte Auth existe mais son profil stock est absent';
  end if;
  if exists (
    select 1 from stock.profiles p
    where p.id = v_profile_id and p.status <> 'pending_validation'::stock.user_status
  ) then
    raise exception 'Le profil cible n’est pas un nouveau profil en attente';
  end if;

  update stock.profiles
  set full_name = btrim(p_full_name),
      role = p_role,
      status = p_status,
      created_by = v_actor_id,
      validated_by = v_actor_id,
      validated_at = now(),
      rejected_at = null,
      rejection_reason = null,
      updated_at = now()
  where id = v_profile_id;

  -- Cette fonction valide les localisations, réactive les affectations retenues,
  -- désactive les autres et renseigne created_by / updated_by.
  perform stock.set_profile_location_access(v_profile_id, v_location_ids);

  insert into stock.sensitive_action_audit(
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, metadata
  ) values (
    v_actor_id, 'profile.created', 'direction.active', 'profile', v_profile_id,
    'completed', jsonb_build_object(
      'role', p_role::text,
      'status', p_status::text,
      'initial_location_ids', to_jsonb(v_location_ids)
    )
  );

  return v_profile_id;
end;
$$;

revoke all on function stock.finalize_invited_user_profile(uuid, text, stock.user_role, stock.user_status, uuid[], text)
  from public, anon;
grant execute on function stock.finalize_invited_user_profile(uuid, text, stock.user_role, stock.user_status, uuid[], text)
  to authenticated;
