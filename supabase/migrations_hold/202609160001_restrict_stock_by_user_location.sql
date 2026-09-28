-- Affectations profil/localisation et cloisonnement des opérations de stock.
-- Les mouvements et inventaires historiques ne sont ni modifiés ni backfillés.

-- Cette migration étant maintenue en attente, elle reste autonome si elle est
-- réactivée avant la migration principale du modèle de restrictions article.
alter table stock.articles
  add column if not exists locations_restricted boolean not null default false;

create or replace function stock.article_location_allowed(p_article_id uuid, p_location_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, stock
as $$
  select coalesce(
    not a.locations_restricted or exists (
      select 1 from stock.article_locations al
      where al.article_id = a.id and al.location_id = p_location_id
    ), false
  )
  from stock.articles a
  where a.id = p_article_id and p_location_id is not null;
$$;
revoke all on function stock.article_location_allowed(uuid, uuid) from public, anon, authenticated;

insert into stock.role_permissions(role, permission)
values ('controleur'::stock.user_role, 'stock.read'),
       ('controleur'::stock.user_role, 'stock.journal.read'),
       ('controleur'::stock.user_role, 'inventories.read')
on conflict (role, permission) do nothing;

create table if not exists stock.profile_location_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references stock.profiles(id) on delete restrict,
  location_id uuid not null references stock.locations(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references stock.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references stock.profiles(id) on delete set null,
  constraint profile_location_access_profile_location_key unique (profile_id, location_id)
);
create index if not exists profile_location_access_active_profile_idx
  on stock.profile_location_access(profile_id, location_id) where active;
alter table stock.profile_location_access enable row level security;
revoke all on stock.profile_location_access from public, anon, authenticated;
grant select on stock.profile_location_access to authenticated;
drop policy if exists profile_location_access_read_self_or_direction on stock.profile_location_access;
create policy profile_location_access_read_self_or_direction
  on stock.profile_location_access for select to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role = 'direction')
    or profile_id = (select p.id from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' limit 1)
  );

create or replace function stock.can_access_stock_location(p_location_id uuid, p_for_write boolean default false)
returns boolean
language sql stable security definer
set search_path = pg_catalog, stock, auth
as $$
  select coalesce(exists (
    select 1
    from stock.profiles p
    where p.user_id = auth.uid() and p.status = 'active'
      and (
        p.role = 'direction'
        or (not p_for_write and p.role = 'controleur')
        or (p.role <> 'controleur' and p.role <> 'direction' and exists (
          select 1 from stock.profile_location_access a
          join stock.locations l on l.id = a.location_id and l.is_active
          where a.profile_id = p.id and a.location_id = p_location_id and a.active
        ))
      )
  ), false);
$$;
revoke all on function stock.can_access_stock_location(uuid, boolean) from public, anon;
grant execute on function stock.can_access_stock_location(uuid, boolean) to authenticated;

create or replace function stock.list_stock_operational_location_ids(p_include_inactive boolean default false)
returns setof uuid
language sql stable security definer
set search_path = pg_catalog, stock, auth
as $$
  select l.id
  from stock.locations l
  where exists (
    select 1 from stock.profiles p
    where p.user_id = auth.uid() and p.status = 'active'
      and (
        (p.role = 'direction' and (l.is_active or p_include_inactive))
        or (p.role = 'controleur' and l.is_active)
        or (
          p.role not in ('direction','controleur')
          and l.is_active
          and exists (
            select 1 from stock.profile_location_access a
            where a.profile_id = p.id and a.location_id = l.id and a.active
          )
        )
      )
  )
  order by l.name;
$$;
revoke all on function stock.list_stock_operational_location_ids(boolean) from public, anon;
grant execute on function stock.list_stock_operational_location_ids(boolean) to authenticated;

