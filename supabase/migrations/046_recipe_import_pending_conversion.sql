create schema if not exists stock;
set search_path = stock, public, auth;

-- Patch 7 V1 : import fiches techniques avec ingredients inconnus.
-- Ajout d'un facteur manuel sur les ingredients en attente pour resoudre les unites non compatibles.

alter table stock.pending_ingredients
  add column if not exists conversion_factor numeric(18, 8);

create index if not exists idx_pending_ingredients_imported_name_status
  on stock.pending_ingredients(imported_name, status);

notify pgrst, 'reload schema';
