-- Phase autorisee : socle PIN personnel + patchs V1 14 a 17.
-- Migration locale uniquement. Ne pas appliquer a distance sans validation ecrite,
-- sauvegarde verifiee et revue SQL.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Permissions explicites (le PIN ne remplace jamais les permissions).
-- ---------------------------------------------------------------------------

create table if not exists stock.role_permissions (
  role stock.user_role not null,
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role, permission)
);

alter table stock.role_permissions enable row level security;

drop policy if exists "Active users can read role permissions" on stock.role_permissions;
create policy "Active users can read role permissions"
  on stock.role_permissions for select
  to authenticated
  using (
    exists (
      select 1
      from stock.profiles p
      where p.user_id = auth.uid()
        and p.status = 'active'
    )
  );

grant select on stock.role_permissions to authenticated;

insert into stock.role_permissions (role, permission)
select role_name::stock.user_role, permission_name
from (
  values
    ('direction', 'stock.read'),
    ('direction', 'stock.export'),
    ('direction', 'stock.journal.read'),
    ('direction', 'stock.audit.read'),
    ('direction', 'stock.manual.create'),
    ('direction', 'stock.manual.validate'),
    ('direction', 'stock.transfers.create'),
    ('direction', 'stock.transfers.validate_sensitive'),
    ('direction', 'stock.integrate_receipts'),
    ('direction', 'stock.negative.authorize'),
    ('direction', 'inventories.read'),
    ('direction', 'inventories.create'),
    ('direction', 'inventories.update_draft'),
    ('direction', 'inventories.submit'),
    ('direction', 'inventories.validate'),
    ('direction', 'inventories.close'),
    ('direction', 'inventories.cancel'),
    ('direction', 'inventories.export'),
    ('direction', 'inventories.initial.validate'),
    ('direction', 'inventories.retroactive.validate'),
    ('direction', 'stock_corrections.validate_from_inventory'),
    ('direction', 'items.read'),
    ('direction', 'items.create'),
    ('direction', 'items.update'),
    ('direction', 'items.deactivate'),
    ('direction', 'items.reactivate'),
    ('direction', 'items.unit.update'),
    ('direction', 'items.conversion.update'),
    ('direction', 'items.locations.manage'),
    ('direction', 'items.sensitive_update.validate'),
    ('direction', 'referentials.read'),
    ('direction', 'referentials.create'),
    ('direction', 'referentials.update'),
    ('direction', 'referentials.deactivate'),
    ('direction', 'referentials.reactivate'),
    ('direction', 'referentials.delete_unused'),
    ('direction', 'referentials.merge'),
    ('direction', 'referentials.audit.read'),
    ('direction', 'categories.manage'),
    ('direction', 'subcategories.manage'),
    ('direction', 'units.manage'),
    ('direction', 'locations.manage'),
    ('magasinier', 'stock.read'),
    ('magasinier', 'stock.export'),
    ('magasinier', 'stock.journal.read'),
    ('magasinier', 'stock.manual.create'),
    ('magasinier', 'stock.transfers.create'),
    ('magasinier', 'stock.integrate_receipts'),
    ('magasinier', 'inventories.read'),
    ('magasinier', 'inventories.create'),
    ('magasinier', 'inventories.update_draft'),
    ('magasinier', 'inventories.submit'),
    ('magasinier', 'inventories.export'),
    ('magasinier', 'items.read'),
    ('magasinier', 'items.create'),
    ('magasinier', 'items.update'),
    ('magasinier', 'items.locations.manage'),
    ('chef_cuisine', 'stock.read'),
    ('chef_cuisine', 'stock.journal.read'),
    ('chef_cuisine', 'stock.transfers.create'),
    ('chef_cuisine', 'inventories.read'),
    ('chef_cuisine', 'items.read'),
    ('chef_cuisine', 'items.create'),
    ('chef_cuisine', 'items.update'),
    ('acheteur', 'stock.read'),
    ('acheteur', 'items.read'),
    ('acheteur', 'items.create'),
    ('acheteur', 'items.update'),
    ('comptabilite', 'stock.read'),
    ('comptabilite', 'stock.export'),
    ('comptabilite', 'inventories.read'),
    ('comptabilite', 'inventories.export'),
    ('consultation', 'stock.read'),
    ('consultation', 'inventories.read'),
    ('consultation', 'items.read')
) as seed(role_name, permission_name)
on conflict do nothing;

create or replace function stock.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = stock, public, auth
as $$
  select exists (
    select 1
    from stock.profiles p
    join stock.role_permissions rp on rp.role = p.role
    where p.user_id = auth.uid()
      and p.status = 'active'
      and rp.permission = p_permission
  );
$$;

revoke all on function stock.has_permission(text) from public, anon;
grant execute on function stock.has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- PIN personnel : hash isole, jamais expose par les vues/profils/exports.
-- ---------------------------------------------------------------------------

