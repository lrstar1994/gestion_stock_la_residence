create schema if not exists stock;
set search_path = stock, public, auth;

-- Complements receptions : documents globaux et historique

CREATE TABLE IF NOT EXISTS reception_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id UUID REFERENCES receptions(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  document_type TEXT DEFAULT 'facture',
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id)
);

ALTER TABLE reception_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage reception documents" ON reception_documents;
CREATE POLICY "Staff can manage reception documents"
  ON reception_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can view reception documents" ON reception_documents;
CREATE POLICY "Users can view reception documents"
  ON reception_documents FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS reception_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id UUID REFERENCES receptions(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE reception_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reception history" ON reception_history;
CREATE POLICY "Users can view reception history"
  ON reception_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can insert reception history" ON reception_history;
CREATE POLICY "Staff can insert reception history"
  ON reception_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reception-documents',
  'reception-documents',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Reception documents are readable" ON storage.objects;
CREATE POLICY "Reception documents are readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reception-documents' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Reception staff can upload documents" ON storage.objects;
CREATE POLICY "Reception staff can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reception-documents'
    AND EXISTS (
      SELECT 1 FROM stock.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'magasinier')
      AND profiles.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_reception_documents_reception_id ON reception_documents(reception_id);
CREATE INDEX IF NOT EXISTS idx_reception_history_reception_id ON reception_history(reception_id);
