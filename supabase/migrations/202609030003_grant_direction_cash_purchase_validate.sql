-- Autorisation ciblée du rôle Direction pour valider un décaissement achat espèces.
-- A appliquer uniquement sur Supabase test après validation.
insert into stock.role_permissions (role, permission)
select 'direction'::stock.user_role, 'cash_purchases.validate'
where not exists (
  select 1 from stock.role_permissions
  where role = 'direction'::stock.user_role
    and permission = 'cash_purchases.validate'
);