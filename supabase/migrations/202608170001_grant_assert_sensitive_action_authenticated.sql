-- Autoriser uniquement les utilisateurs authentifiés à appeler le contrôle PIN.
-- La fonction reste SECURITY DEFINER et conserve ses vérifications de rôle,
-- permission et PIN; aucune RLS n'est modifiée.
grant usage on schema stock to authenticated;
grant execute on function stock.assert_sensitive_action(text, text, text, text, uuid, text, jsonb) to authenticated;
