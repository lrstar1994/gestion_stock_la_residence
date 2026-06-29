create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- MODULE FACTURES ET PAIEMENTS
-- ==============================================

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'a_verifier', 'validee', 'a_payer',
    'payee', 'partiellement_paye', 'conteste',
    'cloturee', 'annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_mode AS ENUM (
    'especes', 'virement', 'mobile_money',
    'cheque', 'credit_fournisseur', 'autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  comment TEXT,
  amount_ht DECIMAL(14, 2) NOT NULL,
  amount_tva DECIMAL(14, 2) DEFAULT 0,
  amount_ttc DECIMAL(14, 2) GENERATED ALWAYS AS (amount_ht + amount_tva) STORED,
  amount_paid DECIMAL(14, 2) DEFAULT 0,
  amount_remaining DECIMAL(14, 2) GENERATED ALWAYS AS (amount_ht + amount_tva - amount_paid) STORED,
  reception_id UUID REFERENCES receptions(id),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  cash_purchase_id UUID REFERENCES cash_purchases(id),
  status invoice_status DEFAULT 'a_verifier',
  payment_mode payment_mode,
  payment_date DATE,
  payment_reference TEXT,
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  validation_comment TEXT,
  file_url TEXT,
  file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  UNIQUE(supplier_id, invoice_number)
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors and Accounting can manage invoices" ON invoices;
CREATE POLICY "Directors and Accounting can manage invoices"
  ON invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'comptabilite')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "All users can view invoices" ON invoices;
CREATE POLICY "All users can view invoices"
  ON invoices FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES articles(id) NOT NULL,
  quantity DECIMAL(14, 4) NOT NULL,
  unit_id UUID REFERENCES units(id) NOT NULL,
  unit_price DECIMAL(14, 2) NOT NULL,
  total DECIMAL(14, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage invoice items" ON invoice_items;
CREATE POLICY "Staff can manage invoice items"
  ON invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'comptabilite')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view invoice items" ON invoice_items;
CREATE POLICY "Users can view invoice items"
  ON invoice_items FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  payment_date DATE NOT NULL,
  payment_reference TEXT,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage payments" ON invoice_payments;
CREATE POLICY "Staff can manage payments"
  ON invoice_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'comptabilite', 'caisse')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view payments" ON invoice_payments;
CREATE POLICY "Users can view payments"
  ON invoice_payments FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION generate_invoice_reference()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  prefix TEXT;
BEGIN
  prefix := 'INV-' || TO_CHAR(NEW.invoice_date, 'YYYY-MM') || '-';
  SELECT COALESCE(MAX(CAST(REPLACE(reference, prefix, '') AS INTEGER)), 0) + 1
  INTO next_num
  FROM invoices
  WHERE reference LIKE prefix || '%';

  NEW.reference = prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

DROP TRIGGER IF EXISTS generate_invoice_reference_trigger ON invoices;
CREATE TRIGGER generate_invoice_reference_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.reference IS NULL)
  EXECUTE FUNCTION generate_invoice_reference();

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-files', 'invoice-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can view invoice files" ON storage.objects;
CREATE POLICY "Users can view invoice files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'invoice-files');

DROP POLICY IF EXISTS "Accounting can upload invoice files" ON storage.objects;
CREATE POLICY "Accounting can upload invoice files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoice-files'
    AND auth.uid() IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_invoices_reference ON invoices(reference);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_reception_id ON invoices(reception_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_article_id ON invoice_items(article_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
