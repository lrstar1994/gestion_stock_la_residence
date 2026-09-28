-- Lot A3 - formes, sous-recettes et snapshots économiques. Local uniquement.
begin;

alter table stock.recipe_ingredients
  add column if not exists line_kind text not null default 'article',
  add column if not exists trim_form_name_snapshot text,
  add column if not exists normalized_price_snapshot numeric(14,2),
  add column if not exists price_effective_at_snapshot timestamptz,
  add column if not exists subrecipe_cost_snapshot numeric(14,2),
  add column if not exists economic_snapshot_at timestamptz;

alter table stock.recipe_ingredients
  add constraint recipe_ingredients_line_kind_chk check (line_kind in ('article','subrecipe'));

alter table stock.recipe_ingredients
  drop constraint if exists recipe_ingredients_article_or_subrecipe_chk;
alter table stock.recipe_ingredients
  add constraint recipe_ingredients_article_or_subrecipe_chk check (
    (line_kind = 'article' and article_id is not null and subrecipe_id is null)
    or
    (line_kind = 'subrecipe' and subrecipe_id is not null and article_id is null)
  );

create or replace function stock.guard_recipe_subrecipe_cycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_cycle boolean;
begin
  if new.subrecipe_id is null then return new; end if;
  if new.recipe_id = new.subrecipe_id then
    raise exception using errcode = '23514', message = 'Une fiche technique ne peut pas se référencer elle-même';
  end if;
  with recursive graph(recipe_id, subrecipe_id) as (
    select ri.recipe_id, ri.subrecipe_id
    from stock.recipe_ingredients ri
    where ri.subrecipe_id is not null
    union all
    select graph.recipe_id, ri.subrecipe_id
    from graph
    join stock.recipe_ingredients ri on ri.recipe_id = graph.subrecipe_id
    where ri.subrecipe_id is not null
  )
  select exists(select 1 from graph where recipe_id = new.subrecipe_id and subrecipe_id = new.recipe_id)
    or exists(select 1 from graph where recipe_id = new.subrecipe_id and subrecipe_id = new.subrecipe_id)
  into v_cycle;
  if v_cycle then
    raise exception using errcode = '23514', message = 'Dépendance circulaire entre fiches techniques';
  end if;
  return new;
end;
$$;

drop trigger if exists recipe_subrecipe_cycle_guard on stock.recipe_ingredients;
create trigger recipe_subrecipe_cycle_guard
before insert or update of recipe_id, subrecipe_id on stock.recipe_ingredients
for each row execute function stock.guard_recipe_subrecipe_cycle();

commit;
