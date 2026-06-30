create schema if not exists stock;
set search_path = stock, public, auth;

-- Permet aux receptions validees par un magasinier de recalculer le statut
-- de la commande sans ouvrir la modification complete des commandes.
CREATE OR REPLACE FUNCTION stock.refresh_purchase_order_status_from_items(
  p_order_id UUID,
  p_profile_id UUID DEFAULT NULL
)
RETURNS stock.purchase_order_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = stock, public, auth
AS $$
DECLARE
  v_status stock.purchase_order_status;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM stock.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'acheteur', 'magasinier')
      AND profiles.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Non autorise a mettre a jour le statut de cette commande';
  END IF;

  SELECT
    CASE
      WHEN COUNT(*) > 0
       AND BOOL_AND(COALESCE(quantity_received, 0) >= COALESCE(quantity_ordered, 0))
        THEN 'livree'::stock.purchase_order_status
      WHEN BOOL_OR(COALESCE(quantity_received, 0) > 0)
        THEN 'partiellement_livree'::stock.purchase_order_status
      ELSE 'envoyee'::stock.purchase_order_status
    END
  INTO v_status
  FROM stock.purchase_order_items
  WHERE purchase_order_id = p_order_id;

  UPDATE stock.purchase_orders
  SET
    status = v_status,
    updated_by = p_profile_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION stock.refresh_purchase_order_status_from_items(UUID, UUID) TO authenticated;