create or replace function stock.stock_movement_location_write_allowed(
  p_article_id uuid, p_movement_type stock.movement_type,
  p_from_location_id uuid, p_to_location_id uuid
) returns boolean
language sql stable security definer
set search_path = pg_catalog, stock, auth
as $$
  select case
    when p_movement_type = 'transfert' then
      p_from_location_id is not null
      and p_to_location_id is not null
      and p_from_location_id <> p_to_location_id
      and stock.can_access_stock_location(p_from_location_id, true)
      and exists (
        select 1 from stock.locations l
        where l.id = p_to_location_id and l.is_active
          and stock.article_location_allowed(p_article_id, p_to_location_id)
      )
    else stock.can_access_stock_location(coalesce(p_from_location_id, p_to_location_id), true)
  end;
$$;
revoke all on function stock.stock_movement_location_write_allowed(uuid, stock.movement_type, uuid, uuid) from public, anon;
grant execute on function stock.stock_movement_location_write_allowed(uuid, stock.movement_type, uuid, uuid) to authenticated;

-- Les RPC SECURITY DEFINER conservent leur implémentation; ce trigger applique
-- également l'affectation à tout chemin d'écriture sur le journal de stock.
create or replace function stock.enforce_stock_movement_location_access()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, stock, auth
as $$
begin
  if not stock.stock_movement_location_write_allowed(
    new.article_id, new.movement_type, new.from_location_id, new.to_location_id
  ) then
    raise exception 'La localisation d’origine ou de destination n’est pas autorisée pour cet utilisateur';
  end if;
  return new;
end;
$$;
revoke all on function stock.enforce_stock_movement_location_access() from public, anon, authenticated;
drop trigger if exists stock_movement_location_access_guard on stock.stock_movements;
create trigger stock_movement_location_access_guard
before insert or update of article_id, movement_type, from_location_id, to_location_id
on stock.stock_movements
for each row execute function stock.enforce_stock_movement_location_access();

create or replace function stock.set_profile_location_access(p_profile_id uuid, p_location_ids uuid[])
returns integer
language plpgsql security definer
set search_path = pg_catalog, stock, auth
as $$
declare v_actor uuid; v_count integer;
begin
  select id into v_actor from stock.profiles where user_id = auth.uid() and role = 'direction' and status = 'active' limit 1;
  if v_actor is null then raise exception 'Profil Direction actif requis'; end if;
  if not exists (select 1 from stock.profiles where id = p_profile_id) then raise exception 'Profil utilisateur introuvable'; end if;
  if coalesce(cardinality(p_location_ids), 0) <> (select count(distinct x) from unnest(coalesce(p_location_ids, '{}'::uuid[])) x) then
    raise exception 'Une localisation est sélectionnée plusieurs fois';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_location_ids, '{}'::uuid[])) requested(location_id)
    left join stock.locations l on l.id = requested.location_id
    where requested.location_id is null or l.id is null
      or (not l.is_active and not exists (
        select 1 from stock.profile_location_access existing
        where existing.profile_id = p_profile_id and existing.location_id = requested.location_id
      ))
  ) then raise exception 'Une localisation sélectionnée est introuvable ou inactive'; end if;

  update stock.profile_location_access a
  set active = false, updated_at = now(), updated_by = v_actor
  where a.profile_id = p_profile_id and a.active
    and not (a.location_id = any(coalesce(p_location_ids, '{}'::uuid[])));

  insert into stock.profile_location_access(profile_id, location_id, active, created_by, updated_by)
  select p_profile_id, requested.location_id, true, v_actor, v_actor
  from (select distinct unnest(coalesce(p_location_ids, '{}'::uuid[])) as location_id) requested
  on conflict (profile_id, location_id) do update
    set active = true, updated_at = now(), updated_by = excluded.updated_by;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function stock.set_profile_location_access(uuid, uuid[]) from public, anon, authenticated;
grant execute on function stock.set_profile_location_access(uuid, uuid[]) to authenticated;

