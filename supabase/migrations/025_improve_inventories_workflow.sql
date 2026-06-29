create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- AMELIORATIONS INVENTAIRES : AJUSTEMENTS ET PARAMETRES
-- ==============================================

CREATE TABLE IF NOT EXISTS inventory_adjustment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventories(id) ON DELETE CASCADE NOT NULL,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES articles(id) NOT NULL,
  location_id UUID REFERENCES locations(id) NOT NULL,
  original_counted_quantity DECIMAL(14, 4) NOT NULL,
  proposed_counted_quantity DECIMAL(14, 4) NOT NULL,
  adjustment_difference DECIMAL(14, 4) GENERATED ALWAYS AS (proposed_counted_quantity - original_counted_quantity) STORED,
  unit_id UUID REFERENCES units(id) NOT NULL,
  unit_price DECIMAL(14, 2) DEFAULT 0,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'en_attente',
  stock_movement_id UUID REFERENCES stock_movements(id),
  requested_by UUID REFERENCES profiles(id),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  validation_comment TEXT
);

ALTER TABLE inventory_adjustment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can create inventory adjustment requests" ON inventory_adjustment_requests;
CREATE POLICY "Staff can create inventory adjustment requests"
  ON inventory_adjustment_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Directors can manage inventory adjustment requests" ON inventory_adjustment_requests;
CREATE POLICY "Directors can manage inventory adjustment requests"
  ON inventory_adjustment_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'direction'
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view inventory adjustment requests" ON inventory_adjustment_requests;
CREATE POLICY "Users can view inventory adjustment requests"
  ON inventory_adjustment_requests FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_inventory_id ON inventory_adjustment_requests(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_item_id ON inventory_adjustment_requests(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_status ON inventory_adjustment_requests(status);
