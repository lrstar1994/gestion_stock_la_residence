create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- MODULE STOCK ET TRANSFERTS INTERNES
-- ==============================================

DO $$ BEGIN
  CREATE TYPE movement_type AS ENUM (
    'entree', 'sortie', 'transfert', 'retour',
    'perte', 'consommation', 'correction', 'ajustement'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE movement_status AS ENUM ('normal', 'retroactif', 'annule', 'en_attente', 'valide');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE price_source_type AS ENUM ('reception', 'manual', 'average', 'correction');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_id UUID REFERENCES units(id) NOT NULL,
  movement_type movement_type NOT NULL,
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  movement_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  reference_type TEXT,
  reference_id UUID,
  reception_item_id UUID REFERENCES reception_items(id),
  status movement_status DEFAULT 'normal',
  is_retroactive BOOLEAN DEFAULT FALSE,
  retroactive_date DATE,
  retroactive_reason TEXT,
  retroactive_validated_by UUID REFERENCES profiles(id),
  retroactive_validated_at TIMESTAMP WITH TIME ZONE,
  is_manual BOOLEAN DEFAULT FALSE,
  manual_reason TEXT,
  manual_validated_by UUID REFERENCES profiles(id),
  manual_validated_at TIMESTAMP WITH TIME ZONE,
  comment TEXT,
  movement_reference TEXT UNIQUE,
  unit_cost DECIMAL(10, 2),
  price_source price_source_type DEFAULT 'reception',
  total_cost DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost, 0)) STORED
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage all movements" ON stock_movements;
CREATE POLICY "Directors can manage all movements"
  ON stock_movements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'direction'
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Staff can manage movements" ON stock_movements;
CREATE POLICY "Staff can manage movements"
  ON stock_movements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('magasinier', 'chef_cuisine')
      AND profiles.status = 'active'
    )
    AND status != 'annule'
  );

DROP POLICY IF EXISTS "All users can view movements" ON stock_movements;
CREATE POLICY "All users can view movements"
  ON stock_movements FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_stock_movements_updated_at ON stock_movements;
CREATE TRIGGER update_stock_movements_updated_at
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION generate_movement_reference()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'MV-' || TO_CHAR(NEW.movement_date, 'YYYY-MM-DD') || '-';

  SELECT COALESCE(MAX(CAST(REPLACE(movement_reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM stock_movements
  WHERE movement_reference LIKE prefix || '%';

  NEW.movement_reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

DROP TRIGGER IF EXISTS generate_movement_reference_trigger ON stock_movements;
CREATE TRIGGER generate_movement_reference_trigger
  BEFORE INSERT ON stock_movements
  FOR EACH ROW
  WHEN (NEW.movement_reference IS NULL)
  EXECUTE FUNCTION generate_movement_reference();

CREATE OR REPLACE FUNCTION handle_movement_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_price DECIMAL(10, 2);
  v_avg_price DECIMAL(10, 2);
BEGIN
  IF NEW.reception_item_id IS NOT NULL THEN
    SELECT unit_price_real INTO v_unit_price
    FROM reception_items
    WHERE id = NEW.reception_item_id;

    NEW.unit_cost = v_unit_price;
    NEW.price_source = 'reception';
  ELSIF NEW.movement_type IN ('sortie', 'transfert', 'perte', 'consommation') THEN
    SELECT COALESCE(AVG(unit_cost), 0) INTO v_avg_price
    FROM stock_movements
    WHERE article_id = NEW.article_id
    AND movement_type = 'entree'
    AND unit_cost IS NOT NULL
    AND status IN ('normal', 'retroactif', 'valide');

    NEW.unit_cost = v_avg_price;
    NEW.price_source = 'average';
  ELSIF NEW.unit_cost IS NOT NULL THEN
    NEW.price_source = CASE
      WHEN NEW.movement_type IN ('correction', 'ajustement') THEN 'correction'::price_source_type
      ELSE 'manual'::price_source_type
    END;
  ELSE
    RAISE EXCEPTION 'Le prix unitaire est obligatoire pour ce type de mouvement';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

DROP TRIGGER IF EXISTS handle_movement_cost_trigger ON stock_movements;
CREATE TRIGGER handle_movement_cost_trigger
  BEFORE INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION handle_movement_cost();

CREATE OR REPLACE VIEW stock_location_view AS
SELECT article_id, to_location_id AS location_id, unit_id, SUM(quantity) AS quantity
FROM stock_movements
WHERE movement_type IN ('entree', 'retour', 'correction', 'ajustement')
AND to_location_id IS NOT NULL
AND status IN ('normal', 'retroactif', 'valide')
GROUP BY article_id, to_location_id, unit_id
UNION ALL
SELECT article_id, from_location_id AS location_id, unit_id, SUM(-quantity) AS quantity
FROM stock_movements
WHERE movement_type IN ('sortie', 'perte', 'consommation', 'transfert')
AND from_location_id IS NOT NULL
AND status IN ('normal', 'retroactif', 'valide')
GROUP BY article_id, from_location_id, unit_id
UNION ALL
SELECT article_id, to_location_id AS location_id, unit_id, SUM(quantity) AS quantity
FROM stock_movements
WHERE movement_type = 'transfert'
AND to_location_id IS NOT NULL
AND status IN ('normal', 'retroactif', 'valide')
GROUP BY article_id, to_location_id, unit_id;

CREATE OR REPLACE VIEW stock_view AS
SELECT
  article_id,
  SUM(quantity) AS total_quantity,
  MAX(CASE WHEN movement_type = 'entree' THEN unit_cost END) AS last_price,
  AVG(CASE WHEN movement_type = 'entree' THEN unit_cost END) AS average_price
FROM (
  SELECT article_id, unit_id, quantity, movement_type, unit_cost
  FROM stock_movements
  WHERE movement_type IN ('entree', 'retour', 'correction', 'ajustement')
  AND status IN ('normal', 'retroactif', 'valide')
  UNION ALL
  SELECT article_id, unit_id, -quantity, movement_type, unit_cost
  FROM stock_movements
  WHERE movement_type IN ('sortie', 'perte', 'consommation')
  AND status IN ('normal', 'retroactif', 'valide')
  UNION ALL
  SELECT article_id, unit_id, 0, movement_type, unit_cost
  FROM stock_movements
  WHERE movement_type = 'transfert'
  AND status IN ('normal', 'retroactif', 'valide')
) movements
GROUP BY article_id;

CREATE OR REPLACE VIEW price_history_view AS
SELECT
  id,
  article_id,
  movement_date,
  unit_cost,
  quantity,
  price_source,
  reference_type,
  reference_id,
  movement_reference,
  created_at
FROM stock_movements
WHERE movement_type IN ('entree', 'correction', 'ajustement')
AND unit_cost IS NOT NULL
AND status IN ('normal', 'retroactif', 'valide')
ORDER BY movement_date DESC;

CREATE INDEX IF NOT EXISTS idx_stock_movements_article_id ON stock_movements(article_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_from_location ON stock_movements(from_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_to_location ON stock_movements(to_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_type ON stock_movements(reference_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_id ON stock_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_reference ON stock_movements(movement_reference);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reception_item_id ON stock_movements(reception_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_price_source ON stock_movements(price_source);
CREATE INDEX IF NOT EXISTS idx_stock_movements_article_date ON stock_movements(article_id, movement_date DESC);
