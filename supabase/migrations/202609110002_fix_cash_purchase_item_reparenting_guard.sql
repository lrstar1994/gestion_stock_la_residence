-- Correctif 3B : empêcher le reparenting d'une ligne après contrôle confirmé.
create or replace function stock.guard_cash_purchase_source_after_control()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, stock
as $$
declare
  v_old_controlled timestamptz;
  v_new_controlled timestamptz;
  v_owner text;
begin
  select r.rolname into v_owner
  from pg_roles r
  join pg_proc p on p.proowner = r.oid
  where p.oid = 'stock.guard_cash_purchase_source_after_control()'::regprocedure;

  select controlled_at into v_old_controlled
  from stock.cash_purchases
  where id = old.cash_purchase_id;

  select controlled_at into v_new_controlled
  from stock.cash_purchases
  where id = new.cash_purchase_id;

  if current_user <> v_owner then
    if new.cash_purchase_id is distinct from old.cash_purchase_id
       and (v_old_controlled is not null or v_new_controlled is not null) then
      raise exception 'Le rattachement est verrouillé pour les dossiers contrôlés';
    end if;

    if v_old_controlled is not null
       and (new.quantity_bought is distinct from old.quantity_bought
         or new.unit_price_real is distinct from old.unit_price_real
         or new.supplier is distinct from old.supplier) then
      raise exception 'Les données sources sont verrouillées après confirmation du contrôle';
    end if;
  end if;

  return new;
end;
$$;
