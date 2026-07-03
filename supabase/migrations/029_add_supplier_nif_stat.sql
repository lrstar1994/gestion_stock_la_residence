create schema if not exists stock;
set search_path = stock, public, auth;

ALTER TABLE stock.suppliers
  ADD COLUMN IF NOT EXISTS nif TEXT,
  ADD COLUMN IF NOT EXISTS stat TEXT;

CREATE INDEX IF NOT EXISTS idx_suppliers_nif ON stock.suppliers(nif);
CREATE INDEX IF NOT EXISTS idx_suppliers_stat ON stock.suppliers(stat);
