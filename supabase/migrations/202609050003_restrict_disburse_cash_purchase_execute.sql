-- Restriction des privilèges d’exécution de la RPC sensible. TEST uniquement.
REVOKE EXECUTE ON FUNCTION stock.disburse_cash_purchase(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION stock.disburse_cash_purchase(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION stock.disburse_cash_purchase(uuid, numeric, text) TO authenticated;