create or replace function stock.update_profile_and_location_access(
  p_profile_id uuid, p_role stock.user_role, p_status stock.user_status, p_location_ids uuid[]
) returns void
language plpgsql security definer
set search_path = pg_catalog, stock, auth
as $$
declare v_actor uuid;
begin
  select id into v_actor from stock.profiles where user_id = auth.uid() and role = 'direction' and status = 'active' limit 1;
  if v_actor is null then raise exception 'Profil Direction actif requis'; end if;
  if p_status not in ('active'::stock.user_status, 'inactive'::stock.user_status) then raise exception 'Statut utilisateur invalide'; end if;
  update stock.profiles set role = p_role, status = p_status where id = p_profile_id;
  if not found then raise exception 'Profil utilisateur introuvable'; end if;
  perform stock.set_profile_location_access(p_profile_id, p_location_ids);
end;
$$;
revoke all on function stock.update_profile_and_location_access(uuid, stock.user_role, stock.user_status, uuid[]) from public, anon, authenticated;
grant execute on function stock.update_profile_and_location_access(uuid, stock.user_role, stock.user_status, uuid[]) to authenticated;

create or replace function stock.list_stock_transfer_destinations(p_article_id uuid, p_from_location_id uuid)
returns table(id uuid, name text)
language plpgsql stable security definer
set search_path = pg_catalog, stock, auth
as $$
begin
  if not stock.can_access_stock_location(p_from_location_id, true) then
    raise exception 'La localisation d’origine n’est pas affectée à cet utilisateur';
  end if;
  return query
    select l.id, l.name from stock.locations l
    where l.is_active and l.id <> p_from_location_id
      and stock.article_location_allowed(p_article_id, l.id)
    order by l.name;
end;
$$;
revoke all on function stock.list_stock_transfer_destinations(uuid, uuid) from public, anon;
grant execute on function stock.list_stock_transfer_destinations(uuid, uuid) to authenticated;

-- Direction et Contrôleur voient toutes les zones; les autres profils voient uniquement leurs affectations.
drop policy if exists "All users can view locations" on stock.locations;
create policy locations_scoped_read on stock.locations for select to authenticated
  using (
    stock.can_access_stock_location(id, false)
    or exists (
      select 1 from stock.stock_movements sm
      where (sm.from_location_id = id and stock.can_access_stock_location(sm.to_location_id, false))
         or (sm.to_location_id = id and stock.can_access_stock_location(sm.from_location_id, false))
    )
  );
drop policy if exists "Users can view article locations" on stock.article_locations;
create policy article_locations_scoped_read on stock.article_locations for select to authenticated
  using (stock.can_access_stock_location(location_id, false));
drop policy if exists "Catalog managers can manage article locations" on stock.article_locations;
create policy article_locations_scoped_manage on stock.article_locations for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','chef_cuisine','magasinier','acheteur'))
    and stock.can_access_stock_location(location_id, true)
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','chef_cuisine','magasinier','acheteur'))
    and stock.can_access_stock_location(location_id, true)
  );

-- Stock actuel et journal: retirer les politiques globales permissives.
drop policy if exists "All users can view movements" on stock.stock_movements;
drop policy if exists "Directors can manage all movements" on stock.stock_movements;
drop policy if exists "Staff can manage movements" on stock.stock_movements;
create policy stock_movements_scoped_read on stock.stock_movements for select to authenticated
  using (
    stock.can_access_stock_location(from_location_id, false)
    or stock.can_access_stock_location(to_location_id, false)
  );
create policy stock_movements_scoped_manage on stock.stock_movements for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier','chef_cuisine','point_vente'))
    and stock.stock_movement_location_write_allowed(article_id, movement_type, from_location_id, to_location_id)
    and status <> 'annule'
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier','chef_cuisine','point_vente'))
    and stock.stock_movement_location_write_allowed(article_id, movement_type, from_location_id, to_location_id)
    and status <> 'annule'
  );

