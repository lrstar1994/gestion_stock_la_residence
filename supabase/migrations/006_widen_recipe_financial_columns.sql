create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration : elargir les colonnes financieres des fiches techniques
-- Corrige les erreurs PostgREST 22003 lorsque les couts ou ratios depassent
-- les limites initiales des DECIMAL(10,2) et DECIMAL(5,2).

alter table stock.recipes
  alter column total_cost type decimal(14, 2),
  alter column cost_per_portion type decimal(14, 2),
  alter column suggested_price type decimal(14, 2),
  alter column final_price type decimal(14, 2),
  alter column cost_ratio type decimal(10, 2),
  alter column margin_rate type decimal(10, 2),
  alter column margin_coefficient type decimal(10, 4);

alter table stock.recipe_ingredients
  alter column quantity type decimal(14, 4),
  alter column unit_price type decimal(14, 2),
  alter column total_cost type decimal(14, 2);

alter table stock.pending_ingredients
  alter column quantity type decimal(14, 4),
  alter column unit_price type decimal(14, 2);

create or replace function stock.refresh_recipe_costs(recipe_uuid uuid)
returns void as $$
declare
  total decimal(14, 2) := 0;
  suggested decimal(14, 2) := 0;
  recipe_record record;
begin
  select * into recipe_record from stock.recipes where id = recipe_uuid;

  select coalesce(sum(total_cost), 0) into total
  from stock.recipe_ingredients
  where recipe_id = recipe_uuid;

  suggested = total * coalesce(recipe_record.margin_coefficient, 3);

  update stock.recipes
  set
    total_cost = total,
    cost_per_portion = total / nullif(portions, 0),
    suggested_price = suggested,
    cost_ratio = case when final_price > 0 then (total / final_price) * 100 else 0 end,
    margin_rate = case when final_price > 0 then ((final_price - total) / final_price) * 100 else 0 end
  where id = recipe_uuid;
end;
$$ LANGUAGE plpgsql security definer set search_path = stock, public, auth;
