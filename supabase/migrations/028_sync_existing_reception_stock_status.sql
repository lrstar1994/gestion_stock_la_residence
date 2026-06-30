create schema if not exists stock;
set search_path = stock, public, auth;

-- Corrige les receptions deja integrees en stock mais restees au statut "validee".
UPDATE stock.stock_pending_movements pending
SET status = 'integrated'
WHERE pending.status = 'pending_stock_module'
  AND EXISTS (
    SELECT 1
    FROM stock.stock_movements movement
    WHERE movement.reception_item_id = pending.reception_item_id
  );

UPDATE stock.receptions reception
SET
  status = 'entree_stock',
  updated_at = NOW()
WHERE reception.status IN ('validee', 'validee_avec_anomalies')
  AND EXISTS (
    SELECT 1
    FROM stock.stock_movements movement
    WHERE movement.reference_type = 'reception'
      AND movement.reference_id = reception.id
  );
