create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- MODULE VENTES
-- ==============================================

DO $$ BEGIN
  CREATE TYPE sales_channel AS ENUM (
    'whatsapp', 'facebook', 'telephone',
    'reception', 'client_direct', 'formulaire', 'commercial'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_mode AS ENUM (
    'sur_place', 'take_away', 'livraison',
    'room_service', 'evenement', 'seminaire'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sales_point AS ENUM (
    'le_privilege', 'piscine', 'reception',
    'chambre', 'evenement', 'take_away'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_type AS ENUM ('produit_fini', 'produit_brut');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sales_status AS ENUM ('validee', 'annulee', 'retournee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL,
  channel sales_channel NOT NULL,
  service_mode service_mode NOT NULL,
  sales_point sales_point NOT NULL,
  client_name TEXT,
  comment TEXT,
  total_before_discount DECIMAL(10, 2) DEFAULT 0,
  total_discount DECIMAL(10, 2) DEFAULT 0,
  total_after_discount DECIMAL(10, 2) DEFAULT 0,
  event_id UUID REFERENCES events(id),
  status sales_status DEFAULT 'validee',
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage all sales" ON sales;
CREATE POLICY "Directors can manage all sales"
  ON sales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'direction'
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Sales staff can manage sales" ON sales;
CREATE POLICY "Sales staff can manage sales"
  ON sales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('point_vente', 'chef_cuisine')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "All users can view sales" ON sales;
CREATE POLICY "All users can view sales"
  ON sales FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES articles(id) NOT NULL,
  product_type product_type NOT NULL,
  quantity INTEGER NOT NULL,
  quantity_offered INTEGER DEFAULT 0,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) GENERATED ALWAYS AS ((quantity - quantity_offered) * unit_price) STORED,
  discount DECIMAL(10, 2) DEFAULT 0,
  total_after_discount DECIMAL(10, 2) GENERATED ALWAYS AS ((((quantity - quantity_offered) * unit_price) - discount)) STORED,
  offer_reason TEXT,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage sale items" ON sale_items;
CREATE POLICY "Staff can manage sale items"
  ON sale_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'point_vente', 'chef_cuisine')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view sale items" ON sale_items;
CREATE POLICY "Users can view sale items"
  ON sale_items FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS sale_stock_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  sale_item_id UUID REFERENCES sale_items(id) ON DELETE CASCADE NOT NULL,
  stock_out_id UUID REFERENCES stock_outs(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE sale_stock_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage sale stock outs" ON sale_stock_outs;
CREATE POLICY "Staff can manage sale stock outs"
  ON sale_stock_outs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'point_vente', 'chef_cuisine')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view sale stock outs" ON sale_stock_outs;
CREATE POLICY "Users can view sale stock outs"
  ON sale_stock_outs FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION generate_sale_reference()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'SALE-' || TO_CHAR(NEW.sale_date, 'YYYY-MM') || '-';
  SELECT COALESCE(MAX(CAST(REPLACE(reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM sales
  WHERE reference LIKE prefix || '%';

  NEW.reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

DROP TRIGGER IF EXISTS generate_sale_reference_trigger ON sales;
CREATE TRIGGER generate_sale_reference_trigger
  BEFORE INSERT ON sales
  FOR EACH ROW
  WHEN (NEW.reference IS NULL)
  EXECUTE FUNCTION generate_sale_reference();

CREATE INDEX IF NOT EXISTS idx_sales_reference ON sales(reference);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales(channel);
CREATE INDEX IF NOT EXISTS idx_sales_service_mode ON sales(service_mode);
CREATE INDEX IF NOT EXISTS idx_sales_sales_point ON sales(sales_point);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_event_id ON sales(event_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_article_id ON sale_items(article_id);
CREATE INDEX IF NOT EXISTS idx_sale_stock_outs_sale_id ON sale_stock_outs(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_stock_outs_stock_out_id ON sale_stock_outs(stock_out_id);

-- Autoriser le point de vente a creer les sorties et mouvements lies aux ventes.
DROP POLICY IF EXISTS "Directors and Chef can manage stock outs" ON stock_outs;
CREATE POLICY "Directors and Chef can manage stock outs"
  ON stock_outs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'chef_cuisine', 'magasinier', 'point_vente')
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
      AND profiles.role IN ('magasinier', 'chef_cuisine', 'point_vente')
      AND profiles.status = 'active'
    )
    AND status != 'annule'
  );
