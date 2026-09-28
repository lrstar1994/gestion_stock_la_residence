-- Dossiers de transferts groupés avec brouillons persistés et validation atomique.

create table if not exists stock.stock_transfer_batches (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  from_location_id uuid references stock.locations(id) on delete restrict,
  to_location_id uuid references stock.locations(id) on delete restrict,
  movement_date date,
  reason text,
  comment text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_direction', 'validated', 'cancelled')),
  created_by uuid not null references stock.profiles(id) on delete restrict,
  updated_by uuid references stock.profiles(id) on delete set null,
  validated_by uuid references stock.profiles(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stock.stock_transfer_batch_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references stock.stock_transfer_batches(id) on delete cascade,
  line_number integer not null,
  article_id uuid references stock.articles(id) on delete restrict,
  unit_id uuid references stock.units(id) on delete restrict,
  quantity numeric(14,4) check (quantity is null or quantity > 0),
  line_comment text,
  stock_movement_id uuid references stock.stock_movements(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint stock_transfer_batch_items_transfer_line_key unique (transfer_id, line_number),
  constraint stock_transfer_batch_items_transfer_article_key unique (transfer_id, article_id)
);

create index if not exists stock_transfer_batches_owner_status_idx
  on stock.stock_transfer_batches(created_by, status, updated_at desc);
create index if not exists stock_transfer_batch_items_transfer_idx
  on stock.stock_transfer_batch_items(transfer_id, line_number);
create unique index if not exists stock_transfer_batch_items_movement_idx
  on stock.stock_transfer_batch_items(stock_movement_id) where stock_movement_id is not null;

alter table stock.stock_transfer_batches enable row level security;
alter table stock.stock_transfer_batch_items enable row level security;
revoke all on stock.stock_transfer_batches, stock.stock_transfer_batch_items from public, anon, authenticated;
grant select on stock.stock_transfer_batches, stock.stock_transfer_batch_items to authenticated;

create or replace function stock.can_read_stock_transfer_batch(p_owner_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, stock, auth
as $$
  select exists (
    select 1 from stock.profiles p
    where p.user_id = auth.uid() and p.status = 'active'
      and (p.id = p_owner_profile_id or p.role in ('direction', 'controleur'))
  );
$$;
revoke all on function stock.can_read_stock_transfer_batch(uuid) from public, anon;
grant execute on function stock.can_read_stock_transfer_batch(uuid) to authenticated;

drop policy if exists stock_transfer_batches_read_authorized on stock.stock_transfer_batches;
create policy stock_transfer_batches_read_authorized
  on stock.stock_transfer_batches for select to authenticated
  using (stock.can_read_stock_transfer_batch(created_by));

drop policy if exists stock_transfer_batch_items_read_authorized on stock.stock_transfer_batch_items;
create policy stock_transfer_batch_items_read_authorized
  on stock.stock_transfer_batch_items for select to authenticated
  using (exists (
    select 1 from stock.stock_transfer_batches b
    where b.id = transfer_id and stock.can_read_stock_transfer_batch(b.created_by)
  ));

create or replace function stock.save_stock_transfer_draft(p_transfer_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_role stock.user_role;
  v_transfer_id uuid := p_transfer_id;
  v_status text;
  v_owner uuid;
  v_line_count integer;
begin
  v_profile_id := stock.current_profile_id();
  if v_profile_id is null then raise exception 'Profil actif introuvable'; end if;
  if not stock.has_permission('stock.transfers.create') then raise exception 'Permission de transfert insuffisante'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Brouillon de transfert invalide'; end if;
  if jsonb_typeof(coalesce(p_payload->'lines', '[]'::jsonb)) is distinct from 'array' then raise exception 'Les lignes du brouillon doivent etre une liste'; end if;

  select p.role into v_role from stock.profiles p where p.id = v_profile_id and p.status = 'active';
  v_line_count := jsonb_array_length(coalesce(p_payload->'lines', '[]'::jsonb));
  if v_line_count > 300 then raise exception 'Un transfert ne peut pas contenir plus de 300 lignes'; end if;

  if v_transfer_id is null then
    insert into stock.stock_transfer_batches(created_by, updated_by)
    values (v_profile_id, v_profile_id)
    returning id into v_transfer_id;
  else
    select b.status, b.created_by into v_status, v_owner
    from stock.stock_transfer_batches b where b.id = v_transfer_id for update;
    if not found then raise exception 'Brouillon de transfert introuvable'; end if;
    if v_status <> 'draft' then raise exception 'Ce transfert n''est plus un brouillon'; end if;
    if v_owner <> v_profile_id and v_role <> 'direction' then raise exception 'Ce brouillon appartient a un autre utilisateur'; end if;
  end if;

  update stock.stock_transfer_batches
  set from_location_id = nullif(p_payload->>'from_location_id', '')::uuid,
      to_location_id = nullif(p_payload->>'to_location_id', '')::uuid,
      movement_date = nullif(p_payload->>'movement_date', '')::date,
      reason = nullif(btrim(p_payload->>'reason'), ''),
      comment = nullif(btrim(p_payload->>'comment'), ''),
      updated_by = v_profile_id,
      updated_at = clock_timestamp()
  where id = v_transfer_id and status = 'draft';

  delete from stock.stock_transfer_batch_items where transfer_id = v_transfer_id;

  insert into stock.stock_transfer_batch_items(transfer_id, line_number, article_id, unit_id, quantity, line_comment)
  select v_transfer_id,
         (entry.ordinality)::integer,
         nullif(entry.value->>'article_id', '')::uuid,
         nullif(entry.value->>'unit_id', '')::uuid,
         nullif(entry.value->>'quantity', '')::numeric,
         nullif(btrim(entry.value->>'line_comment'), '')
  from jsonb_array_elements(coalesce(p_payload->'lines', '[]'::jsonb)) with ordinality as entry(value, ordinality);

  return v_transfer_id;
end;
$$;

create or replace function stock.delete_stock_transfer_draft(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, stock, auth
as $$
declare
  v_profile_id uuid;
  v_role stock.user_role;
  v_owner uuid;
  v_status text;
begin
  v_profile_id := stock.current_profile_id();
  if v_profile_id is null then raise exception 'Profil actif introuvable'; end if;
  if not stock.has_permission('stock.transfers.create') then raise exception 'Permission de transfert insuffisante'; end if;
  select p.role into v_role from stock.profiles p where p.id = v_profile_id and p.status = 'active';
  select b.status, b.created_by into v_status, v_owner
  from stock.stock_transfer_batches b where b.id = p_transfer_id for update;
  if not found then raise exception 'Brouillon de transfert introuvable'; end if;
  if v_status <> 'draft' then raise exception 'Seul un brouillon peut etre supprime'; end if;
  if v_owner <> v_profile_id and v_role <> 'direction' then raise exception 'Ce brouillon appartient a un autre utilisateur'; end if;
  delete from stock.stock_transfer_batches where id = p_transfer_id;
end;
$$;

create or replace function stock.finalize_stock_transfer(p_transfer_id uuid, p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_role stock.user_role;
  v_transfer stock.stock_transfer_batches%rowtype;
  v_line stock.stock_transfer_batch_items%rowtype;
  v_available numeric;
  v_reference text;
  v_pending_direction boolean;
  v_origin_allowed boolean;
  v_movement_id uuid;
  v_movement_status stock.movement_status;
begin
  v_profile_id := stock.current_profile_id();
  if v_profile_id is null then raise exception 'Profil actif introuvable'; end if;
  if not stock.has_permission('stock.transfers.create') then raise exception 'Permission de transfert insuffisante'; end if;
  select p.role into v_role from stock.profiles p where p.id = v_profile_id and p.status = 'active';

  select * into v_transfer from stock.stock_transfer_batches where id = p_transfer_id for update;
  if not found then raise exception 'Brouillon de transfert introuvable'; end if;
  if v_transfer.status <> 'draft' then raise exception 'Ce transfert n''est plus un brouillon'; end if;
  if v_transfer.created_by <> v_profile_id and v_role <> 'direction' then raise exception 'Ce brouillon appartient a un autre utilisateur'; end if;
  if v_transfer.from_location_id is null or v_transfer.to_location_id is null or v_transfer.movement_date is null
     or v_transfer.from_location_id = v_transfer.to_location_id then
    raise exception 'Origine, destination distincte et date sont obligatoires';
  end if;
  if nullif(btrim(v_transfer.reason), '') is null then raise exception 'Le motif general est obligatoire'; end if;

  if not exists (select 1 from stock.locations l where l.id = v_transfer.from_location_id and l.is_active is distinct from false)
     or not exists (select 1 from stock.locations l where l.id = v_transfer.to_location_id and l.is_active is distinct from false) then
    raise exception 'Les localisations du transfert doivent etre actives';
  end if;

  if not exists (select 1 from stock.stock_transfer_batch_items i where i.transfer_id = p_transfer_id) then
    raise exception 'Ajoutez au moins un article au transfert';
  end if;
  if exists (
    select 1 from stock.stock_transfer_batch_items i
    left join stock.articles a on a.id = i.article_id
    where i.transfer_id = p_transfer_id
      and (i.article_id is null or i.quantity is null or i.quantity <= 0 or i.unit_id is null
        or a.id is null or a.status <> 'active' or a.stockable is false or a.unit_id is distinct from i.unit_id)
  ) then
    raise exception 'Chaque ligne doit avoir un article actif, une unite correcte et une quantite positive';
  end if;

  if v_role <> 'direction' then
    if to_regprocedure('stock.can_access_stock_location(uuid,boolean)') is not null then
      execute 'select stock.can_access_stock_location($1, true)' into v_origin_allowed using v_transfer.from_location_id;
      if not coalesce(v_origin_allowed, false) then raise exception 'La localisation d''origine n''est pas affectee a cet utilisateur'; end if;
    elsif to_regclass('stock.profile_location_access') is not null then
      execute 'select exists (select 1 from stock.profile_location_access a where a.profile_id = $1 and a.location_id = $2 and a.active)' into v_origin_allowed
        using v_profile_id, v_transfer.from_location_id;
      if not coalesce(v_origin_allowed, false) then raise exception 'La localisation d''origine n''est pas affectee a cet utilisateur'; end if;
    end if;
  end if;

  if exists (
    select 1
    from stock.stock_transfer_batch_items i
    where i.transfer_id = p_transfer_id
      and not stock.article_location_allowed(i.article_id, v_transfer.to_location_id)
  ) then raise exception 'La destination n''est pas autorisee pour tous les articles'; end if;

  for v_line in
    select * from stock.stock_transfer_batch_items i
    where i.transfer_id = p_transfer_id order by i.article_id for update
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_line.article_id::text || ':' || v_transfer.from_location_id::text, 0));
  end loop;

  for v_line in
    select * from stock.stock_transfer_batch_items i
    where i.transfer_id = p_transfer_id order by i.article_id
  loop
    select coalesce(sum(slv.quantity), 0) into v_available
    from stock.stock_location_view slv
    where slv.article_id = v_line.article_id and slv.location_id = v_transfer.from_location_id;
    if v_line.quantity > v_available then
      raise exception 'Stock insuffisant pour % : demande %, disponible %',
        (select a.name from stock.articles a where a.id = v_line.article_id), v_line.quantity, v_available;
    end if;
  end loop;

  v_pending_direction := v_transfer.movement_date < current_date and v_role <> 'direction';
  if v_transfer.movement_date < current_date and v_role = 'direction' then
    v_profile_id := stock.assert_sensitive_action(
      'stock.transfers.validate_sensitive', p_pin, 'stock.transfer.sensitive',
      'stock_transfer_batch', p_transfer_id, v_transfer.reason,
      jsonb_build_object('from_location_id', v_transfer.from_location_id, 'to_location_id', v_transfer.to_location_id)
    );
    perform set_config('stock.sensitive_action_authorized', 'on', true);
  end if;

  v_reference := 'TR-' || to_char(v_transfer.movement_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  v_movement_status := case
    when v_pending_direction then 'en_attente'::stock.movement_status
    when v_transfer.movement_date < current_date then 'retroactif'::stock.movement_status
    else 'normal'::stock.movement_status
  end;

  for v_line in
    select * from stock.stock_transfer_batch_items i
    where i.transfer_id = p_transfer_id order by i.line_number for update
  loop
    insert into stock.stock_movements (
      article_id, quantity, unit_id, movement_type, from_location_id, to_location_id,
      movement_date, status, is_retroactive, retroactive_date, retroactive_reason,
      comment, movement_reference, reference_type, reference_id, created_by, updated_by
    ) values (
      v_line.article_id, v_line.quantity, v_line.unit_id, 'transfert',
      v_transfer.from_location_id, v_transfer.to_location_id, v_transfer.movement_date,
      v_movement_status, v_transfer.movement_date < current_date,
      case when v_transfer.movement_date < current_date then v_transfer.movement_date end,
      case when v_transfer.movement_date < current_date then v_transfer.reason end,
      concat_ws(' — ', v_reference || ': ' || v_transfer.reason, nullif(btrim(v_line.line_comment), ''), nullif(btrim(v_transfer.comment), '')),
      v_reference || '-L' || lpad(v_line.line_number::text, 3, '0'),
      'stock_transfer_batch', p_transfer_id, v_profile_id, v_profile_id
    ) returning id into v_movement_id;

    update stock.stock_transfer_batch_items set stock_movement_id = v_movement_id where id = v_line.id;
  end loop;

  update stock.stock_transfer_batches
  set reference = v_reference,
      status = case when v_pending_direction then 'pending_direction' else 'validated' end,
      validated_by = case when v_pending_direction then null else v_profile_id end,
      validated_at = case when v_pending_direction then null else clock_timestamp() end,
      updated_by = v_profile_id,
      updated_at = clock_timestamp()
  where id = p_transfer_id;

  return jsonb_build_object('transfer_id', p_transfer_id, 'reference', v_reference,
    'status', case when v_pending_direction then 'pending_direction' else 'validated' end,
    'movement_count', (select count(*) from stock.stock_transfer_batch_items where transfer_id = p_transfer_id));
end;
$$;

create or replace function stock.sync_stock_transfer_batch_validation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, stock, auth
as $$
begin
  if new.reference_type = 'stock_transfer_batch'
     and new.reference_id is not null
     and new.status in ('normal', 'retroactif', 'valide') then
    update stock.stock_transfer_batches b
    set status = 'validated',
        validated_by = stock.current_profile_id(),
        validated_at = clock_timestamp(),
        updated_by = stock.current_profile_id(),
        updated_at = clock_timestamp()
    where b.id = new.reference_id
      and b.status = 'pending_direction'
      and not exists (
        select 1 from stock.stock_movements sm
        where sm.reference_type = 'stock_transfer_batch'
          and sm.reference_id = b.id
          and sm.status not in ('normal', 'retroactif', 'valide')
      );
  end if;
  return new;
end;
$$;

revoke all on function stock.save_stock_transfer_draft(uuid, jsonb) from public, anon, authenticated;
revoke all on function stock.delete_stock_transfer_draft(uuid) from public, anon, authenticated;
revoke all on function stock.finalize_stock_transfer(uuid, text) from public, anon, authenticated;
revoke all on function stock.sync_stock_transfer_batch_validation() from public, anon, authenticated;
grant execute on function stock.save_stock_transfer_draft(uuid, jsonb) to authenticated;
grant execute on function stock.delete_stock_transfer_draft(uuid) to authenticated;
grant execute on function stock.finalize_stock_transfer(uuid, text) to authenticated;

drop trigger if exists sync_stock_transfer_batch_validation on stock.stock_movements;
create trigger sync_stock_transfer_batch_validation
after update of status on stock.stock_movements
for each row when (new.reference_type = 'stock_transfer_batch' and new.status in ('normal', 'retroactif', 'valide'))
execute function stock.sync_stock_transfer_batch_validation();
