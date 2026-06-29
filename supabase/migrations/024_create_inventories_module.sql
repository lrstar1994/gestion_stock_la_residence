create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- MODULE INVENTAIRES ET ECARTS
-- ==============================================

DO $$ BEGIN
  CREATE TYPE inventory_type AS ENUM ('initial', 'periodique', 'exceptionnel', 'controle');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE inventory_status AS ENUM ('brouillon', 'en_attente', 'valide', 'corrige', 'archive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  location_id UUID REFERENCES locations(id) NOT NULL,
  inventory_date DATE NOT NULL,
  type inventory_type NOT NULL,
  comment TEXT,
  status inventory_status DEFAULT 'brouillon',
  total_positive_difference DECIMAL(14, 4) DEFAULT 0,
  total_negative_difference DECIMAL(14, 4) DEFAULT 0,
  total_difference DECIMAL(14, 4) DEFAULT 0,
  total_value_difference DECIMAL(14, 2) DEFAULT 0,
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  validation_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage all inventories" ON inventories;
CREATE POLICY "Directors can manage all inventories"
  ON inventories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'direction'
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Magasinier can manage inventories" ON inventories;
CREATE POLICY "Magasinier can manage inventories"
  ON inventories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'magasinier'
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "All users can view inventories" ON inventories;
CREATE POLICY "All users can view inventories"
  ON inventories FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_inventories_updated_at ON inventories;
CREATE TRIGGER update_inventories_updated_at
  BEFORE UPDATE ON inventories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventories(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES articles(id) NOT NULL,
  theoretical_quantity DECIMAL(14, 4) NOT NULL,
  counted_quantity DECIMAL(14, 4) NOT NULL,
  difference DECIMAL(14, 4) GENERATED ALWAYS AS (counted_quantity - theoretical_quantity) STORED,
  unit_id UUID REFERENCES units(id) NOT NULL,
  unit_price DECIMAL(14, 2),
  value_difference DECIMAL(14, 2) GENERATED ALWAYS AS ((counted_quantity - theoretical_quantity) * COALESCE(unit_price, 0)) STORED,
  reason TEXT,
  stock_movement_id UUID REFERENCES stock_movements(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage inventory items" ON inventory_items;
CREATE POLICY "Staff can manage inventory items"
  ON inventory_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view inventory items" ON inventory_items;
CREATE POLICY "Users can view inventory items"
  ON inventory_items FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION generate_inventory_reference()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'INVST-' || TO_CHAR(NEW.inventory_date, 'YYYY-MM') || '-';
  SELECT COALESCE(MAX(CAST(REPLACE(reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM inventories
  WHERE reference LIKE prefix || '%';

  NEW.reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

DROP TRIGGER IF EXISTS generate_inventory_reference_trigger ON inventories;
CREATE TRIGGER generate_inventory_reference_trigger
  BEFORE INSERT ON inventories
  FOR EACH ROW
  WHEN (NEW.reference IS NULL)
  EXECUTE FUNCTION generate_inventory_reference();

CREATE INDEX IF NOT EXISTS idx_inventories_reference ON inventories(reference);
CREATE INDEX IF NOT EXISTS idx_inventories_location_id ON inventories(location_id);
CREATE INDEX IF NOT EXISTS idx_inventories_inventory_date ON inventories(inventory_date);
CREATE INDEX IF NOT EXISTS idx_inventories_status ON inventories(status);
CREATE INDEX IF NOT EXISTS idx_inventories_type ON inventories(type);
CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory_id ON inventory_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_article_id ON inventory_items(article_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_stock_movement_id ON inventory_items(stock_movement_id);
