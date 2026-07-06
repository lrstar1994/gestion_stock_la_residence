create schema if not exists stock;
set search_path = stock, public, auth;

-- Les produits finis vendus depuis une fiche technique ne sont pas toujours
-- representes par un article stock vendable directement.
ALTER TABLE stock.sale_items
  ALTER COLUMN article_id DROP NOT NULL;

