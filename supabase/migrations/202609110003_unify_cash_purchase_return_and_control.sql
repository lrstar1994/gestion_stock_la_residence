-- Lot 3B : retour et contrôle unifiés sans connexion Acheteur.
alter table stock.cash_purchases add column if not exists amount_returned_to_controller numeric(14,2);
alter table stock.cash_purchases drop constraint if exists cash_purchases_amount_returned_to_controller_check;
alter table stock.cash_purchases add constraint cash_purchases_amount_returned_to_controller_check check (amount_returned_to_controller is null or amount_returned_to_controller >= 0);
create or replace function stock.guard_cash_purchase_return_to_controller() returns trigger language plpgsql security invoker set search_path=pg_catalog,stock as $$
declare v_owner text;
begin
 select r.rolname into v_owner from pg_roles r join pg_proc p on p.proowner=r.oid where p.oid='stock.guard_cash_purchase_return_to_controller()'::regprocedure;
 if current_user <> v_owner and old.controlled_at is not null and new.amount_returned_to_controller is distinct from old.amount_returned_to_controller then raise exception 'La monnaie remise au Contrôleur est verrouillée après confirmation'; end if;
 return new;
end; $$;
drop trigger if exists cash_purchase_return_to_controller_guard on stock.cash_purchases;
create trigger cash_purchase_return_to_controller_guard before update on stock.cash_purchases for each row execute function stock.guard_cash_purchase_return_to_controller();
insert into stock.role_permissions(role, permission) values ('controleur'::stock.user_role,'cash_purchases.control'),('direction'::stock.user_role,'cash_purchases.control') on conflict (role,permission) do nothing;

-- New typed difference values are committed before the RPC migration uses them.
alter type stock.difference_type add value if not exists 'funding_gap';
alter type stock.difference_type add value if not exists 'control_regularization';
alter type stock.difference_type add value if not exists 'cash_return_shortage';
alter type stock.difference_type add value if not exists 'cash_return_surplus';
