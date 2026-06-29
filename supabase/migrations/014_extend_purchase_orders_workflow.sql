create schema if not exists stock;
set search_path = stock, public, auth;

-- Complements commandes fournisseurs : fichiers, historique, ecarts de reception

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS difference_type TEXT,
  ADD COLUMN IF NOT EXISTS difference_comment TEXT,
  ADD COLUMN IF NOT EXISTS difference_status TEXT DEFAULT 'aucun',
  ADD COLUMN IF NOT EXISTS difference_validated_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS difference_validated_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS purchase_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE purchase_order_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view order history" ON purchase_order_history;
CREATE POLICY "Users can view order history"
  ON purchase_order_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can insert order history" ON purchase_order_history;
CREATE POLICY "Staff can insert order history"
  ON purchase_order_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'acheteur', 'magasinier')
      AND profiles.status = 'active'
    )
  );

CREATE TABLE IF NOT EXISTS purchase_order_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  document_type TEXT DEFAULT 'bon_livraison',
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id)
);

ALTER TABLE purchase_order_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage order documents" ON purchase_order_documents;
CREATE POLICY "Staff can manage order documents"
  ON purchase_order_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'acheteur', 'magasinier')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view order documents" ON purchase_order_documents;
CREATE POLICY "Users can view order documents"
  ON purchase_order_documents FOR SELECT
  USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-order-files',
  'purchase-order-files',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Purchase order files are readable" ON storage.objects;
CREATE POLICY "Purchase order files are readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'purchase-order-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Purchase order staff can upload files" ON storage.objects;
CREATE POLICY "Purchase order staff can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'purchase-order-files'
    AND EXISTS (
      SELECT 1 FROM stock.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'acheteur', 'magasinier')
      AND profiles.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_purchase_order_history_order_id ON purchase_order_history(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_documents_order_id ON purchase_order_documents(purchase_order_id);
