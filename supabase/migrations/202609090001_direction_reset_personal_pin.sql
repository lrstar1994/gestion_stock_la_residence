-- Préparation locale uniquement. Application TEST soumise à validation explicite.
insert into stock.role_permissions(role, permission)
values ('direction'::stock.user_role, 'profile_pins.reset')
on conflict (role, permission) do nothing;
delete from stock.role_permissions
where permission = 'profile_pins.reset' and role <> 'direction'::stock.user_role;

create or replace function stock.reset_profile_pin_for_user(p_target_profile_id uuid, p_direction_pin text)
returns void language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_actor uuid;
  v_deleted integer;
begin
  v_actor := stock.current_profile_id();
  if v_actor is null then raise exception 'Profil Direction actif requis'; end if;
  if p_target_profile_id is null then raise exception 'Profil cible requis'; end if;
  if p_target_profile_id = v_actor then
    raise exception 'La réinitialisation doit concerner un autre utilisateur';
  end if;
  -- Ordre commun pour deux Directions qui se réinitialisent mutuellement.
  -- Le verrou profil existe même lorsqu'aucune ligne PIN n'existe.
  perform id from stock.profiles where id in (v_actor, p_target_profile_id) order by id for update;
  if not exists (select 1 from stock.profiles where id = v_actor
      and user_id = auth.uid() and role = 'direction'::stock.user_role
      and status = 'active'::stock.user_status) then
    raise exception 'Profil Direction actif requis';
  end if;
  if not exists (select 1 from stock.profiles where id = p_target_profile_id) then
    raise exception 'Profil cible introuvable';
  end if;
  perform stock.assert_sensitive_action('profile_pins.reset', p_direction_pin,
    'profile_pin.reset', 'profile', p_target_profile_id, null, '{}'::jsonb);
  delete from stock.profile_pins where profile_id = p_target_profile_id;
  get diagnostics v_deleted = row_count;
  insert into stock.sensitive_action_audit
    (actor_profile_id, action_code, required_permission, entity_type, entity_id, outcome, metadata)
  values (v_actor, 'profile_pin.reset', 'profile_pins.reset', 'profile', p_target_profile_id,
    'completed', jsonb_build_object('had_pin', v_deleted > 0));
end;
$$;
revoke all on function stock.reset_profile_pin_for_user(uuid, text) from public, anon;
grant execute on function stock.reset_profile_pin_for_user(uuid, text) to authenticated;

-- Même mécanisme bcrypt, avec sérialisation reset/définition et audit sans secret.
create or replace function stock.set_my_personal_pin(p_new_pin text, p_current_pin text default null)
returns void language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_existing_hash text;
begin
  select id into v_profile_id from stock.profiles
  where user_id = auth.uid() and status = 'active'::stock.user_status for update;
  if v_profile_id is null then raise exception 'Profil actif introuvable'; end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4,8}$' then
    raise exception 'Le PIN doit contenir entre 4 et 8 chiffres';
  end if;
  select pin_hash into v_existing_hash from stock.profile_pins
  where profile_id = v_profile_id for update;
  if v_existing_hash is not null and
    (p_current_pin is null or extensions.crypt(p_current_pin, v_existing_hash) <> v_existing_hash) then
    raise exception 'PIN actuel invalide';
  end if;
  insert into stock.profile_pins(profile_id, pin_hash)
  values (v_profile_id, extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)))
  on conflict (profile_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  insert into stock.sensitive_action_audit
    (actor_profile_id, action_code, required_permission, entity_type, entity_id, outcome)
  values (v_profile_id, case when v_existing_hash is null then 'profile_pin.set' else 'profile_pin.change' end,
    'self', 'profile', v_profile_id, 'completed');
  -- 'self' décrit ici le contrôle de propriété auth.uid(), pas une permission de rôle.
end;
$$;
revoke all on function stock.set_my_personal_pin(text, text) from public, anon;
grant execute on function stock.set_my_personal_pin(text, text) to authenticated;