create table if not exists stock.profile_pins (
  profile_id uuid primary key references stock.profiles(id) on delete cascade,
  pin_hash text not null,
  set_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table stock.profile_pins enable row level security;
revoke all on stock.profile_pins from public, anon, authenticated;

create table if not exists stock.sensitive_action_audit (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references stock.profiles(id),
  action_code text not null,
  required_permission text not null,
  entity_type text not null,
  entity_id uuid,
  outcome text not null check (outcome in (
    'authorized',
    'denied_no_profile',
    'denied_no_permission',
    'denied_no_pin',
    'denied_invalid_pin',
    'completed',
    'failed'
  )),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint sensitive_action_audit_no_pin check (
    not (metadata ? 'pin')
    and not (metadata ? 'pin_hash')
    and not (metadata ? 'password')
  )
);

alter table stock.sensitive_action_audit enable row level security;

drop policy if exists "Direction can read sensitive audit" on stock.sensitive_action_audit;
create policy "Direction can read sensitive audit"
  on stock.sensitive_action_audit for select
  to authenticated
  using (stock.has_permission('referentials.audit.read') or stock.has_permission('stock.audit.read'));

grant select on stock.sensitive_action_audit to authenticated;
revoke insert, update, delete on stock.sensitive_action_audit from public, anon, authenticated;

create or replace function stock.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = stock, public, auth
as $$
  select p.id
  from stock.profiles p
  where p.user_id = auth.uid()
    and p.status = 'active'
  limit 1;
$$;

create or replace function stock.get_my_pin_status()
returns table (
  pin_defined boolean,
  pin_set_at timestamptz,
  pin_updated_at timestamptz
)
language sql
stable
security definer
set search_path = stock, public, auth, extensions
as $$
  select
    (pp.profile_id is not null) as pin_defined,
    pp.set_at,
    pp.updated_at
  from stock.profiles p
  left join stock.profile_pins pp on pp.profile_id = p.id
  where p.user_id = auth.uid()
    and p.status = 'active';
$$;

create or replace function stock.set_my_personal_pin(
  p_new_pin text,
  p_current_pin text default null
)
returns void
language plpgsql
security definer
set search_path = stock, public, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_existing_hash text;
begin
  v_profile_id := stock.current_profile_id();
  if v_profile_id is null then
    raise exception 'Profil actif introuvable';
  end if;

  if p_new_pin is null or p_new_pin !~ '^[0-9]{4,8}$' then
    raise exception 'Le PIN doit contenir entre 4 et 8 chiffres';
  end if;

  select pp.pin_hash
  into v_existing_hash
  from stock.profile_pins pp
  where pp.profile_id = v_profile_id
  for update;

  if v_existing_hash is not null
     and (p_current_pin is null or extensions.crypt(p_current_pin, v_existing_hash) <> v_existing_hash) then
    raise exception 'PIN actuel invalide';
  end if;

  insert into stock.profile_pins (profile_id, pin_hash)
  values (v_profile_id, extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)))
  on conflict (profile_id) do update
    set pin_hash = excluded.pin_hash,
        updated_at = now();
end;
$$;

revoke all on function stock.current_profile_id() from public, anon, authenticated;
revoke all on function stock.get_my_pin_status() from public, anon;
revoke all on function stock.set_my_personal_pin(text, text) from public, anon;
grant execute on function stock.get_my_pin_status() to authenticated;
grant execute on function stock.set_my_personal_pin(text, text) to authenticated;

create or replace function stock.assert_sensitive_action(
  p_permission text,
  p_pin text,
  p_action_code text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = stock, public, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_pin_hash text;
begin
  v_profile_id := stock.current_profile_id();

  if v_profile_id is null then
    insert into stock.sensitive_action_audit (
      actor_profile_id, action_code, required_permission, entity_type,
      entity_id, outcome, reason, metadata
    ) values (
      null, p_action_code, p_permission, p_entity_type,
      p_entity_id, 'denied_no_profile', p_reason, coalesce(p_metadata, '{}'::jsonb)
    );
    raise exception 'Profil actif introuvable';
  end if;

  if not stock.has_permission(p_permission) then
    insert into stock.sensitive_action_audit (
      actor_profile_id, action_code, required_permission, entity_type,
      entity_id, outcome, reason, metadata
    ) values (
      v_profile_id, p_action_code, p_permission, p_entity_type,
      p_entity_id, 'denied_no_permission', p_reason, coalesce(p_metadata, '{}'::jsonb)
    );
    raise exception 'Permission insuffisante pour cette action';
  end if;

  select pp.pin_hash into v_pin_hash
  from stock.profile_pins pp
  where pp.profile_id = v_profile_id;

  if v_pin_hash is null then
    insert into stock.sensitive_action_audit (
      actor_profile_id, action_code, required_permission, entity_type,
      entity_id, outcome, reason, metadata
    ) values (
      v_profile_id, p_action_code, p_permission, p_entity_type,
      p_entity_id, 'denied_no_pin', p_reason, coalesce(p_metadata, '{}'::jsonb)
    );
    raise exception 'Aucun PIN personnel defini';
  end if;

  if p_pin is null or extensions.crypt(p_pin, v_pin_hash) <> v_pin_hash then
    insert into stock.sensitive_action_audit (
      actor_profile_id, action_code, required_permission, entity_type,
      entity_id, outcome, reason, metadata
    ) values (
      v_profile_id, p_action_code, p_permission, p_entity_type,
      p_entity_id, 'denied_invalid_pin', p_reason, coalesce(p_metadata, '{}'::jsonb)
    );
    raise exception 'PIN personnel invalide';
  end if;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id, p_action_code, p_permission, p_entity_type,
    p_entity_id, 'authorized', p_reason, coalesce(p_metadata, '{}'::jsonb)
  );

  return v_profile_id;
end;
$$;

