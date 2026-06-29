create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- AMELIORATIONS FACTURES : HISTORIQUE ET DOUBLONS
-- ==============================================

CREATE TABLE IF NOT EXISTS invoice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE invoice_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoice history" ON invoice_history;
CREATE POLICY "Users can view invoice history"
  ON invoice_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can insert invoice history" ON invoice_history;
CREATE POLICY "Staff can insert invoice history"
  ON invoice_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'comptabilite')
      AND profiles.status = 'active'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM invoices
    WHERE reception_id IS NOT NULL
    AND status <> 'annulee'
    GROUP BY reception_id
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_one_active_by_reception
      ON invoices(reception_id)
      WHERE reception_id IS NOT NULL
      AND status <> 'annulee';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoice_history_invoice_id ON invoice_history(invoice_id);
