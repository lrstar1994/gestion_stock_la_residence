-- Lot 3B : retour Acheteur et contrôle métier.
alter table stock.cash_purchases
  add column if not exists amount_paid_supplier numeric(14,2),
  add column if not exists amount_accepted numeric(14,2),
  add column if not exists controlled_by uuid references stock.profiles(id) on delete set null,
  add column if not exists controlled_at timestamptz;
alter table stock.cash_purchase_items
  add column if not exists quantity_accepted numeric(14,3),
  add column if not exists control_comment text;
alter table stock.cash_purchases drop constraint if exists cash_purchases_amount_paid_supplier_check;
alter table stock.cash_purchases add constraint cash_purchases_amount_paid_supplier_check check (amount_paid_supplier is null or amount_paid_supplier >= 0);
alter table stock.cash_purchases drop constraint if exists cash_purchases_amount_accepted_check;
alter table stock.cash_purchases add constraint cash_purchases_amount_accepted_check check (amount_accepted is null or amount_accepted >= 0);
alter table stock.cash_purchase_items drop constraint if exists cash_purchase_items_quantity_accepted_check;
alter table stock.cash_purchase_items add constraint cash_purchase_items_quantity_accepted_check check (quantity_accepted is null or quantity_accepted >= 0);
alter table stock.cash_purchase_items drop constraint if exists cash_purchase_items_quantity_accepted_le_bought_check;
alter table stock.cash_purchase_items add constraint cash_purchase_items_quantity_accepted_le_bought_check check (quantity_accepted is null or quantity_bought is null or quantity_accepted <= quantity_bought);
insert into stock.role_permissions(role, permission) values ('controleur'::stock.user_role,'cash_purchases.control'),('direction'::stock.user_role,'cash_purchases.control') on conflict (role,permission) do nothing;
create or replace function stock.control_cash_purchase(p_purchase_id uuid, p_items jsonb, p_pin text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, stock, auth, extensions as $$
declare v_profile_id uuid; v_purchase record; v_amount numeric(14,2); v_item record; v_existing record; v_seen uuid[] := '{}'; v_count integer;
begin
 v_profile_id := stock.assert_sensitive_action('cash_purchases.control',p_pin,'cash_purchase.control','cash_purchase',p_purchase_id,null,'{}'::jsonb);
 select * into v_purchase from stock.cash_purchases where id=p_purchase_id for update;
 if not found then raise exception 'Achat espèces introuvable'; end if;
 if v_purchase.controlled_at is not null then raise exception 'Ce contrôle a déjà été confirmé'; end if;
 if v_purchase.status not in ('retour_partiel','retour_complet') then raise exception 'Retour achat non prêt pour contrôle'; end if;
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Lignes de contrôle obligatoires'; end if;
 select count(*) into v_count from stock.cash_purchase_items where cash_purchase_id=p_purchase_id;
 if v_count <> jsonb_array_length(p_items) then raise exception 'Toutes les lignes doivent être contrôlées'; end if;
 for v_item in select * from jsonb_to_recordset(p_items) as x(item_id uuid, quantity_accepted numeric, control_comment text) loop
   if v_item.item_id is null or v_item.quantity_accepted is null or v_item.quantity_accepted < 0 then raise exception 'Valeur de contrôle invalide'; end if;
   if v_item.item_id = any(v_seen) then raise exception 'Ligne de contrôle dupliquée'; end if; v_seen := array_append(v_seen,v_item.item_id);
   select quantity_bought, unit_price_real into v_existing from stock.cash_purchase_items where id=v_item.item_id and cash_purchase_id=p_purchase_id for update;
   if not found or v_existing.quantity_bought is null then raise exception 'Ligne étrangère ou quantité achetée manquante'; end if;
   if v_existing.unit_price_real is null then raise exception 'Prix unitaire réel manquant'; end if;
   if v_item.quantity_accepted > v_existing.quantity_bought then raise exception 'Quantité acceptée supérieure à la quantité achetée'; end if;
   update stock.cash_purchase_items set quantity_accepted=v_item.quantity_accepted, control_comment=nullif(btrim(v_item.control_comment),'') where id=v_item.item_id and cash_purchase_id=p_purchase_id;
 end loop;
 select round(sum(quantity_accepted * unit_price_real),2) into v_amount from stock.cash_purchase_items where cash_purchase_id=p_purchase_id;
 if v_amount is null then raise exception 'Montant accepté impossible à calculer'; end if;
 update stock.cash_purchases set amount_accepted=v_amount, controlled_by=v_profile_id, controlled_at=now(), updated_by=v_profile_id, updated_at=now() where id=p_purchase_id;
 return jsonb_build_object('id',p_purchase_id,'amount_accepted',v_amount,'controlled_by',v_profile_id,'controlled_at',now());
end; $$;
revoke all on function stock.control_cash_purchase(uuid,jsonb,text) from public,anon;
grant execute on function stock.control_cash_purchase(uuid,jsonb,text) to authenticated;
revoke update (quantity_accepted, control_comment) on stock.cash_purchase_items from authenticated;
revoke update (amount_accepted, controlled_by, controlled_at) on stock.cash_purchases from authenticated;

create or replace function stock.guard_cash_purchase_control_fields() returns trigger language plpgsql security invoker set search_path=pg_catalog,stock as $$
begin
 if current_user <> (select r.rolname from pg_roles r join pg_proc p on p.proowner=r.oid where p.oid='stock.guard_cash_purchase_control_fields()'::regprocedure) and (new.amount_accepted is distinct from old.amount_accepted or new.controlled_by is distinct from old.controlled_by or new.controlled_at is distinct from old.controlled_at) then raise exception 'Les champs de contrôle doivent être modifiés par la RPC métier'; end if; return new;
end; $$;
create or replace function stock.guard_cash_purchase_item_control_fields() returns trigger language plpgsql security invoker set search_path=pg_catalog,stock as $$
begin
 if current_user <> (select r.rolname from pg_roles r join pg_proc p on p.proowner=r.oid where p.oid='stock.guard_cash_purchase_item_control_fields()'::regprocedure) and (new.quantity_accepted is distinct from old.quantity_accepted or new.control_comment is distinct from old.control_comment) then raise exception 'Les champs de contrôle doivent être modifiés par la RPC métier'; end if; return new;
end; $$;
drop trigger if exists cash_purchase_control_fields_guard on stock.cash_purchases;
create trigger cash_purchase_control_fields_guard before update on stock.cash_purchases for each row execute function stock.guard_cash_purchase_control_fields();
create or replace function stock.guard_cash_purchase_supplier_amount() returns trigger language plpgsql security definer set search_path=pg_catalog,stock as $$
begin
 if old.status in ('retour_partiel','retour_complet','cloture') and new.amount_paid_supplier is distinct from old.amount_paid_supplier then raise exception 'Le montant payé fournisseur est verrouillé après le retour Acheteur'; end if; return new;
end; $$;
drop trigger if exists cash_purchase_supplier_amount_guard on stock.cash_purchases;
create trigger cash_purchase_supplier_amount_guard before update on stock.cash_purchases for each row execute function stock.guard_cash_purchase_supplier_amount();
drop trigger if exists cash_purchase_item_control_fields_guard on stock.cash_purchase_items;
create trigger cash_purchase_item_control_fields_guard before update on stock.cash_purchase_items for each row execute function stock.guard_cash_purchase_item_control_fields();
create or replace function stock.guard_cash_purchase_source_after_control() returns trigger language plpgsql security invoker set search_path=pg_catalog,stock as $$
declare v_controlled timestamptz;
begin
 select controlled_at into v_controlled from stock.cash_purchases where id=new.cash_purchase_id;
 if current_user <> (select r.rolname from pg_roles r join pg_proc p on p.proowner=r.oid where p.oid='stock.guard_cash_purchase_source_after_control()'::regprocedure) and v_controlled is not null and (new.cash_purchase_id is distinct from old.cash_purchase_id or new.quantity_bought is distinct from old.quantity_bought or new.unit_price_real is distinct from old.unit_price_real or new.supplier is distinct from old.supplier) then raise exception 'Les données sources sont verrouillées après confirmation du contrôle'; end if;
 return new;
end; $$;
drop trigger if exists cash_purchase_source_after_control_guard on stock.cash_purchase_items;
create trigger cash_purchase_source_after_control_guard before update on stock.cash_purchase_items for each row execute function stock.guard_cash_purchase_source_after_control();
create or replace function stock.guard_cash_purchase_item_structure() returns trigger language plpgsql security invoker set search_path=pg_catalog,stock as $$
declare v_controlled timestamptz;
begin
 select controlled_at into v_controlled from stock.cash_purchases where id=coalesce(new.cash_purchase_id,old.cash_purchase_id);
 if v_controlled is not null then raise exception 'La structure des lignes est verrouillée après confirmation du contrôle'; end if;
 if tg_op = 'DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists cash_purchase_item_structure_insert_guard on stock.cash_purchase_items;
create trigger cash_purchase_item_structure_insert_guard before insert on stock.cash_purchase_items for each row execute function stock.guard_cash_purchase_item_structure();
drop trigger if exists cash_purchase_item_structure_delete_guard on stock.cash_purchase_items;
create trigger cash_purchase_item_structure_delete_guard before delete on stock.cash_purchase_items for each row execute function stock.guard_cash_purchase_item_structure();
