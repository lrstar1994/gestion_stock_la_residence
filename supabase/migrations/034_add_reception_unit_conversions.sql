create schema if not exists stock;
set search_path = stock, public, auth;

-- Permet de receptionner dans une unite fournisseur differente de l'unite de stock.
-- Les champs historiques quantity_delivered, quantity_accepted, unit_id et unit_price_real
-- restent les valeurs converties dans l'unite de stock de l'article.

ALTER TABLE stock.reception_items
  ADD COLUMN IF NOT EXISTS quantity_delivered_display DECIMAL(14, 4),
  ADD COLUMN IF NOT EXISTS quantity_accepted_display DECIMAL(14, 4),
  ADD COLUMN IF NOT EXISTS unit_display_id UUID REFERENCES stock.units(id),
  ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(18, 8) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price_display DECIMAL(14, 4);

UPDATE stock.reception_items
SET
  quantity_delivered_display = COALESCE(quantity_delivered_display, quantity_delivered),
  quantity_accepted_display = COALESCE(quantity_accepted_display, quantity_accepted),
  unit_display_id = COALESCE(unit_display_id, unit_id),
  conversion_factor = COALESCE(conversion_factor, 1),
  unit_price_display = COALESCE(unit_price_display, unit_price_real)
WHERE quantity_delivered_display IS NULL
   OR quantity_accepted_display IS NULL
   OR unit_display_id IS NULL
   OR conversion_factor IS NULL
   OR unit_price_display IS NULL;

CREATE INDEX IF NOT EXISTS idx_reception_items_unit_display_id ON stock.reception_items(unit_display_id);

