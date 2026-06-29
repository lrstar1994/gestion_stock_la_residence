create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- MODULE SORTIES DE STOCK ET PRODUCTION
-- ==============================================

DO $$ BEGIN
  CREATE TYPE stock_out_destination AS ENUM (
    'recette', 'production', 'buffet', 'seminaire',
    'restaurant', 'take_away', 'piscine', 'chambre',
    'maintenance', 'entretien', 'consommation_interne',
    'perte', 'casse', 'autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE consumption_type AS ENUM ('normale', 'surconsommation', 'economie', 'perte');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE loss_type AS ENUM ('casse', 'erreur', 'qualite', 'autre');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS stock_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  article_id UUID REFERENCES articles(id) NOT NULL,
  quantity DECIMAL(14, 4) NOT NULL,
  unit_id UUID REFERENCES units(id) NOT NULL,
  location_id UUID REFERENCES locations(id) NOT NULL,
  destination stock_out_destination NOT NULL,
  out_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recipe_id UUID REFERENCES recipes(id),
  event_id UUID REFERENCES events(id),
  production_id UUID,
  stock_movement_id UUID REFERENCES stock_movements(id),
  return_movement_id UUID REFERENCES stock_movements(id),
  theoretical_quantity DECIMAL(14, 4),
  difference DECIMAL(14, 4) GENERATED ALWAYS AS (quantity - COALESCE(theoretical_quantity, 0)) STORED,
  consumption_type consumption_type,
  is_loss BOOLEAN DEFAULT FALSE,
  loss_type loss_type,
  loss_comment TEXT,
  is_additional BOOLEAN DEFAULT FALSE,
  is_return BOOLEAN DEFAULT FALSE,
  return_quantity DECIMAL(14, 4),
  reason TEXT NOT NULL,
  comment TEXT,
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'valide'
);

ALTER TABLE stock_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors and Chef can manage stock outs" ON stock_outs;
CREATE POLICY "Directors and Chef can manage stock outs"
  ON stock_outs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'chef_cuisine', 'magasinier')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "All users can view stock outs" ON stock_outs;
CREATE POLICY "All users can view stock outs"
  ON stock_outs FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_stock_outs_updated_at ON stock_outs;
CREATE TRIGGER update_stock_outs_updated_at
  BEFORE UPDATE ON stock_outs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION generate_stock_out_reference()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'SO-' || TO_CHAR(NEW.out_date, 'YYYY-MM') || '-';
  SELECT COALESCE(MAX(CAST(REPLACE(reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM stock_outs
  WHERE reference LIKE prefix || '%';

  NEW.reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

DROP TRIGGER IF EXISTS generate_stock_out_reference_trigger ON stock_outs;
CREATE TRIGGER generate_stock_out_reference_trigger
  BEFORE INSERT ON stock_outs
  FOR EACH ROW
  WHEN (NEW.reference IS NULL)
  EXECUTE FUNCTION generate_stock_out_reference();

CREATE INDEX IF NOT EXISTS idx_stock_outs_reference ON stock_outs(reference);
CREATE INDEX IF NOT EXISTS idx_stock_outs_article_id ON stock_outs(article_id);
CREATE INDEX IF NOT EXISTS idx_stock_outs_out_date ON stock_outs(out_date);
CREATE INDEX IF NOT EXISTS idx_stock_outs_destination ON stock_outs(destination);
CREATE INDEX IF NOT EXISTS idx_stock_outs_location_id ON stock_outs(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_outs_recipe_id ON stock_outs(recipe_id);
CREATE INDEX IF NOT EXISTS idx_stock_outs_event_id ON stock_outs(event_id);
CREATE INDEX IF NOT EXISTS idx_stock_outs_consumption_type ON stock_outs(consumption_type);
CREATE INDEX IF NOT EXISTS idx_stock_outs_status ON stock_outs(status);