revoke all on function stock.assert_sensitive_action(text, text, text, text, uuid, text, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Patch 16/17 : qualite du catalogue et des referentiels.
-- ---------------------------------------------------------------------------

alter table stock.articles
  add column if not exists normalized_key text,
  add column if not exists nature text not null default 'autre',
  add column if not exists stockable boolean not null default true,
  add column if not exists durable_equipment boolean not null default false,
  add column if not exists primary_location_id uuid references stock.locations(id),
  add column if not exists indicative_price numeric(14,2),
  add column if not exists indicative_price_note text;

alter table stock.families
  add column if not exists normalized_key text,
  add column if not exists is_active boolean not null default true;

alter table stock.sub_categories
  add column if not exists normalized_key text,
  add column if not exists is_active boolean not null default true;

alter table stock.units
  add column if not exists normalized_key text,
  add column if not exists unit_type text not null default 'autre',
  add column if not exists reference_unit_id uuid references stock.units(id),
  add column if not exists is_active boolean not null default true;

alter table stock.locations
  add column if not exists normalized_key text,
  add column if not exists location_type text not null default 'autre',
  add column if not exists parent_location_id uuid references stock.locations(id),
  add column if not exists is_active boolean not null default true;

create or replace function stock.normalized_reference_key(p_value text)
returns text
language sql
immutable
strict
as $$
  select regexp_replace(
    translate(
      lower(btrim(regexp_replace(p_value, '\s+', ' ', 'g'))),
      'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy'
    ),
    '[^a-z0-9+]+',
    ' ',
    'g'
  );
$$;

create or replace function stock.set_normalized_reference_key()
returns trigger
language plpgsql
set search_path = stock, public
as $$
declare
  v_duplicate text;
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.normalized_key := stock.normalized_reference_key(new.name);

  execute format(
    'select name from stock.%I where normalized_key = $1 and id <> $2 limit 1',
    tg_table_name
  )
  into v_duplicate
  using new.normalized_key, new.id;

  if v_duplicate is not null then
    raise exception 'Un referentiel similaire existe deja : %. Veuillez utiliser l''existant ou modifier le nom.', v_duplicate;
  end if;
  return new;
end;
$$;

create or replace function stock.set_article_normalized_key()
returns trigger
language plpgsql
set search_path = stock, public
as $$
declare
  v_duplicate text;
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.normalized_key := stock.normalized_reference_key(new.name);
  select a.name into v_duplicate
  from stock.articles a
  where a.normalized_key = new.normalized_key
    and a.id <> new.id
    and a.status <> 'archived'
  limit 1;
  if v_duplicate is not null then
    raise exception 'Article similaire deja existant : %. Verifier avant de creer un doublon.', v_duplicate;
  end if;
  if not new.stockable then
    new.min_stock := 0;
    new.primary_location_id := null;
  end if;
  return new;
end;
$$;

update stock.articles set normalized_key = stock.normalized_reference_key(name)
where normalized_key is null;
update stock.families set normalized_key = stock.normalized_reference_key(name)
where normalized_key is null;
update stock.sub_categories set normalized_key = stock.normalized_reference_key(name)
where normalized_key is null;
update stock.units set normalized_key = stock.normalized_reference_key(name)
where normalized_key is null;
update stock.locations set normalized_key = stock.normalized_reference_key(name)
where normalized_key is null;

create unique index if not exists articles_normalized_key_unique
  on stock.articles (normalized_key);
create unique index if not exists families_normalized_key_unique
  on stock.families (normalized_key);
create unique index if not exists sub_categories_family_normalized_key_unique
  on stock.sub_categories (family_id, normalized_key);
create unique index if not exists units_normalized_key_unique
  on stock.units (normalized_key);
create unique index if not exists locations_normalized_key_unique
  on stock.locations (normalized_key);

drop trigger if exists set_articles_normalized_key on stock.articles;
create trigger set_articles_normalized_key
before insert or update of name, stockable on stock.articles
for each row execute function stock.set_article_normalized_key();

drop trigger if exists set_families_normalized_key on stock.families;
create trigger set_families_normalized_key
before insert or update of name on stock.families
for each row execute function stock.set_normalized_reference_key();

drop trigger if exists set_sub_categories_normalized_key on stock.sub_categories;
create trigger set_sub_categories_normalized_key
before insert or update of name on stock.sub_categories
for each row execute function stock.set_normalized_reference_key();

drop trigger if exists set_units_normalized_key on stock.units;
create trigger set_units_normalized_key
before insert or update of name on stock.units
for each row execute function stock.set_normalized_reference_key();

drop trigger if exists set_locations_normalized_key on stock.locations;
create trigger set_locations_normalized_key
before insert or update of name on stock.locations
for each row execute function stock.set_normalized_reference_key();

-- ---------------------------------------------------------------------------
-- Patch 15 : une ligne non comptee reste NULL, jamais transformee en zero.
-- ---------------------------------------------------------------------------

alter table stock.inventories
  add column if not exists submitted_by uuid references stock.profiles(id),
  add column if not exists submitted_at timestamptz,
  add column if not exists retroactive_reason text,
  add column if not exists closed_by uuid references stock.profiles(id),
  add column if not exists closed_at timestamptz;

alter table stock.inventory_items
  alter column counted_quantity drop not null,
  add column if not exists line_status text not null default 'non_compte',
  add column if not exists reason_code text,
  add column if not exists observation text,
  add column if not exists count_unit_id uuid references stock.units(id),
  add column if not exists conversion_factor numeric(18,8);

alter table stock.inventory_items
  drop constraint if exists inventory_items_counted_quantity_check;
alter table stock.inventory_items
  add constraint inventory_items_counted_quantity_check
  check (counted_quantity is null or counted_quantity >= 0);

-- La baseline distante mélangeait texte et enum dans un COALESCE du trigger
-- de valorisation. Les mouvements manuels valorisés échouaient à l'exécution.
create or replace function stock.handle_movement_cost()
returns trigger
language plpgsql
security definer
set search_path = stock, public, auth
as $$
declare
  v_unit_price numeric(14, 4);
  v_avg_price numeric(14, 4);
begin
  if new.reception_item_id is not null then
    select coalesce(effective_material_unit_cost, unit_price_real)
    into v_unit_price
    from stock.reception_items
    where id = new.reception_item_id;

    new.unit_cost := v_unit_price;
    new.effective_material_unit_cost := v_unit_price;
    new.effective_cost_method := coalesce(
      new.effective_cost_method,
      'invoice_ht_vat_recoverable'::stock.effective_cost_method
    );
    new.effective_cost_source := coalesce(new.effective_cost_source, 'reception');
    new.price_source := 'reception'::stock.price_source_type;
  elsif new.movement_type in ('sortie', 'transfert', 'perte', 'consommation') then
    select coalesce(
      sum(quantity * coalesce(effective_material_unit_cost, unit_cost))
        / nullif(sum(quantity), 0),
      0
    )
    into v_avg_price
    from stock.stock_movements
    where article_id = new.article_id
      and movement_type in ('entree', 'correction', 'ajustement')
      and coalesce(effective_material_unit_cost, unit_cost) is not null
      and quantity > 0
      and status in ('normal', 'retroactif', 'valide');

    new.unit_cost := v_avg_price;
    new.effective_material_unit_cost := v_avg_price;
    new.effective_cost_method := coalesce(
      new.effective_cost_method,
      'invoice_amount_no_vat'::stock.effective_cost_method
    );
    new.effective_cost_source := coalesce(new.effective_cost_source, 'average');
    new.price_source := 'average'::stock.price_source_type;
  elsif new.unit_cost is not null then
    new.effective_material_unit_cost := coalesce(
      new.effective_material_unit_cost,
      new.unit_cost
    );
    new.effective_cost_method := coalesce(
      new.effective_cost_method,
      case
        when new.movement_type in ('correction', 'ajustement')
          then 'manual_validated_cost'::stock.effective_cost_method
        else 'invoice_amount_no_vat'::stock.effective_cost_method
      end
    );
    new.effective_cost_source := coalesce(new.effective_cost_source, 'manual');
    new.price_source := case
      when new.movement_type in ('correction', 'ajustement')
        then 'correction'::stock.price_source_type
      else 'manual'::stock.price_source_type
    end;
  else
    raise exception 'Le prix unitaire est obligatoire pour ce type de mouvement';
  end if;

  new.effective_material_cost_total := coalesce(
    new.effective_material_cost_total,
    new.quantity * new.effective_material_unit_cost
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC atomiques pour les actions sensibles des patchs 14/15.
-- ---------------------------------------------------------------------------

create or replace function stock.create_sensitive_stock_movement(
  p_payload jsonb,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = stock, public, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_movement_id uuid;
  v_permission text;
  v_action text;
  v_quantity numeric;
  v_available numeric;
  v_from_location uuid;
  v_to_location uuid;
  v_type stock.movement_type;
begin
  v_type := (p_payload->>'movement_type')::stock.movement_type;
  v_quantity := (p_payload->>'quantity')::numeric;
  v_from_location := nullif(p_payload->>'from_location_id', '')::uuid;
  v_to_location := nullif(p_payload->>'to_location_id', '')::uuid;
  v_action := case when v_type = 'transfert' then 'stock.transfer.sensitive' else 'stock.manual.sensitive' end;
  v_permission := case when v_type = 'transfert' then 'stock.transfers.validate_sensitive' else 'stock.manual.validate' end;

  v_profile_id := stock.assert_sensitive_action(
    v_permission,
    p_pin,
    v_action,
    'stock_movement',
    null,
    nullif(p_payload->>'reason', ''),
    jsonb_build_object(
      'article_id', p_payload->>'article_id',
      'movement_type', v_type,
      'quantity', v_quantity,
      'movement_date', p_payload->>'movement_date'
    )
  );
  perform set_config('stock.sensitive_action_authorized', 'on', true);

  if v_quantity <= 0 then
    raise exception 'La quantite doit etre superieure a zero';
  end if;

  if v_type in ('sortie', 'perte', 'consommation', 'transfert') then
    select coalesce(sum(slv.quantity), 0)
    into v_available
    from stock.stock_location_view slv
    where slv.article_id = (p_payload->>'article_id')::uuid
      and slv.location_id = v_from_location;

    if v_available < v_quantity and not stock.has_permission('stock.negative.authorize') then
      raise exception 'Stock insuffisant et autorisation de stock negatif absente';
    end if;
  end if;

  insert into stock.stock_movements (
    article_id, quantity, unit_id, movement_type,
    from_location_id, to_location_id, movement_date,
    status, is_retroactive, retroactive_date, retroactive_reason,
    is_manual, manual_reason, manual_validated_by, manual_validated_at,
    comment, unit_cost, price_source, reference_type, reference_id,
    created_by, updated_by
  ) values (
    (p_payload->>'article_id')::uuid,
    v_quantity,
    (p_payload->>'unit_id')::uuid,
    v_type,
    v_from_location,
    v_to_location,
    (p_payload->>'movement_date')::date,
    case when (p_payload->>'movement_date')::date < current_date then 'retroactif'::stock.movement_status else 'valide'::stock.movement_status end,
    (p_payload->>'movement_date')::date < current_date,
    case when (p_payload->>'movement_date')::date < current_date then (p_payload->>'movement_date')::date end,
    nullif(p_payload->>'retroactive_reason', ''),
    v_type <> 'transfert',
    nullif(p_payload->>'reason', ''),
    v_profile_id,
    now(),
    nullif(p_payload->>'comment', ''),
    nullif(p_payload->>'unit_cost', '')::numeric,
    coalesce(nullif(p_payload->>'price_source', '')::stock.price_source_type, 'manual'::stock.price_source_type),
    'sensitive_action',
    null,
    v_profile_id,
    v_profile_id
  )
  returning id into v_movement_id;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id, v_action, v_permission, 'stock_movement',
    v_movement_id, 'completed', nullif(p_payload->>'reason', ''),
    jsonb_build_object('movement_id', v_movement_id)
  );

  return v_movement_id;
exception
  when others then
    raise;
end;
$$;

create or replace function stock.validate_inventory_with_pin(
  p_inventory_id uuid,
  p_pin text,
  p_comment text default null
)
returns integer
language plpgsql
security definer
set search_path = stock, public, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_inventory stock.inventories%rowtype;
  v_item record;
  v_created integer := 0;
  v_movement_id uuid;
begin
  select * into v_inventory
  from stock.inventories
  where id = p_inventory_id
  for update;

  if not found then raise exception 'Inventaire introuvable'; end if;
  if v_inventory.status in ('valide', 'corrige', 'corrections_generees', 'cloture', 'cloture_avec_reserve') then
    raise exception 'Cet inventaire a deja ete valide';
  end if;

  v_profile_id := stock.assert_sensitive_action(
    'inventories.validate',
    p_pin,
    'inventory.validate',
    'inventory',
    p_inventory_id,
    p_comment,
    jsonb_build_object('reference', v_inventory.reference, 'type', v_inventory.type)
  );
  perform set_config('stock.sensitive_action_authorized', 'on', true);

  if exists (
    select 1 from stock.inventory_items ii
    where ii.inventory_id = p_inventory_id
      and ii.counted_quantity is null
  ) then
    raise exception 'Des lignes ne sont pas comptees';
  end if;

  if exists (
    select 1 from stock.inventory_items ii
    where ii.inventory_id = p_inventory_id
      and ii.counted_quantity <> ii.theoretical_quantity
      and nullif(btrim(ii.reason), '') is null
  ) then
    raise exception 'Un motif est obligatoire pour chaque ecart';
  end if;

  update stock.inventories
  set status = 'valide',
      validated_by = v_profile_id,
      validated_at = now(),
      validation_comment = nullif(btrim(p_comment), ''),
      updated_by = v_profile_id,
      updated_at = now()
  where id = p_inventory_id;

  for v_item in
    select *
    from stock.inventory_items
    where inventory_id = p_inventory_id
      and counted_quantity is not null
      and counted_quantity <> theoretical_quantity
      and stock_movement_id is null
    for update
  loop
    insert into stock.stock_movements (
      article_id, quantity, unit_id, movement_type,
      from_location_id, to_location_id, movement_date,
      status, is_retroactive, retroactive_date, retroactive_reason,
      is_manual, manual_reason, manual_validated_by, manual_validated_at,
      unit_cost, price_source, comment, reference_type, reference_id,
      created_by, updated_by
    ) values (
      v_item.article_id,
      abs(v_item.counted_quantity - v_item.theoretical_quantity),
      v_item.unit_id,
      'correction',
      case when v_item.counted_quantity < v_item.theoretical_quantity then v_inventory.location_id end,
      case when v_item.counted_quantity > v_item.theoretical_quantity then v_inventory.location_id end,
      v_inventory.inventory_date,
      'valide',
      v_inventory.inventory_date < current_date,
      case when v_inventory.inventory_date < current_date then v_inventory.inventory_date end,
      v_inventory.retroactive_reason,
      true,
      coalesce(v_item.reason, 'Correction inventaire ' || v_inventory.reference),
      v_profile_id,
      now(),
      v_item.unit_price,
      'correction',
      'Correction tracee issue de l''inventaire ' || v_inventory.reference,
      'inventaire',
      p_inventory_id,
      v_profile_id,
      v_profile_id
    )
    returning id into v_movement_id;

    update stock.inventory_items
    set stock_movement_id = v_movement_id,
        updated_at = now()
    where id = v_item.id;

    v_created := v_created + 1;
  end loop;

  update stock.inventories
  set status = case when v_created > 0 then 'corrections_generees'::stock.inventory_status else 'valide'::stock.inventory_status end,
      updated_at = now()
  where id = p_inventory_id;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id, 'inventory.validate', 'inventories.validate', 'inventory',
    p_inventory_id, 'completed', p_comment,
    jsonb_build_object('correction_count', v_created, 'reference', v_inventory.reference)
  );

  return v_created;
end;
$$;

create or replace function stock.validate_stock_movement_with_pin(
  p_movement_id uuid,
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
  v_movement stock.stock_movements%rowtype;
begin
  select * into v_movement
  from stock.stock_movements
  where id = p_movement_id
  for update;

  if not found then raise exception 'Mouvement introuvable'; end if;
  if v_movement.status <> 'en_attente' then
    raise exception 'Ce mouvement ne peut pas etre valide dans son statut actuel';
  end if;

  v_profile_id := stock.assert_sensitive_action(
    case when v_movement.movement_type = 'transfert'
      then 'stock.transfers.validate_sensitive'
      else 'stock.manual.validate'
    end,
    p_pin,
    'stock.movement.validate',
    'stock_movement',
    p_movement_id,
    p_reason,
    jsonb_build_object(
      'article_id', v_movement.article_id,
      'movement_type', v_movement.movement_type,
      'quantity', v_movement.quantity
    )
  );
  perform set_config('stock.sensitive_action_authorized', 'on', true);

  update stock.stock_movements
  set status = case when is_retroactive then 'retroactif'::stock.movement_status else 'valide'::stock.movement_status end,
      manual_validated_by = v_profile_id,
      manual_validated_at = now(),
      retroactive_validated_by = case when is_retroactive then v_profile_id else retroactive_validated_by end,
      retroactive_validated_at = case when is_retroactive then now() else retroactive_validated_at end,
      updated_by = v_profile_id,
      updated_at = now()
  where id = p_movement_id;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id,
    'stock.movement.validate',
    case when v_movement.movement_type = 'transfert'
      then 'stock.transfers.validate_sensitive'
      else 'stock.manual.validate'
    end,
    'stock_movement',
    p_movement_id,
    'completed',
    p_reason,
    jsonb_build_object('movement_reference', v_movement.movement_reference)
  );
end;
$$;

create or replace function stock.validate_inventory_adjustment_with_pin(
  p_request_id uuid,
  p_pin text,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = stock, public, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_request stock.inventory_adjustment_requests%rowtype;
  v_inventory stock.inventories%rowtype;
  v_difference numeric;
  v_movement_id uuid;
begin
  select * into v_request
  from stock.inventory_adjustment_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Demande de correction introuvable'; end if;
  if v_request.status <> 'en_attente' then raise exception 'Cette demande a deja ete traitee'; end if;

  select * into v_inventory from stock.inventories where id = v_request.inventory_id;
  v_difference := v_request.proposed_counted_quantity - v_request.original_counted_quantity;
  if v_difference = 0 then raise exception 'Aucun ajustement a creer'; end if;

  v_profile_id := stock.assert_sensitive_action(
    'stock_corrections.validate_from_inventory',
    p_pin,
    'inventory.adjustment.validate',
    'inventory_adjustment',
    p_request_id,
    p_comment,
    jsonb_build_object('inventory_id', v_request.inventory_id, 'difference', v_difference)
  );
  perform set_config('stock.sensitive_action_authorized', 'on', true);

  insert into stock.stock_movements (
    article_id, quantity, unit_id, movement_type,
    from_location_id, to_location_id, movement_date,
    status, is_manual, manual_reason, manual_validated_by, manual_validated_at,
    unit_cost, price_source, comment, reference_type, reference_id,
    created_by, updated_by
  ) values (
    v_request.article_id,
    abs(v_difference),
    v_request.unit_id,
    'ajustement',
    case when v_difference < 0 then v_request.location_id end,
    case when v_difference > 0 then v_request.location_id end,
    coalesce(v_inventory.inventory_date, current_date),
    'valide',
    true,
    v_request.reason,
    v_profile_id,
    now(),
    v_request.unit_price,
    'correction',
    'Ajustement trace apres inventaire ' || coalesce(v_inventory.reference, ''),
    'inventaire_ajustement',
    v_request.inventory_id,
    v_profile_id,
    v_profile_id
  )
  returning id into v_movement_id;

  update stock.inventory_adjustment_requests
  set status = 'valide',
      stock_movement_id = v_movement_id,
      validated_by = v_profile_id,
      validated_at = now(),
      validation_comment = nullif(btrim(p_comment), '')
  where id = p_request_id;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id, 'inventory.adjustment.validate',
    'stock_corrections.validate_from_inventory', 'inventory_adjustment',
    p_request_id, 'completed', p_comment,
    jsonb_build_object('movement_id', v_movement_id, 'inventory_id', v_request.inventory_id)
  );

  return v_movement_id;
end;
$$;

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

  update stock.articles
  set name = p_payload->>'name',
      family_id = (p_payload->>'family_id')::uuid,
      sub_family = nullif(p_payload->>'sub_family', ''),
      unit_id = (p_payload->>'unit_id')::uuid,
      packaging = nullif(p_payload->>'packaging', ''),
      default_supplier = nullif(p_payload->>'default_supplier', ''),
      min_stock = coalesce((p_payload->>'min_stock')::numeric, 0),
      sellable_without_transformation = coalesce((p_payload->>'sellable_without_transformation')::boolean, false),
      usable_in_recipes = coalesce((p_payload->>'usable_in_recipes')::boolean, false),
      nature = coalesce(nullif(p_payload->>'nature', ''), 'autre'),
      stockable = coalesce((p_payload->>'stockable')::boolean, true),
      durable_equipment = coalesce((p_payload->>'durable_equipment')::boolean, false),
      primary_location_id = nullif(p_payload->>'primary_location_id', '')::uuid,
      indicative_price = nullif(p_payload->>'indicative_price', '')::numeric,
      indicative_price_note = nullif(p_payload->>'indicative_price_note', ''),
      status = (p_payload->>'status')::stock.article_status,
      updated_by = v_profile_id,
      updated_at = now()
  where id = p_article_id;

  delete from stock.article_locations where article_id = p_article_id;
  for v_location in
    select jsonb_array_elements_text(coalesce(p_payload->'location_ids', '[]'::jsonb))
  loop
    insert into stock.article_locations (article_id, location_id)
    values (p_article_id, v_location::uuid);
  end loop;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id, 'item.sensitive_update', 'items.sensitive_update.validate',
    'article', p_article_id, 'completed', p_reason,
    jsonb_build_object('old_unit_id', v_current.unit_id, 'new_unit_id', p_payload->>'unit_id')
  );
