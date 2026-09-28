-- Par défaut, un article stockable n'est pas limité par les anciennes lignes
-- article_locations. Une restriction ne s'applique qu'après opt-in explicite.
alter table stock.articles
  add column if not exists locations_restricted boolean not null default false;

comment on column stock.articles.locations_restricted is
  'Lorsque true, article_locations contient les localisations autorisées. False autorise toutes les localisations actives; les liens historiques restent conservés comme données legacy.';

create or replace function stock.article_location_allowed(
  p_article_id uuid,
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, stock
as $$
  select exists (
    select 1
    from stock.articles a
    where a.id = p_article_id
      and p_location_id is not null
      and exists (
        select 1 from stock.locations l
        where l.id = p_location_id and l.is_active
      )
      and (
        not a.locations_restricted
        or exists (
      select 1
      from stock.article_locations al
      where al.article_id = a.id
        and al.location_id = p_location_id
        )
      )
  )
$$;
revoke all on function stock.article_location_allowed(uuid, uuid) from public, anon, authenticated;

-- Défense au niveau base : toutes les écritures de mouvement respectent une
-- restriction explicite, quelle que soit l'interface ou la RPC appelante.
create or replace function stock.enforce_article_location_restriction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, stock
as $$
begin
  if new.from_location_id is not null
     and not stock.article_location_allowed(new.article_id, new.from_location_id) then
    raise exception 'Cet article n’est pas autorisé dans la localisation d’origine';
  end if;

  if new.to_location_id is not null
     and not stock.article_location_allowed(new.article_id, new.to_location_id) then
    raise exception 'Cet article n’est pas autorisé dans la localisation de destination';
  end if;

  return new;
end;
$$;
revoke all on function stock.enforce_article_location_restriction() from public, anon, authenticated;
drop trigger if exists stock_movement_article_location_guard on stock.stock_movements;
create trigger stock_movement_article_location_guard
before insert or update of article_id, from_location_id, to_location_id
on stock.stock_movements
for each row execute function stock.enforce_article_location_restriction();

-- Les liens et le mode de restriction sont enregistrés atomiquement.
create or replace function stock.set_article_location_restriction(
  p_article_id uuid,
  p_locations_restricted boolean,
  p_location_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, stock, auth
as $$
declare
  v_location_id uuid;
  v_stockable boolean;
  v_location_ids uuid[] := coalesce(p_location_ids, '{}'::uuid[]);
begin
  if not stock.can_current_user_manage_catalog() then
    raise exception 'Permission catalogue requise pour modifier les localisations de cet article';
  end if;

  select stockable into v_stockable
  from stock.articles where id = p_article_id for update;
  if not found then raise exception 'Article introuvable'; end if;

  if coalesce(p_locations_restricted, false) and v_stockable then
    if cardinality(v_location_ids) = 0 then
      raise exception 'Sélectionnez au moins une localisation autorisée';
    end if;
    if cardinality(v_location_ids) <> (
      select count(distinct requested.location_id)
      from unnest(v_location_ids) as requested(location_id)
    ) then
      raise exception 'Une localisation est sélectionnée plusieurs fois';
    end if;
    if exists (
      select 1
      from unnest(v_location_ids) requested(location_id)
      left join stock.locations l on l.id = requested.location_id
      where requested.location_id is null or l.id is null
        or (not l.is_active and not exists (
          select 1 from stock.article_locations old_link
          where old_link.article_id = p_article_id
            and old_link.location_id = l.id
        ))
    ) then
      raise exception 'Une localisation sélectionnée est introuvable ou inactive';
    end if;

    delete from stock.article_locations where article_id = p_article_id;
    foreach v_location_id in array v_location_ids
    loop
      insert into stock.article_locations(article_id, location_id)
      values (p_article_id, v_location_id);
    end loop;
    update stock.articles set locations_restricted = true where id = p_article_id;
  else
    update stock.articles set locations_restricted = false where id = p_article_id;
  end if;
end;
$$;
revoke all on function stock.set_article_location_restriction(uuid, boolean, uuid[]) from public, anon;
grant execute on function stock.set_article_location_restriction(uuid, boolean, uuid[]) to authenticated;

create or replace function stock.create_article_with_location_restriction(
  p_payload jsonb,
  p_location_ids uuid[],
  p_profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, stock, auth
as $$
declare
  v_actor uuid;
  v_article_id uuid;
  v_stockable boolean;
  v_locations_restricted boolean;
  v_location_ids uuid[] := coalesce(p_location_ids, '{}'::uuid[]);
  v_location_id uuid;
begin
  if not stock.can_current_user_manage_catalog() then
    raise exception 'Permission catalogue requise pour créer un article';
  end if;
  select id into v_actor from stock.profiles
  where user_id = auth.uid() and status = 'active'
  limit 1;
  if v_actor is null then raise exception 'Profil actif requis'; end if;
  if p_profile_id is not null and p_profile_id is distinct from v_actor then
    raise exception 'Le profil créateur ne correspond pas à la session';
  end if;

  v_stockable := coalesce((p_payload->>'stockable')::boolean, true);
  v_locations_restricted := v_stockable and coalesce((p_payload->>'locations_restricted')::boolean, false);
  if v_locations_restricted then
    if cardinality(v_location_ids) = 0 then
      raise exception 'Sélectionnez au moins une localisation autorisée';
    end if;
    if cardinality(v_location_ids) <> (
      select count(distinct requested.location_id)
      from unnest(v_location_ids) as requested(location_id)
    ) then
      raise exception 'Une localisation est sélectionnée plusieurs fois';
    end if;
    if exists (
      select 1 from unnest(v_location_ids) as requested(location_id)
      left join stock.locations l on l.id = requested.location_id
      where requested.location_id is null or l.id is null or not l.is_active
    ) then
      raise exception 'Une localisation sélectionnée est introuvable ou inactive';
    end if;
  end if;

  insert into stock.articles (
    name, family_id, sub_family, unit_id, packaging, default_supplier,
    min_stock, sellable_without_transformation, usable_in_recipes, nature,
    stockable, locations_restricted, durable_equipment, indicative_price,
    indicative_price_note, status, created_by, updated_by
  ) values (
    btrim(p_payload->>'name'),
    (p_payload->>'family_id')::uuid,
    nullif(p_payload->>'sub_family', ''),
    (p_payload->>'unit_id')::uuid,
    nullif(p_payload->>'packaging', ''),
    nullif(p_payload->>'default_supplier', ''),
    coalesce((p_payload->>'min_stock')::numeric, 0),
    coalesce((p_payload->>'sellable_without_transformation')::boolean, false),
    coalesce((p_payload->>'usable_in_recipes')::boolean, false),
    coalesce(nullif(p_payload->>'nature', ''), 'autre'),
    v_stockable,
    v_locations_restricted,
    coalesce((p_payload->>'durable_equipment')::boolean, false),
    nullif(p_payload->>'indicative_price', '')::numeric,
    nullif(p_payload->>'indicative_price_note', ''),
    coalesce(nullif(p_payload->>'status', '')::stock.article_status, 'active'::stock.article_status),
    v_actor,
    v_actor
  ) returning id into v_article_id;

  if v_locations_restricted then
    foreach v_location_id in array v_location_ids
    loop
      insert into stock.article_locations(article_id, location_id)
      values (v_article_id, v_location_id);
    end loop;
  end if;
  return v_article_id;
end;
$$;
revoke all on function stock.create_article_with_location_restriction(jsonb, uuid[], uuid) from public, anon;
grant execute on function stock.create_article_with_location_restriction(jsonb, uuid[], uuid) to authenticated;

-- Empêche une écriture directe de rendre un article inaccessible à toutes les
-- localisations ou de contourner le RPC transactionnel.
create or replace function stock.guard_article_location_restriction_flag()
returns trigger
language plpgsql
set search_path = pg_catalog, stock
as $$
declare
  v_table_owner name;
begin
  select pg_get_userbyid(c.relowner)::name into v_table_owner
  from pg_catalog.pg_class c
  where c.oid = 'stock.articles'::regclass;

  if current_user <> v_table_owner then
    if tg_op = 'INSERT' then
      if new.locations_restricted then
        raise exception 'Utilisez l’action catalogue pour configurer les localisations autorisées';
      end if;
    elsif old.locations_restricted is distinct from new.locations_restricted then
      raise exception 'Utilisez l’action catalogue pour configurer les localisations autorisées';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function stock.guard_article_location_restriction_flag() from public, anon, authenticated;
drop trigger if exists article_location_restriction_flag_guard on stock.articles;
create trigger article_location_restriction_flag_guard
before insert or update of locations_restricted on stock.articles
for each row execute function stock.guard_article_location_restriction_flag();

-- L'édition sensible garde son contrôle permission/PIN existant. Le flag est
-- enregistré avec les autres champs dans la même transaction; les anciennes
-- associations ne sont remplacées que lors d'une restriction explicite.
create or replace function stock.update_article_sensitive_with_pin(
  p_article_id uuid,
  p_payload jsonb,
  p_pin text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = stock, public, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_current stock.articles%rowtype;
  v_location text;
  v_stockable boolean;
  v_locations_restricted boolean;
  v_location_ids jsonb;
begin
  select * into v_current from stock.articles where id = p_article_id for update;
  if not found then raise exception 'Article introuvable'; end if;

  v_profile_id := stock.assert_sensitive_action(
    'items.sensitive_update.validate',
    p_pin,
    'item.sensitive_update',
    'article',
    p_article_id,
    p_reason,
    jsonb_build_object(
      'old_unit_id', v_current.unit_id,
      'new_unit_id', p_payload->>'unit_id',
      'old_stockable', v_current.stockable,
      'new_stockable', p_payload->>'stockable'
    )
  );
  perform set_config('stock.sensitive_action_authorized', 'on', true);

  v_stockable := coalesce((p_payload->>'stockable')::boolean, v_current.stockable);
  v_locations_restricted := v_stockable
    and coalesce((p_payload->>'locations_restricted')::boolean, v_current.locations_restricted);
  v_location_ids := coalesce(p_payload->'location_ids', '[]'::jsonb);

  if v_locations_restricted then
    if jsonb_typeof(v_location_ids) <> 'array' then
      raise exception 'Sélectionnez au moins une localisation autorisée';
    end if;
    if jsonb_array_length(v_location_ids) = 0 then
      raise exception 'Sélectionnez au moins une localisation autorisée';
    end if;
    if (select count(*) from jsonb_array_elements_text(v_location_ids))
       <> (select count(distinct value) from jsonb_array_elements_text(v_location_ids)) then
      raise exception 'Une localisation est sélectionnée plusieurs fois';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_location_ids) requested(location_id)
      left join stock.locations l on l.id = requested.location_id::uuid
      where l.id is null
        or (not l.is_active and not exists (
          select 1 from stock.article_locations old_link
          where old_link.article_id = p_article_id
            and old_link.location_id = l.id
        ))
    ) then
      raise exception 'Une localisation sélectionnée est introuvable ou inactive';
    end if;
  end if;

  update stock.articles
  set name = p_payload->>'name',
      family_id = coalesce(nullif(p_payload->>'family_id', '')::uuid, v_current.family_id),
      sub_family = case when p_payload ? 'sub_family' then nullif(p_payload->>'sub_family', '') else v_current.sub_family end,
      unit_id = coalesce(nullif(p_payload->>'unit_id', '')::uuid, v_current.unit_id),
      packaging = case when p_payload ? 'packaging' then nullif(p_payload->>'packaging', '') else v_current.packaging end,
      default_supplier = case when p_payload ? 'default_supplier' then nullif(p_payload->>'default_supplier', '') else v_current.default_supplier end,
      min_stock = coalesce((p_payload->>'min_stock')::numeric, v_current.min_stock),
      sellable_without_transformation = coalesce((p_payload->>'sellable_without_transformation')::boolean, v_current.sellable_without_transformation),
      usable_in_recipes = coalesce((p_payload->>'usable_in_recipes')::boolean, v_current.usable_in_recipes),
      nature = coalesce(nullif(p_payload->>'nature', ''), v_current.nature),
      stockable = v_stockable,
      locations_restricted = v_locations_restricted,
      durable_equipment = coalesce((p_payload->>'durable_equipment')::boolean, v_current.durable_equipment),
      indicative_price = case when p_payload ? 'indicative_price' then nullif(p_payload->>'indicative_price', '')::numeric else v_current.indicative_price end,
      indicative_price_note = case when p_payload ? 'indicative_price_note' then nullif(p_payload->>'indicative_price_note', '') else v_current.indicative_price_note end,
      status = coalesce(nullif(p_payload->>'status', '')::stock.article_status, v_current.status),
      updated_by = v_profile_id,
      updated_at = now()
  where id = p_article_id;

  if v_locations_restricted then
    delete from stock.article_locations where article_id = p_article_id;
    for v_location in select jsonb_array_elements_text(v_location_ids)
    loop
      insert into stock.article_locations (article_id, location_id)
      values (p_article_id, v_location::uuid);
    end loop;
  end if;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id, 'item.sensitive_update', 'items.sensitive_update.validate',
    'article', p_article_id, 'completed', p_reason,
    jsonb_build_object('old_unit_id', v_current.unit_id, 'new_unit_id', coalesce(p_payload->>'unit_id', v_current.unit_id::text))
  );
end;
$$;
revoke all on function stock.update_article_sensitive_with_pin(uuid, jsonb, text, text) from public, anon;
grant execute on function stock.update_article_sensitive_with_pin(uuid, jsonb, text, text) to authenticated;
