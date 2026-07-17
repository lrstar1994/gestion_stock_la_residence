create schema if not exists stock;
set search_path = stock, public, auth;

alter table stock.articles
  add column if not exists usable_in_recipes boolean not null default false;

update stock.articles article
set usable_in_recipes = true
where exists (
  select 1
  from stock.recipe_ingredients ingredient
  where ingredient.article_id = article.id
);

create index if not exists idx_articles_usable_in_recipes
  on stock.articles(usable_in_recipes);

notify pgrst, 'reload schema';
