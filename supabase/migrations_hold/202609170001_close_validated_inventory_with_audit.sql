-- Cloture explicite et auditee des inventaires valides.
-- La cloture ne genere ni ne modifie de mouvement de stock.

create or replace function stock.close_inventory_with_pin(
  p_inventory_id uuid,
  p_pin text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_role stock.user_role;
  v_inventory stock.inventories%rowtype;
  v_closed_at timestamptz := clock_timestamp();
begin
  select * into v_inventory
  from stock.inventories
  where id = p_inventory_id
  for update;

  if not found then
    raise exception 'Inventaire introuvable';
  end if;

  if v_inventory.status is null or v_inventory.status not in ('valide', 'corrige', 'corrections_generees') then
    raise exception 'Cet inventaire n''est pas en attente de controle final';
  end if;

  v_profile_id := stock.assert_sensitive_action(
    'inventories.close',
    p_pin,
    'inventory.close',
    'inventory',
    p_inventory_id,
    p_comment,
    jsonb_build_object('reference', v_inventory.reference)
  );

  select p.role into v_role
  from stock.profiles p
  where p.id = v_profile_id
    and p.status = 'active';

  if v_role is distinct from 'direction'::stock.user_role then
    raise exception 'Seule la Direction peut cloturer un inventaire';
  end if;

  if v_inventory.validated_by is null or v_inventory.validated_at is null then
    raise exception 'La validation Direction de cet inventaire est incomplete';
  end if;

  if exists (
    select 1 from stock.inventory_adjustment_requests iar
    where iar.inventory_id = p_inventory_id and iar.status = 'en_attente'
  ) then
    raise exception 'Une demande de correction apres validation reste en attente';
  end if;

  if exists (
    select 1
    from stock.inventory_items ii
    left join stock.stock_movements sm on sm.id = ii.stock_movement_id
    where ii.inventory_id = p_inventory_id
      and (
        ii.counted_quantity is null
        or (
          ii.counted_quantity is distinct from ii.theoretical_quantity
          and (
            ii.stock_movement_id is null
            or sm.id is null
            or sm.movement_type is distinct from 'correction'
            or sm.status is distinct from 'valide'
            or sm.reference_type is distinct from 'inventaire'
            or sm.reference_id is distinct from p_inventory_id
            or sm.article_id is distinct from ii.article_id
            or sm.unit_id is distinct from ii.unit_id
            or sm.quantity is distinct from abs(ii.counted_quantity - ii.theoretical_quantity)
            or sm.from_location_id is distinct from (case when ii.counted_quantity < ii.theoretical_quantity then v_inventory.location_id else null end)
            or sm.to_location_id is distinct from (case when ii.counted_quantity > ii.theoretical_quantity then v_inventory.location_id else null end)
          )
        )
      )
  ) then
    raise exception 'Les mouvements de correction doivent etre verifies avant la cloture';
  end if;

  -- Le trigger n'accepte cette transition que depuis une RPC SECURITY DEFINER.
  perform set_config('stock.sensitive_action_authorized', 'on', true);

  update stock.inventories
  set status = 'cloture',
      closed_by = v_profile_id,
      closed_at = v_closed_at,
      updated_by = v_profile_id,
      updated_at = v_closed_at
  where id = p_inventory_id;

  insert into stock.sensitive_action_audit (
    actor_profile_id, action_code, required_permission, entity_type,
    entity_id, outcome, reason, metadata
  ) values (
    v_profile_id, 'inventory.close', 'inventories.close', 'inventory',
    p_inventory_id, 'completed', nullif(btrim(p_comment), ''),
    jsonb_build_object('reference', v_inventory.reference, 'closed_at', v_closed_at)
  );
end;
$$;

revoke all on function stock.close_inventory_with_pin(uuid, text, text) from public, anon, authenticated;
grant execute on function stock.close_inventory_with_pin(uuid, text, text) to authenticated;

-- Le GUC transactionnel reste utilisé par les RPC sensibles existantes, mais
-- une session PostgREST authenticated ne peut pas le falsifier pour changer
-- directement le statut. Un inventaire clôturé devient immuable.
create or replace function stock.guard_sensitive_inventory()
returns trigger
language plpgsql
set search_path = pg_catalog, stock
as $$
begin
  if tg_op = 'UPDATE' and old.status in ('cloture', 'cloture_avec_reserve') then
    raise exception 'Un inventaire cloture ne peut plus etre modifie';
  end if;

  if new.status in ('valide', 'corrige', 'corrections_generees', 'cloture', 'cloture_avec_reserve')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and (
       current_user in ('authenticated', 'anon')
       or coalesce(current_setting('stock.sensitive_action_authorized', true), 'off') <> 'on'
     ) then
    raise exception 'Transition de statut inventaire bloquee : utiliser une RPC SECURITY DEFINER autorisee';
  end if;

  return new;
end;
$$;

create or replace function stock.guard_closed_inventory_item_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, stock
as $$
declare
  v_inventory_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_inventory_id := old.inventory_id;
    if exists (
      select 1 from stock.inventories i
      where i.id = v_inventory_id
        and i.status in ('cloture', 'cloture_avec_reserve')
    ) then
      raise exception 'Les lignes d''un inventaire cloture ne peuvent plus etre modifiees';
    end if;
  end if;

  if tg_op <> 'DELETE' then
    v_inventory_id := new.inventory_id;
    if exists (
      select 1 from stock.inventories i
      where i.id = v_inventory_id
        and i.status in ('cloture', 'cloture_avec_reserve')
    ) then
      raise exception 'Les lignes d''un inventaire cloture ne peuvent plus etre modifiees';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function stock.guard_closed_inventory_record_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, stock
as $$
begin
  if old.status in ('cloture', 'cloture_avec_reserve') then
    raise exception 'Un inventaire cloture ne peut etre modifie ni supprime';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function stock.guard_closed_inventory_related_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, stock
as $$
declare
  v_inventory_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_inventory_id := old.inventory_id;
    if exists (
      select 1 from stock.inventories i
      where i.id = v_inventory_id and i.status in ('cloture', 'cloture_avec_reserve')
    ) then
      raise exception 'Le dossier d''inventaire cloture ne peut plus etre modifie';
    end if;
  end if;

  if tg_op <> 'DELETE' then
    v_inventory_id := new.inventory_id;
    if exists (
      select 1 from stock.inventories i
      where i.id = v_inventory_id and i.status in ('cloture', 'cloture_avec_reserve')
    ) then
      raise exception 'Le dossier d''inventaire cloture ne peut plus etre modifie';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists guard_closed_inventory_item_mutation on stock.inventory_items;
create trigger guard_closed_inventory_item_mutation
before insert or update or delete on stock.inventory_items
for each row execute function stock.guard_closed_inventory_item_mutation();

drop trigger if exists guard_closed_inventory_record_mutation on stock.inventories;
create trigger guard_closed_inventory_record_mutation
before update or delete on stock.inventories
for each row execute function stock.guard_closed_inventory_record_mutation();

drop trigger if exists guard_closed_inventory_adjustment_mutation on stock.inventory_adjustment_requests;
create trigger guard_closed_inventory_adjustment_mutation
before insert or update or delete on stock.inventory_adjustment_requests
for each row execute function stock.guard_closed_inventory_related_mutation();