end;
$$;

create or replace function stock.delete_referential_with_pin(
  p_kind text,
  p_id uuid,
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
  v_used boolean := false;
begin
  if p_kind not in ('family', 'sub_category', 'unit', 'location') then
    raise exception 'Type de referentiel non autorise';
  end if;

  v_profile_id := stock.assert_sensitive_action(
    'referentials.delete_unused',
    p_pin,
    'referential.delete',
    p_kind,
    p_id,
    p_reason,
    '{}'::jsonb
  );
  perform set_config('stock.sensitive_action_authorized', 'on', true);

  if p_kind = 'family' then
    select exists(select 1 from stock.articles where family_id = p_id)
      or exists(select 1 from stock.sub_categories where family_id = p_id)
      into v_used;
  elsif p_kind = 'sub_category' then
    select exists(
      select 1 from stock.articles a
      join stock.sub_categories s on s.id = p_id
      where a.family_id = s.family_id and a.sub_family = s.name
    ) into v_used;
  elsif p_kind = 'unit' then
    select exists(select 1 from stock.articles where unit_id = p_id)
      or exists(select 1 from stock.stock_movements where unit_id = p_id)
      or exists(select 1 from stock.inventory_items where unit_id = p_id)
      into v_used;
  elsif p_kind = 'location' then
    select exists(select 1 from stock.article_locations where location_id = p_id)
      or exists(select 1 from stock.stock_movements where from_location_id = p_id or to_location_id = p_id)
      or exists(select 1 from stock.inventories where location_id = p_id)
      into v_used;
  end if;

  if v_used then
    raise exception 'Referentiel utilise : suppression physique interdite. Utiliser la desactivation ou une fusion controlee.';
  end if;

  if p_kind = 'family' then delete from stock.families where id = p_id;
  elsif p_kind = 'sub_category' then delete from stock.sub_categories where id = p_id;
  elsif p_kind = 'unit' then delete from stock.units where id = p_id;
  elsif p_kind = 'location' then delete from stock.locations where id = p_id;
  end if;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason
  ) values (
    v_profile_id, 'referential.delete', 'referentials.delete_unused',
    p_kind, p_id, 'completed', p_reason
  );
