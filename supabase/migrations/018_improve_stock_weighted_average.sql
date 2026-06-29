create schema if not exists stock;
set search_path = stock, public, auth;

-- ==============================================
-- AMELIORATIONS STOCK : PRIX MOYEN PONDERE
-- ==============================================

CREATE OR REPLACE FUNCTION handle_movement_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_price DECIMAL(10, 2);
  v_avg_price DECIMAL(10, 2);
BEGIN
  IF NEW.reception_item_id IS NOT NULL THEN
    SELECT unit_price_real INTO v_unit_price
    FROM reception_items
    WHERE id = NEW.reception_item_id;

    NEW.unit_cost = v_unit_price;
    NEW.price_source = 'reception';
  ELSIF NEW.movement_type IN ('sortie', 'transfert', 'perte', 'consommation') THEN
    SELECT COALESCE(SUM(quantity * unit_cost) / NULLIF(SUM(quantity), 0), 0)
    INTO v_avg_price
    FROM stock_movements
    WHERE article_id = NEW.article_id
    AND movement_type IN ('entree', 'correction', 'ajustement')
    AND unit_cost IS NOT NULL
    AND quantity > 0
    AND status IN ('normal', 'retroactif', 'valide');

    NEW.unit_cost = v_avg_price;
    NEW.price_source = 'average';
  ELSIF NEW.unit_cost IS NOT NULL THEN
    NEW.price_source = CASE
      WHEN NEW.movement_type IN ('correction', 'ajustement') THEN 'correction'::price_source_type
      ELSE 'manual'::price_source_type
    END;
  ELSE
    RAISE EXCEPTION 'Le prix unitaire est obligatoire pour ce type de mouvement';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = stock, public, auth;

CREATE OR REPLACE VIEW stock_view AS
SELECT
  article_id,
  SUM(quantity) AS total_quantity,
  (
    SELECT sm.unit_cost
    FROM stock_movements sm
    WHERE sm.article_id = movements.article_id
    AND sm.movement_type IN ('entree', 'correction', 'ajustement')
    AND sm.unit_cost IS NOT NULL
    AND sm.status IN ('normal', 'retroactif', 'valide')
    ORDER BY sm.movement_date DESC, sm.created_at DESC
    LIMIT 1
  )::numeric AS last_price,
  (
    SELECT COALESCE(SUM(sm.quantity * sm.unit_cost) / NULLIF(SUM(sm.quantity), 0), 0)
    FROM stock_movements sm
    WHERE sm.article_id = movements.article_id
    AND sm.movement_type IN ('entree', 'correction', 'ajustement')
    AND sm.unit_cost IS NOT NULL
    AND sm.quantity > 0
    AND sm.status IN ('normal', 'retroactif', 'valide')
  )::numeric AS average_price
FROM (
  SELECT article_id, unit_id, quantity, movement_type, unit_cost
  FROM stock_movements
  WHERE movement_type IN ('entree', 'retour', 'correction', 'ajustement')
  AND status IN ('normal', 'retroactif', 'valide')
  UNION ALL
  SELECT article_id, unit_id, -quantity, movement_type, unit_cost
  FROM stock_movements
  WHERE movement_type IN ('sortie', 'perte', 'consommation')
  AND status IN ('normal', 'retroactif', 'valide')
  UNION ALL
  SELECT article_id, unit_id, 0, movement_type, unit_cost
  FROM stock_movements
  WHERE movement_type = 'transfert'
  AND status IN ('normal', 'retroactif', 'valide')
) movements
GROUP BY article_id;

CREATE OR REPLACE VIEW stock_location_view AS
SELECT article_id, location_id, unit_id, SUM(quantity) AS quantity
FROM (
  SELECT article_id, to_location_id AS location_id, unit_id, SUM(quantity) AS quantity
  FROM stock_movements
  WHERE movement_type IN ('entree', 'retour', 'correction', 'ajustement')
  AND to_location_id IS NOT NULL
  AND status IN ('normal', 'retroactif', 'valide')
  GROUP BY article_id, to_location_id, unit_id
  UNION ALL
  SELECT article_id, from_location_id AS location_id, unit_id, SUM(-quantity) AS quantity
  FROM stock_movements
  WHERE movement_type IN ('sortie', 'perte', 'consommation', 'transfert')
  AND from_location_id IS NOT NULL
  AND status IN ('normal', 'retroactif', 'valide')
  GROUP BY article_id, from_location_id, unit_id
  UNION ALL
  SELECT article_id, to_location_id AS location_id, unit_id, SUM(quantity) AS quantity
  FROM stock_movements
  WHERE movement_type = 'transfert'
  AND to_location_id IS NOT NULL
  AND status IN ('normal', 'retroactif', 'valide')
  GROUP BY article_id, to_location_id, unit_id
) locations
GROUP BY article_id, location_id, unit_id;
