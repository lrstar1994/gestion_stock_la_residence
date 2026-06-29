create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- MODULE RECEPTIONS
-- ==============================================

DO $$ BEGIN
  CREATE TYPE reception_status AS ENUM (
    'brouillon', 'en_attente', 'validee',
    'validee_avec_anomalies', 'entree_stock', 'refusee'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE quality_status AS ENUM ('conforme', 'non_conforme', 'a_verifier');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE anomaly_type AS ENUM (
    'quantite_manquante', 'prix_different',
    'produit_abime', 'produit_non_conforme',
    'livraison_partielle', 'erreur_facture',
    'achat_non_autorise', 'produit_paye_non_recu'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS receptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  reception_date DATE DEFAULT CURRENT_DATE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  location_id UUID REFERENCES locations(id),
  comment TEXT,
  purchase_order_id UUID REFERENCES purchase_orders(id),
  cash_purchase_id UUID REFERENCES cash_purchases(id),
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  validation_comment TEXT,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  status reception_status DEFAULT 'brouillon',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE receptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors and magasinier can manage receptions" ON receptions;
CREATE POLICY "Directors and magasinier can manage receptions"
  ON receptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "All users can view receptions" ON receptions;
CREATE POLICY "All users can view receptions"
  ON receptions FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_receptions_updated_at ON receptions;
CREATE TRIGGER update_receptions_updated_at
  BEFORE UPDATE ON receptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS reception_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id UUID REFERENCES receptions(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES articles(id) NOT NULL,
  quantity_ordered DECIMAL(10, 2) DEFAULT 0,
  quantity_delivered DECIMAL(10, 2) NOT NULL,
  quantity_accepted DECIMAL(10, 2) NOT NULL,
  quantity_refused DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_delivered - quantity_accepted) STORED,
  unit_id UUID REFERENCES units(id) NOT NULL,
  unit_price_planned DECIMAL(10, 2),
  unit_price_real DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_accepted * unit_price_real) STORED,
  quality quality_status DEFAULT 'conforme',
  quality_comment TEXT,
  has_anomaly BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reception_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage reception items" ON reception_items;
CREATE POLICY "Staff can manage reception items"
  ON reception_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view reception items" ON reception_items;
CREATE POLICY "Users can view reception items"
  ON reception_items FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_reception_items_updated_at ON reception_items;
CREATE TRIGGER update_reception_items_updated_at
  BEFORE UPDATE ON reception_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS reception_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_item_id UUID REFERENCES reception_items(id) ON DELETE CASCADE NOT NULL,
  anomaly_type anomaly_type NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES profiles(id),
  resolution_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reception_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage anomalies" ON reception_anomalies;
CREATE POLICY "Staff can manage anomalies"
  ON reception_anomalies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view anomalies" ON reception_anomalies;
CREATE POLICY "Users can view anomalies"
  ON reception_anomalies FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS stock_pending_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id UUID REFERENCES receptions(id) ON DELETE CASCADE NOT NULL,
  reception_item_id UUID REFERENCES reception_items(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES articles(id) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_id UUID REFERENCES units(id) NOT NULL,
  location_id UUID REFERENCES locations(id),
  movement_type TEXT DEFAULT 'entree_reception',
  status TEXT DEFAULT 'pending_stock_module',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE stock_pending_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view pending stock movements" ON stock_pending_movements;
CREATE POLICY "Users can view pending stock movements"
  ON stock_pending_movements FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can manage pending stock movements" ON stock_pending_movements;
CREATE POLICY "Staff can manage pending stock movements"
  ON stock_pending_movements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reception-anomalies',
  'reception-anomalies',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Reception anomaly photos are readable" ON storage.objects;
CREATE POLICY "Reception anomaly photos are readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reception-anomalies' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Reception staff can upload anomaly photos" ON storage.objects;
CREATE POLICY "Reception staff can upload anomaly photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reception-anomalies'
    AND EXISTS (
      SELECT 1 FROM stock.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_receptions_reference ON receptions(reference);
CREATE INDEX IF NOT EXISTS idx_receptions_supplier_id ON receptions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_receptions_status ON receptions(status);
CREATE INDEX IF NOT EXISTS idx_receptions_reception_date ON receptions(reception_date);
CREATE INDEX IF NOT EXISTS idx_receptions_purchase_order_id ON receptions(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_reception_items_reception_id ON reception_items(reception_id);
CREATE INDEX IF NOT EXISTS idx_reception_items_article_id ON reception_items(article_id);
CREATE INDEX IF NOT EXISTS idx_reception_anomalies_item_id ON reception_anomalies(reception_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_pending_movements_reception_id ON stock_pending_movements(reception_id);