end;
$$;

create or replace function stock.set_referential_active_with_pin(
  p_kind text,
  p_id uuid,
  p_active boolean,
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
  v_table text;
begin
  v_table := case p_kind
    when 'family' then 'families'
    when 'sub_category' then 'sub_categories'
    when 'unit' then 'units'
    when 'location' then 'locations'
    else null
  end;
  if v_table is null then raise exception 'Type de referentiel non autorise'; end if;

  v_profile_id := stock.assert_sensitive_action(
    case when p_active then 'referentials.reactivate' else 'referentials.deactivate' end,
    p_pin,
    case when p_active then 'referential.reactivate' else 'referential.deactivate' end,
    p_kind,
    p_id,
    p_reason,
    jsonb_build_object('active', p_active)
  );

  execute format('update stock.%I set is_active = $1, updated_at = now() where id = $2', v_table)
  using p_active, p_id;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id,
    case when p_active then 'referential.reactivate' else 'referential.deactivate' end,
    case when p_active then 'referentials.reactivate' else 'referentials.deactivate' end,
    p_kind, p_id, 'completed', p_reason, jsonb_build_object('active', p_active)
  );
end;
$$;

create or replace function stock.set_article_status_with_pin(
  p_article_id uuid,
  p_status stock.article_status,
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
begin
  v_profile_id := stock.assert_sensitive_action(
    case when p_status = 'active' then 'items.reactivate' else 'items.deactivate' end,
    p_pin,
    case when p_status = 'active' then 'item.reactivate' else 'item.deactivate' end,
    'article',
    p_article_id,
    p_reason,
    jsonb_build_object('status', p_status)
  );
  perform set_config('stock.sensitive_action_authorized', 'on', true);

  update stock.articles
  set status = p_status, updated_by = v_profile_id, updated_at = now()
  where id = p_article_id;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id,
    case when p_status = 'active' then 'item.reactivate' else 'item.deactivate' end,
    case when p_status = 'active' then 'items.reactivate' else 'items.deactivate' end,
    'article', p_article_id, 'completed', p_reason, jsonb_build_object('status', p_status)
  );
