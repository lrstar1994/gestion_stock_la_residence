-- Ajout ciblé de la permission de validation des besoins d'achat à la Direction.
-- Migration idempotente; aucune RLS n'est modifiée.
insert into stock.role_permissions (role, permission)
values ('direction', 'purchase_need.validate')
on conflict (role, permission) do nothing;
