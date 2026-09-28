-- Rattrapage idempotent des lignes de commandes fournisseur issues des besoins.
-- A appliquer uniquement sur Supabase test après validation.
insert into stock.purchase_order_items (
  purchase_order_id, article_id, quantity_ordered, unit_id, unit_price,
  comment, stock_unit_id, quantity_ordered_stock
)
select
  pon.purchase_order_id,
  n.article_id,
  n.quantity,
  n.unit_id,
  coalesce(n.estimated_price, 0),
  n.comment,
  n.unit_id,
  n.quantity
from stock.purchase_order_needs pon
join stock.purchase_needs n on n.id = pon.need_id
where n.article_id is not null
  and n.quantity is not null
  and not exists (
    select 1
    from stock.purchase_order_items poi
    where poi.purchase_order_id = pon.purchase_order_id
      and poi.article_id = n.article_id
      and poi.quantity_ordered = n.quantity
      and poi.unit_id = n.unit_id
  );