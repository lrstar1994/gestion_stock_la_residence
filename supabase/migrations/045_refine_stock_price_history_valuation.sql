create schema if not exists stock;
set search_path = stock, public, auth;

-- Patch 6 V1 : historique des prix, cout moyen pondere et valorisation stock.
-- Les colonnes existantes de stock_view et price_history_view sont conservees.
-- Les nouvelles colonnes sont ajoutees en fin de vue pour ne pas casser les appels existants.

create or replace view stock.stock_view as
select
  article_id,
  sum(quantity) as total_quantity,
  (
    select coalesce(sm.effective_material_unit_cost, sm.unit_cost)
    from stock.stock_movements sm
    where sm.article_id = movements.article_id
    and sm.movement_type in ('entree', 'correction', 'ajustement')
    and coalesce(sm.effective_material_unit_cost, sm.unit_cost) is not null
    and sm.status in ('normal', 'retroactif', 'valide')
    order by sm.movement_date desc, sm.created_at desc
    limit 1
  )::numeric as last_price,
  (
    select coalesce(sum(sm.quantity * coalesce(sm.effective_material_unit_cost, sm.unit_cost)) / nullif(sum(sm.quantity), 0), 0)
    from stock.stock_movements sm
    where sm.article_id = movements.article_id
    and sm.movement_type in ('entree', 'correction', 'ajustement')
    and coalesce(sm.effective_material_unit_cost, sm.unit_cost) is not null
    and sm.quantity > 0
    and sm.status in ('normal', 'retroactif', 'valide')
  )::numeric as average_price,
  (
    select sm.movement_date
    from stock.stock_movements sm
    where sm.article_id = movements.article_id
    and sm.movement_type in ('entree', 'correction', 'ajustement')
    and coalesce(sm.effective_material_unit_cost, sm.unit_cost) is not null
    and sm.status in ('normal', 'retroactif', 'valide')
    order by sm.movement_date desc, sm.created_at desc
    limit 1
  ) as last_entry_date,
  (
    sum(quantity) * (
      select coalesce(sum(sm.quantity * coalesce(sm.effective_material_unit_cost, sm.unit_cost)) / nullif(sum(sm.quantity), 0), 0)
      from stock.stock_movements sm
      where sm.article_id = movements.article_id
      and sm.movement_type in ('entree', 'correction', 'ajustement')
      and coalesce(sm.effective_material_unit_cost, sm.unit_cost) is not null
      and sm.quantity > 0
      and sm.status in ('normal', 'retroactif', 'valide')
    )
  )::numeric as stock_value
from (
  select article_id, unit_id, quantity, movement_type, coalesce(effective_material_unit_cost, unit_cost) as unit_cost
  from stock.stock_movements
  where movement_type in ('entree', 'retour', 'correction', 'ajustement')
  and status in ('normal', 'retroactif', 'valide')
  union all
  select article_id, unit_id, -quantity, movement_type, coalesce(effective_material_unit_cost, unit_cost) as unit_cost
  from stock.stock_movements
  where movement_type in ('sortie', 'perte', 'consommation')
  and status in ('normal', 'retroactif', 'valide')
  union all
  select article_id, unit_id, 0, movement_type, coalesce(effective_material_unit_cost, unit_cost) as unit_cost
  from stock.stock_movements
  where movement_type = 'transfert'
  and status in ('normal', 'retroactif', 'valide')
) movements
group by article_id;

create or replace view stock.stock_location_view as
select
  locations.article_id,
  locations.location_id,
  locations.unit_id,
  sum(locations.quantity) as quantity,
  coalesce(stock_values.average_price, 0)::numeric as average_price,
  (sum(locations.quantity) * coalesce(stock_values.average_price, 0))::numeric as stock_value
from (
  select article_id, to_location_id as location_id, unit_id, sum(quantity) as quantity
  from stock.stock_movements
  where movement_type in ('entree', 'retour', 'correction', 'ajustement')
  and to_location_id is not null
  and status in ('normal', 'retroactif', 'valide')
  group by article_id, to_location_id, unit_id
  union all
  select article_id, from_location_id as location_id, unit_id, sum(-quantity) as quantity
  from stock.stock_movements
  where movement_type in ('sortie', 'perte', 'consommation', 'transfert')
  and from_location_id is not null
  and status in ('normal', 'retroactif', 'valide')
  group by article_id, from_location_id, unit_id
  union all
  select article_id, to_location_id as location_id, unit_id, sum(quantity) as quantity
  from stock.stock_movements
  where movement_type = 'transfert'
  and to_location_id is not null
  and status in ('normal', 'retroactif', 'valide')
  group by article_id, to_location_id, unit_id
) locations
left join stock.stock_view stock_values on stock_values.article_id = locations.article_id
group by locations.article_id, locations.location_id, locations.unit_id, stock_values.average_price;

create or replace view stock.price_history_view as
select
  id,
  article_id,
  movement_date,
  coalesce(effective_material_unit_cost, unit_cost) as unit_cost,
  quantity,
  price_source,
  reference_type,
  reference_id,
  movement_reference,
  effective_cost_method,
  effective_cost_source,
  created_at,
  coalesce(effective_material_cost_total, quantity * coalesce(effective_material_unit_cost, unit_cost))::numeric as total_cost,
  comment
from stock.stock_movements
where movement_type in ('entree', 'correction', 'ajustement')
and coalesce(effective_material_unit_cost, unit_cost) is not null
and status in ('normal', 'retroactif', 'valide')
order by movement_date desc;

create index if not exists idx_stock_movements_effective_cost_source on stock.stock_movements(effective_cost_source);
create index if not exists idx_stock_movements_effective_cost_method on stock.stock_movements(effective_cost_method);

notify pgrst, 'reload schema';
