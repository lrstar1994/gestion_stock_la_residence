create schema if not exists stock;
set search_path = stock, public, auth;

-- Conversion d'unites dans les ventes.
-- quantity reste la quantite saisie/vendue par l'utilisateur.
-- quantity_stock est la quantite convertie dans l'unite de stock de l'article.

INSERT INTO units (name, abbreviation)
VALUES ('Centilitre', 'cl')
ON CONFLICT (abbreviation) DO NOTHING;

ALTER TABLE sale_items
  DROP COLUMN IF EXISTS total,
  DROP COLUMN IF EXISTS total_after_discount;

ALTER TABLE sale_items
  ALTER COLUMN quantity TYPE DECIMAL(14, 4) USING quantity::DECIMAL(14, 4),
  ALTER COLUMN quantity_offered TYPE DECIMAL(14, 4) USING quantity_offered::DECIMAL(14, 4);

ALTER TABLE sale_items
  ALTER COLUMN returned_quantity TYPE DECIMAL(14, 4) USING returned_quantity::DECIMAL(14, 4);

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS unit_display_id UUID REFERENCES units(id),
  ADD COLUMN IF NOT EXISTS unit_stock_id UUID REFERENCES units(id),
  ADD COLUMN IF NOT EXISTS quantity_stock DECIMAL(14, 4),
  ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(18, 8) DEFAULT 1;

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS total DECIMAL(14, 2) GENERATED ALWAYS AS ((quantity - quantity_offered) * unit_price) STORED,
  ADD COLUMN IF NOT EXISTS total_after_discount DECIMAL(14, 2) GENERATED ALWAYS AS ((((quantity - quantity_offered) * unit_price) - discount)) STORED;

CREATE INDEX IF NOT EXISTS idx_sale_items_unit_display_id ON sale_items(unit_display_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_unit_stock_id ON sale_items(unit_stock_id);
