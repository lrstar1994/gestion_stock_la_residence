create schema if not exists stock;
set search_path = stock, public, auth;

-- Receptions historiques : elles servent au rattachement comptable
-- d'anciennes factures, sans generer d'entree en stock.

ALTER TABLE receptions
  ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_receptions_is_historical ON receptions(is_historical);
