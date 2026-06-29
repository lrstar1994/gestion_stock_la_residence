create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- AMELIORATIONS VENTES : RECETTES, OFFRES, RETOURS
-- ==============================================

ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES recipes(id);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS return_reason TEXT;

CREATE TABLE IF NOT EXISTS sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  sale_item_id UUID REFERENCES sale_items(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  stock_movement_id UUID REFERENCES stock_movements(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE sale_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage sale returns" ON sale_returns;
CREATE POLICY "Directors can manage sale returns"
  ON sale_returns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'direction'
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view sale returns" ON sale_returns;
CREATE POLICY "Users can view sale returns"
  ON sale_returns FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_sale_items_recipe_id ON sale_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_item_id ON sale_returns(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_stock_movement_id ON sale_returns(stock_movement_id);
