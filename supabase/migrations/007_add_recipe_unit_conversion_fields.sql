create schema if not exists stock;
set search_path = stock, public, auth;

-- Migration : quantites affichees et quantites stockees pour les fiches techniques

alter table stock.recipe_ingredients
  add column if not exists quantity_display decimal(14, 4),
  add column if not exists unit_display uuid references stock.units(id),
  add column if not exists quantity_stored decimal(14, 4),
  add column if not exists unit_stored uuid references stock.units(id),
  add column if not exists conversion_factor decimal(18, 8);

update stock.recipe_ingredients ingredient
set
  quantity_display = coalesce(ingredient.quantity_display, ingredient.quantity),
  unit_display = coalesce(ingredient.unit_display, ingredient.unit_id),
  quantity_stored = coalesce(ingredient.quantity_stored, ingredient.quantity),
  unit_stored = coalesce(ingredient.unit_stored, article.unit_id),
  conversion_factor = coalesce(ingredient.conversion_factor, 1)
from stock.articles article
where ingredient.article_id = article.id;

create or replace function stock.set_recipe_ingredient_total()
returns trigger as $$
begin
  new.total_cost = coalesce(new.quantity_stored, new.quantity) * new.unit_price;
  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

create or replace function stock.recalculate_recipe_costs(recipe_uuid uuid)
returns void as $$
declare
  total decimal(14, 2) := 0;
  recipe_record record;
  suggested decimal(14, 2) := 0;
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