-- Inventaires et lignes suivent la localisation du dossier parent.
drop policy if exists "All users can view inventories" on stock.inventories;
drop policy if exists "Directors can manage all inventories" on stock.inventories;
drop policy if exists "Magasinier can manage inventories" on stock.inventories;
create policy inventories_scoped_read on stock.inventories for select to authenticated
  using (stock.can_access_stock_location(location_id, false));
create policy inventories_scoped_manage on stock.inventories for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and stock.can_access_stock_location(location_id, true)
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and stock.can_access_stock_location(location_id, true)
  );

drop policy if exists "Users can view inventory items" on stock.inventory_items;
drop policy if exists "Staff can manage inventory items" on stock.inventory_items;
create policy inventory_items_scoped_read on stock.inventory_items for select to authenticated
  using (exists (select 1 from stock.inventories i where i.id = inventory_id and stock.can_access_stock_location(i.location_id, false)));
create policy inventory_items_scoped_manage on stock.inventory_items for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.inventories i where i.id = inventory_id and stock.can_access_stock_location(i.location_id, true))
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.inventories i where i.id = inventory_id and stock.can_access_stock_location(i.location_id, true))
  );

drop policy if exists "Users can view inventory adjustment requests" on stock.inventory_adjustment_requests;
drop policy if exists "Directors can manage inventory adjustment requests" on stock.inventory_adjustment_requests;
drop policy if exists "Staff can create inventory adjustment requests" on stock.inventory_adjustment_requests;
create policy inventory_adjustments_scoped_read on stock.inventory_adjustment_requests for select to authenticated
  using (exists (select 1 from stock.inventories i where i.id = inventory_id and stock.can_access_stock_location(i.location_id, false)));
create policy inventory_adjustments_scoped_insert on stock.inventory_adjustment_requests for insert to authenticated
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.inventories i where i.id = inventory_id and stock.can_access_stock_location(i.location_id, true))
  );
create policy inventory_adjustments_scoped_direction_manage on stock.inventory_adjustment_requests for all to authenticated
  using (exists (select 1 from stock.profiles p join stock.inventories i on i.id = inventory_id where p.user_id = auth.uid() and p.status = 'active' and p.role = 'direction' and stock.can_access_stock_location(i.location_id, true)))
  with check (exists (select 1 from stock.profiles p join stock.inventories i on i.id = inventory_id where p.user_id = auth.uid() and p.status = 'active' and p.role = 'direction' and stock.can_access_stock_location(i.location_id, true)));

-- Les sorties stock sont filtrées sur leur localisation, sans changer les rôles opérationnels existants.
drop policy if exists "All users can view stock outs" on stock.stock_outs;
drop policy if exists "Directors and Chef can manage stock outs" on stock.stock_outs;
create policy stock_outs_scoped_read on stock.stock_outs for select to authenticated
  using (stock.can_access_stock_location(location_id, false));
create policy stock_outs_scoped_manage on stock.stock_outs for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','chef_cuisine','magasinier','point_vente'))
    and stock.can_access_stock_location(location_id, true)
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','chef_cuisine','magasinier','point_vente'))
    and stock.can_access_stock_location(location_id, true)
  );

-- Les liens vente/sortie suivent les droits du stock-out rattaché.
drop policy if exists "Users can view sale stock outs" on stock.sale_stock_outs;
drop policy if exists "Staff can manage sale stock outs" on stock.sale_stock_outs;
create policy sale_stock_outs_scoped_read on stock.sale_stock_outs for select to authenticated
  using (exists (select 1 from stock.stock_outs so where so.id = stock_out_id));
create policy sale_stock_outs_scoped_manage on stock.sale_stock_outs for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','point_vente','chef_cuisine'))
    and exists (select 1 from stock.stock_outs so where so.id = stock_out_id and stock.can_access_stock_location(so.location_id, true))
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','point_vente','chef_cuisine'))
    and exists (select 1 from stock.stock_outs so where so.id = stock_out_id and stock.can_access_stock_location(so.location_id, true))
  );

