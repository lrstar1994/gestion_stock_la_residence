create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- MODULE COMMANDES FOURNISSEURS
-- ==============================================

DO $$ BEGIN
  CREATE TYPE purchase_order_status AS ENUM (
    'brouillon', 'validee', 'envoyee',
    'partiellement_livree', 'livree',
    'reception_avec_ecart', 'annulee', 'cloturee'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  order_date DATE DEFAULT CURRENT_DATE,
  delivery_date DATE NOT NULL,
  supplier_reference TEXT,
  payment_terms TEXT,
  delivery_mode TEXT,
  comment TEXT,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  validation_comment TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID REFERENCES profiles(id),
  file_url TEXT,
  status purchase_order_status DEFAULT 'brouillon',
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES profiles(id),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage all orders" ON purchase_orders;
CREATE POLICY "Directors can manage all orders"
  ON purchase_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'direction'
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Buyers can manage orders" ON purchase_orders;
CREATE POLICY "Buyers can manage orders"
  ON purchase_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'acheteur'
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "All users can view orders" ON purchase_orders;
CREATE POLICY "All users can view orders"
  ON purchase_orders FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES articles(id) NOT NULL,
  quantity_ordered DECIMAL(10, 2) NOT NULL,
  quantity_received DECIMAL(10, 2) DEFAULT 0,
  quantity_remaining DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_ordered - quantity_received) STORED,
  unit_id UUID REFERENCES units(id) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_ordered * unit_price) STORED,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage order items" ON purchase_order_items;
CREATE POLICY "Staff can manage order items"
  ON purchase_order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'acheteur', 'magasinier')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view order items" ON purchase_order_items;
CREATE POLICY "Users can view order items"
  ON purchase_order_items FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_purchase_order_items_updated_at ON purchase_order_items;
CREATE TRIGGER update_purchase_order_items_updated_at
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS purchase_order_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  need_id UUID REFERENCES purchase_needs(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(purchase_order_id, need_id)
);

ALTER TABLE purchase_order_needs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage order-need links" ON purchase_order_needs;
CREATE POLICY "Staff can manage order-need links"
  ON purchase_order_needs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'acheteur')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view order-need links" ON purchase_order_needs;
CREATE POLICY "Users can view order-need links"
  ON purchase_order_needs FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_reference ON purchase_orders(reference);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery_date ON purchase_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_article_id ON purchase_order_items(article_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_needs_order_id ON purchase_order_needs(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_needs_need_id ON purchase_order_needs(need_id);