end;
$$;

create or replace function stock.merge_families_with_pin(
  p_source_id uuid,
  p_target_id uuid,
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
  v_source_name text;
  v_target_name text;
  v_sub record;
begin
  if p_source_id = p_target_id then raise exception 'La cible doit etre differente de la source'; end if;
  select name into v_source_name from stock.families where id = p_source_id for update;
  select name into v_target_name from stock.families where id = p_target_id for update;
  if v_source_name is null or v_target_name is null then raise exception 'Categorie source ou cible introuvable'; end if;

  v_profile_id := stock.assert_sensitive_action(
    'referentials.merge',
    p_pin,
    'referential.family.merge',
    'family',
    p_source_id,
    p_reason,
    jsonb_build_object('target_id', p_target_id, 'source_name', v_source_name, 'target_name', v_target_name)
  );
  perform set_config('stock.sensitive_action_authorized', 'on', true);

  update stock.articles set family_id = p_target_id, updated_by = v_profile_id, updated_at = now()
  where family_id = p_source_id;

  for v_sub in select * from stock.sub_categories where family_id = p_source_id
  loop
    if exists (
      select 1 from stock.sub_categories
      where family_id = p_target_id and normalized_key = v_sub.normalized_key
    ) then
      delete from stock.sub_categories where id = v_sub.id;
    else
      update stock.sub_categories set family_id = p_target_id, updated_at = now() where id = v_sub.id;
    end if;
  end loop;

  update stock.families set is_active = false, updated_at = now() where id = p_source_id;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id, 'referential.family.merge', 'referentials.merge',
    'family', p_source_id, 'completed', p_reason,
    jsonb_build_object('target_id', p_target_id, 'source_name', v_source_name, 'target_name', v_target_name)
  );
