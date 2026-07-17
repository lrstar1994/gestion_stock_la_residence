create schema if not exists stock;
set search_path = stock, public, auth;

-- Patch 5 V1 : conserver l'unite fournisseur / achat et la conversion vers l'unite de stock.
-- Les anciens champs restent actifs pour compatibilite :
-- - quantity_ordered, quantity_planned, quantity_bought restent les quantites saisies par l'utilisateur.
-- - unit_id reste l'unite saisie / fournisseur.
-- Les nouveaux champs *_stock portent les valeurs converties dans l'unite principale de l'article.

alter table stock.purchase_order_items
  add column if not exists stock_unit_id uuid references stock.units(id),
  add column if not exists conversion_factor numeric(18, 8) default 1,
  add column if not exists quantity_ordered_stock numeric(14, 4),
  add column if not exists unit_price_stock numeric(14, 4);

update stock.purchase_order_items item
set
  stock_unit_id = coalesce(item.stock_unit_id, article.unit_id, item.unit_id),
  conversion_factor = coalesce(item.conversion_factor, 1),
  quantity_ordered_stock = coalesce(item.quantity_ordered_stock, item.quantity_ordered * coalesce(item.conversion_factor, 1)),
  unit_price_stock = coalesce(item.unit_price_stock, case when coalesce(item.conversion_factor, 1) > 0 then item.unit_price / coalesce(item.conversion_factor, 1) else item.unit_price end)
from stock.articles article
where article.id = item.article_id
and (
  item.stock_unit_id is null
  or item.conversion_factor is null
  or item.quantity_ordered_stock is null
  or item.unit_price_stock is null
);

alter table stock.cash_purchase_items
  add column if not exists stock_unit_id uuid references stock.units(id),
  add column if not exists conversion_factor numeric(18, 8) default 1,
  add column if not exists quantity_planned_stock numeric(14, 4),
  add column if not exists quantity_bought_stock numeric(14, 4),
  add column if not exists unit_price_estimated_stock numeric(14, 4),
  add column if not exists unit_price_real_stock numeric(14, 4);

update stock.cash_purchase_items item
set
  stock_unit_id = coalesce(item.stock_unit_id, article.unit_id, item.unit_id),
  conversion_factor = coalesce(item.conversion_factor, 1),
  quantity_planned_stock = coalesce(item.quantity_planned_stock, item.quantity_planned * coalesce(item.conversion_factor, 1)),
  quantity_bought_stock = coalesce(item.quantity_bought_stock, item.quantity_bought * coalesce(item.conversion_factor, 1)),
  unit_price_estimated_stock = coalesce(item.unit_price_estimated_stock, case when coalesce(item.conversion_factor, 1) > 0 then item.unit_price_estimated / coalesce(item.conversion_factor, 1) else item.unit_price_estimated end),
  unit_price_real_stock = coalesce(item.unit_price_real_stock, case when coalesce(item.conversion_factor, 1) > 0 then item.unit_price_real / coalesce(item.conversion_factor, 1) else item.unit_price_real end)
from stock.articles article
where article.id = item.article_id
and (
  item.stock_unit_id is null
  or item.conversion_factor is null
  or item.quantity_planned_stock is null
  or item.unit_price_estimated_stock is null
);

create index if not exists idx_purchase_order_items_stock_unit_id on stock.purchase_order_items(stock_unit_id);
create index if not exists idx_cash_purchase_items_stock_unit_id on stock.cash_purchase_items(stock_unit_id);

notify pgrst, 'reload schema';