-- Les entrées en attente du module Stock sont cloisonnées sur leur localisation sans modifier le workflow Réceptions/Achats.
drop policy if exists "Users can view pending stock movements" on stock.stock_pending_movements;
drop policy if exists "Staff can manage pending stock movements" on stock.stock_pending_movements;
create policy stock_pending_movements_scoped_read on stock.stock_pending_movements for select to authenticated
  using (stock.can_access_stock_location(location_id, false));
create policy stock_pending_movements_scoped_manage on stock.stock_pending_movements for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and stock.can_access_stock_location(location_id, true)
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and stock.can_access_stock_location(location_id, true)
  );

-- Les réceptions sont le flux d’entrée vers le stock; leurs lignes, justificatifs et historiques suivent la localisation de réception.
drop policy if exists "All users can view receptions" on stock.receptions;
drop policy if exists "Directors and magasinier can manage receptions" on stock.receptions;
create policy receptions_scoped_read on stock.receptions for select to authenticated
  using (stock.can_access_stock_location(location_id, false));
create policy receptions_scoped_manage on stock.receptions for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and stock.can_access_stock_location(location_id, true)
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and stock.can_access_stock_location(location_id, true)
  );

drop policy if exists "Users can view reception items" on stock.reception_items;
drop policy if exists "Staff can manage reception items" on stock.reception_items;
create policy reception_items_scoped_read on stock.reception_items for select to authenticated
  using (exists (select 1 from stock.receptions r where r.id = reception_id and stock.can_access_stock_location(r.location_id, false)));
create policy reception_items_scoped_manage on stock.reception_items for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.receptions r where r.id = reception_id and stock.can_access_stock_location(r.location_id, true))
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.receptions r where r.id = reception_id and stock.can_access_stock_location(r.location_id, true))
  );

drop policy if exists "Users can view reception documents" on stock.reception_documents;
drop policy if exists "Staff can manage reception documents" on stock.reception_documents;
create policy reception_documents_scoped_read on stock.reception_documents for select to authenticated
  using (exists (select 1 from stock.receptions r where r.id = reception_id and stock.can_access_stock_location(r.location_id, false)));
create policy reception_documents_scoped_manage on stock.reception_documents for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.receptions r where r.id = reception_id and stock.can_access_stock_location(r.location_id, true))
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.receptions r where r.id = reception_id and stock.can_access_stock_location(r.location_id, true))
  );

drop policy if exists "Users can view reception history" on stock.reception_history;
drop policy if exists "Staff can insert reception history" on stock.reception_history;
create policy reception_history_scoped_read on stock.reception_history for select to authenticated
  using (exists (select 1 from stock.receptions r where r.id = reception_id and stock.can_access_stock_location(r.location_id, false)));
create policy reception_history_scoped_insert on stock.reception_history for insert to authenticated
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.receptions r where r.id = reception_id and stock.can_access_stock_location(r.location_id, true))
  );

drop policy if exists "Users can view anomalies" on stock.reception_anomalies;
drop policy if exists "Staff can manage anomalies" on stock.reception_anomalies;
create policy reception_anomalies_scoped_read on stock.reception_anomalies for select to authenticated
  using (exists (select 1 from stock.reception_items ri join stock.receptions r on r.id = ri.reception_id where ri.id = reception_item_id and stock.can_access_stock_location(r.location_id, false)));
create policy reception_anomalies_scoped_manage on stock.reception_anomalies for all to authenticated
  using (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.reception_items ri join stock.receptions r on r.id = ri.reception_id where ri.id = reception_item_id and stock.can_access_stock_location(r.location_id, true))
  )
  with check (
    exists (select 1 from stock.profiles p where p.user_id = auth.uid() and p.status = 'active' and p.role in ('direction','magasinier'))
    and exists (select 1 from stock.reception_items ri join stock.receptions r on r.id = ri.reception_id where ri.id = reception_item_id and stock.can_access_stock_location(r.location_id, true))
  );