end;
$$;

create or replace function stock.guard_sensitive_stock_movement()
returns trigger
language plpgsql
set search_path = stock, public
as $$
declare
  v_effective boolean;
  v_sensitive boolean;
begin
  v_effective := new.status in ('normal', 'retroactif', 'valide');
  v_sensitive := coalesce(new.is_manual, false)
    or coalesce(new.is_retroactive, false)
    or new.movement_type in ('correction', 'ajustement');

  if v_effective and v_sensitive
     and coalesce(current_setting('stock.sensitive_action_authorized', true), 'off') <> 'on' then
    raise exception 'Action sensible bloquee : utiliser la RPC avec permission et PIN personnel';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_sensitive_stock_movement on stock.stock_movements;
create trigger guard_sensitive_stock_movement
before insert or update of status, is_manual, is_retroactive, movement_type
on stock.stock_movements
for each row execute function stock.guard_sensitive_stock_movement();

create or replace function stock.guard_sensitive_inventory()
returns trigger
language plpgsql
set search_path = stock, public
as $$
begin
  if new.status in ('valide', 'corrige', 'corrections_generees', 'cloture', 'cloture_avec_reserve')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and coalesce(current_setting('stock.sensitive_action_authorized', true), 'off') <> 'on' then
    raise exception 'Validation inventaire bloquee : utiliser la RPC avec permission et PIN personnel';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_sensitive_inventory on stock.inventories;
create trigger guard_sensitive_inventory
before insert or update of status on stock.inventories
for each row execute function stock.guard_sensitive_inventory();

create or replace function stock.guard_sensitive_article()
returns trigger
language plpgsql
set search_path = stock, public
as $$
begin
  if (
    old.unit_id is distinct from new.unit_id
    or old.stockable is distinct from new.stockable
    or (old.status = 'active' and new.status <> 'active')
  ) and coalesce(current_setting('stock.sensitive_action_authorized', true), 'off') <> 'on' then
    raise exception 'Modification article sensible bloquee : permission et PIN personnel requis';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_sensitive_article on stock.articles;
create trigger guard_sensitive_article
before update of unit_id, stockable, status on stock.articles
for each row execute function stock.guard_sensitive_article();

create or replace function stock.guard_referential_delete()
returns trigger
language plpgsql
set search_path = stock, public
as $$
begin
  if coalesce(current_setting('stock.sensitive_action_authorized', true), 'off') <> 'on' then
    raise exception 'Suppression referentiel bloquee : permission, motif et PIN personnel requis';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_family_delete on stock.families;
create trigger guard_family_delete before delete on stock.families
for each row execute function stock.guard_referential_delete();
drop trigger if exists guard_sub_category_delete on stock.sub_categories;
create trigger guard_sub_category_delete before delete on stock.sub_categories
for each row execute function stock.guard_referential_delete();
drop trigger if exists guard_unit_delete on stock.units;
create trigger guard_unit_delete before delete on stock.units
for each row execute function stock.guard_referential_delete();
drop trigger if exists guard_location_delete on stock.locations;
create trigger guard_location_delete before delete on stock.locations
for each row execute function stock.guard_referential_delete();

