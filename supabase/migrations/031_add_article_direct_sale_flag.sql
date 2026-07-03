alter table stock.articles
  add column if not exists sellable_without_transformation boolean not null default false;

create index if not exists idx_articles_sellable_without_transformation
  on stock.articles(sellable_without_transformation);
