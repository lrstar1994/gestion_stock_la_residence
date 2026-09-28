-- LOT STOCK : séparation contrôle / passation physique / entrée stock.
-- Migration additive : aucune donnée existante n'est réécrite.

alter table stock.reception_items
  add column if not exists controller_quantity_accepted numeric(14,4),
  add column if not exists handover_quantity_received numeric(14,4),
  add column if not exists stock_quantity_accepted numeric(14,4);

-- A purchase may have several physical presentations.  Idempotence therefore
-- keys the specific Controller -> Magasin handover, never the purchase alone.
alter table stock.receptions
  add column if not exists handover_id uuid;

alter table stock.reception_items
  drop constraint if exists reception_items_handover_quantities_check;

alter table stock.reception_items
  add constraint reception_items_handover_quantities_check check (
    (controller_quantity_accepted is null or controller_quantity_accepted >= 0)
    and (handover_quantity_received is null or handover_quantity_received >= 0)
    and (stock_quantity_accepted is null or stock_quantity_accepted >= 0)
  );

alter table stock.reception_items
  drop constraint if exists reception_items_stock_quantity_bounds_check;

alter table stock.reception_items
  add constraint reception_items_stock_quantity_bounds_check check (
    (stock_quantity_accepted is null or controller_quantity_accepted is null or stock_quantity_accepted <= controller_quantity_accepted)
    and (stock_quantity_accepted is null or handover_quantity_received is null or stock_quantity_accepted <= handover_quantity_received)
  ) not valid;

-- Only one active reception may represent the same physical handover.
-- Reusing the same handover_id is the database-level idempotency guard;
-- another presentation of the same purchase receives another handover_id.
drop index if exists stock.idx_receptions_one_active_cash_purchase;
create unique index if not exists idx_receptions_one_active_handover
  on stock.receptions (handover_id)
  where handover_id is not null
    and status <> 'refusee'::stock.reception_status;

-- Une ligne de réception ne peut produire qu'un mouvement stock actif.
create unique index if not exists idx_stock_movements_one_active_reception_item
  on stock.stock_movements (reception_item_id)
  where reception_item_id is not null
    and status <> 'annule'::stock.movement_status;