revoke all on function stock.create_sensitive_stock_movement(jsonb, text) from public, anon;
revoke all on function stock.validate_inventory_with_pin(uuid, text, text) from public, anon;
revoke all on function stock.validate_stock_movement_with_pin(uuid, text, text) from public, anon;
revoke all on function stock.validate_inventory_adjustment_with_pin(uuid, text, text) from public, anon;
revoke all on function stock.update_article_sensitive_with_pin(uuid, jsonb, text, text) from public, anon;
revoke all on function stock.delete_referential_with_pin(text, uuid, text, text) from public, anon;
revoke all on function stock.set_referential_active_with_pin(text, uuid, boolean, text, text) from public, anon;
revoke all on function stock.set_article_status_with_pin(uuid, stock.article_status, text, text) from public, anon;
revoke all on function stock.merge_families_with_pin(uuid, uuid, text, text) from public, anon;

grant execute on function stock.create_sensitive_stock_movement(jsonb, text) to authenticated;
grant execute on function stock.validate_inventory_with_pin(uuid, text, text) to authenticated;
grant execute on function stock.validate_stock_movement_with_pin(uuid, text, text) to authenticated;
grant execute on function stock.validate_inventory_adjustment_with_pin(uuid, text, text) to authenticated;
grant execute on function stock.update_article_sensitive_with_pin(uuid, jsonb, text, text) to authenticated;
grant execute on function stock.delete_referential_with_pin(text, uuid, text, text) to authenticated;
grant execute on function stock.set_referential_active_with_pin(text, uuid, boolean, text, text) to authenticated;
grant execute on function stock.set_article_status_with_pin(uuid, stock.article_status, text, text) to authenticated;
grant execute on function stock.merge_families_with_pin(uuid, uuid, text, text) to authenticated;

-- Une correction/ajustement est positive si elle cible une localisation et
-- négative si elle en sort. Les vues legacy classaient toutes les corrections
-- comme des entrées, ce qui masquait les écarts négatifs d'inventaire.
create or replace view stock.stock_view as
with movement_flows as (
  select sm.article_id, sm.unit_id, sm.quantity as signed_quantity
  from stock.stock_movements sm
  where sm.status in ('normal', 'retroactif', 'valide')
    and (
      sm.movement_type in ('entree', 'retour')
      or (
        sm.movement_type in ('correction', 'ajustement')
        and sm.to_location_id is not null
      )
    )
  union all
  select sm.article_id, sm.unit_id, -sm.quantity as signed_quantity
  from stock.stock_movements sm
  where sm.status in ('normal', 'retroactif', 'valide')
    and (
      sm.movement_type in ('sortie', 'perte', 'consommation')
      or (
        sm.movement_type in ('correction', 'ajustement')
        and sm.from_location_id is not null
      )
    )
  union all
  select sm.article_id, sm.unit_id, 0::numeric as signed_quantity
  from stock.stock_movements sm
  where sm.status in ('normal', 'retroactif', 'valide')
    and sm.movement_type = 'transfert'
),
article_totals as (
  select article_id, sum(signed_quantity) as total_quantity
  from movement_flows
  group by article_id
),
price_events as (
  select
    sm.article_id,
    sm.movement_date,
    sm.created_at,
    sm.quantity,
    coalesce(sm.effective_material_unit_cost, sm.unit_cost) as unit_cost
  from stock.stock_movements sm
  where sm.status in ('normal', 'retroactif', 'valide')
    and coalesce(sm.effective_material_unit_cost, sm.unit_cost) is not null
    and sm.quantity > 0
    and (
      sm.movement_type = 'entree'
      or (
        sm.movement_type in ('correction', 'ajustement')
        and sm.to_location_id is not null
      )
    )
)
select
  totals.article_id,
  totals.total_quantity,
  (
    select pe.unit_cost
    from price_events pe
    where pe.article_id = totals.article_id
    order by pe.movement_date desc, pe.created_at desc
    limit 1
  ) as last_price,
  coalesce((
    select sum(pe.quantity * pe.unit_cost) / nullif(sum(pe.quantity), 0)
    from price_events pe
    where pe.article_id = totals.article_id
  ), 0) as average_price,
  (
    select pe.movement_date
    from price_events pe
    where pe.article_id = totals.article_id
    order by pe.movement_date desc, pe.created_at desc
    limit 1
  ) as last_entry_date,
  totals.total_quantity * coalesce((
    select sum(pe.quantity * pe.unit_cost) / nullif(sum(pe.quantity), 0)
    from price_events pe
    where pe.article_id = totals.article_id
  ), 0) as stock_value
from article_totals totals;

create or replace view stock.stock_location_view as
with location_flows as (
  select
    sm.article_id,
    sm.to_location_id as location_id,
    sm.unit_id,
    sm.quantity as signed_quantity
  from stock.stock_movements sm
  where sm.status in ('normal', 'retroactif', 'valide')
    and sm.to_location_id is not null
    and sm.movement_type in ('entree', 'retour', 'transfert', 'correction', 'ajustement')
  union all
  select
    sm.article_id,
    sm.from_location_id as location_id,
    sm.unit_id,
    -sm.quantity as signed_quantity
  from stock.stock_movements sm
  where sm.status in ('normal', 'retroactif', 'valide')
    and sm.from_location_id is not null
    and sm.movement_type in (
      'sortie', 'perte', 'consommation', 'transfert', 'correction', 'ajustement'
    )
)
select
  flows.article_id,
  flows.location_id,
  flows.unit_id,
  sum(flows.signed_quantity) as quantity,
  coalesce(sv.average_price, 0) as average_price,
  sum(flows.signed_quantity) * coalesce(sv.average_price, 0) as stock_value
from location_flows flows
left join stock.stock_view sv on sv.article_id = flows.article_id
group by flows.article_id, flows.location_id, flows.unit_id, sv.average_price;

-- Les vues critiques doivent respecter les politiques des tables sous-jacentes.
alter view stock.stock_view set (security_invoker = true);
alter view stock.stock_location_view set (security_invoker = true);
alter view stock.price_history_view set (security_invoker = true);

comment on table stock.profile_pins is
  'Hashes PIN personnels uniquement. Aucun SELECT accorde aux clients.';
comment on table stock.sensitive_action_audit is
  'Audit nominatif des validations sensibles; ne contient jamais le PIN ni son hash.';
