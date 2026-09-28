-- Lot A : protocole SQL local isolé uniquement.
-- Ne pas exécuter sur TEST/Production.
-- Pré-requis psql : définir ACTOR_UUID, DIRECTION_UUID, BUYER_UUID,
-- CHEF_UUID, FICHE_UUID, MAGASINIER_UUID, INACTIVE_UUID, EVENT_UUID,
-- PROTECTED_NEED_UUID, UNENGAGED_NEED_UUID, CANCEL_NEED_UUID, ORDER_UUID
-- et REQUEST_UUID, ORDER_REQUEST_UUID, LINK_REQUEST_UUID, DIRECTION_PIN.
-- Exemple : psql ... -v ACTOR_UUID='...' -v EVENT_UUID='...' ... -f tests/lot-a-server-guards.sql

\set ON_ERROR_STOP on
begin;

-- 1) Préflight : fonctions, signatures, triggers et droits.
select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='stock' and p.proname in (
  'regenerate_event_purchase_needs', 'update_event_purchase_need_status',
  'replace_purchase_order_items', 'replace_purchase_order_need_links',
  'cancel_purchase_need', 'replace_purchase_order_draft'
)
order by p.proname;

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema='stock'
  and routine_name in (
    'regenerate_event_purchase_needs', 'update_event_purchase_need_status',
    'replace_purchase_order_items', 'replace_purchase_order_need_links',
    'cancel_purchase_need', 'replace_purchase_order_draft'
  )
order by routine_name, grantee;

select tgname, tgrelid::regclass, tgtype, tgenabled
from pg_trigger
where not tgisinternal
  and tgname in ('lot_a_guard_order_items_write','lot_a_guard_order_needs_write');

-- 2) Exécuter sous un profil métier actif de test.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'ACTOR_UUID', true);
select set_config('request.jwt.claims', jsonb_build_object('sub', :'ACTOR_UUID')::text, true);

-- 3) Régénération : premier appel puis rejeu identique.
select stock.regenerate_event_purchase_needs(
  :'EVENT_UUID'::uuid,
  '[]'::jsonb,
  :'REQUEST_UUID'::uuid
);
select stock.regenerate_event_purchase_needs(
  :'EVENT_UUID'::uuid,
  '[]'::jsonb,
  :'REQUEST_UUID'::uuid
);

-- 4) Rejeu avec contenu différent : doit échouer.
do $$ begin
  perform stock.regenerate_event_purchase_needs(:'EVENT_UUID'::uuid, '[{"quantity":2}]'::jsonb, :'REQUEST_UUID'::uuid);
  raise exception 'Le rejeu avec contenu différent aurait dû être refusé';
exception when others then
  if position('contenu différent' in sqlerrm) = 0 then raise; end if;
end $$;

-- 5) Transition événementielle opérationnelle : un besoin engagé doit être refusé.
do $$ begin
  perform stock.update_event_purchase_need_status(:'PROTECTED_NEED_UUID'::uuid, 'en_cours', gen_random_uuid());
  raise exception 'La transition d’un besoin protégé aurait dû être refusée';
exception when others then
  if position('protégé' in sqlerrm) = 0 and position('engagé' in sqlerrm) = 0 then raise; end if;
end $$;

-- 6) Annulation : le même request_id retourne le résultat initial.
select stock.cancel_purchase_need(:'CANCEL_NEED_UUID'::uuid, 'test local', gen_random_uuid());

-- 7) Remplacements RPC légitimes sur une commande brouillon réellement isolée.
select set_config('request.jwt.claim.sub', :'ACTOR_UUID', true);
select stock.replace_purchase_order_draft(:'ORDER_UUID'::uuid, null, '{}'::jsonb, '[]'::jsonb, '{}'::uuid[], :'ORDER_REQUEST_UUID'::uuid);
select stock.replace_purchase_order_draft(:'ORDER_UUID'::uuid, null, '{}'::jsonb, '[]'::jsonb, '{}'::uuid[], :'ORDER_REQUEST_UUID'::uuid);
select stock.replace_purchase_order_need_links(:'ORDER_UUID'::uuid, '{}'::uuid[], null, :'LINK_REQUEST_UUID'::uuid);

-- 8) Tentative d’écriture directe : doit être refusée par RLS ou trigger.
do $$ begin
  delete from stock.purchase_order_items where purchase_order_id=:'ORDER_UUID'::uuid;
  raise exception 'Une suppression directe a été autorisée';
exception when others then
  if sqlerrm like 'Une suppression directe%' then raise; end if;
end $$;

-- 9) Matrice des écritures directes purchase_needs.
-- Pour chaque profil, status/decision et suppression doivent être refusés
-- par RLS ou par guard_purchase_need_direct_write.
do $$
declare
  v_profile uuid;
  v_user uuid;
begin
  foreach v_profile in array array[:'DIRECTION_UUID'::uuid, :'BUYER_UUID'::uuid, :'CHEF_UUID'::uuid, :'FICHE_UUID'::uuid, :'MAGASINIER_UUID'::uuid, :'INACTIVE_UUID'::uuid] loop
    select user_id into v_user from stock.profiles where id=v_profile;
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    begin
      update stock.purchase_needs set status='en_cours' where id=:'UNENGAGED_NEED_UUID'::uuid;
      raise exception 'Une transition directe a été autorisée pour %', v_profile;
    exception when others then
      if sqlerrm like 'Une transition directe%' then raise; end if;
    end;
    begin
      delete from stock.purchase_needs where id=:'PROTECTED_NEED_UUID'::uuid;
      raise exception 'Une suppression directe a été autorisée pour %', v_profile;
    exception when others then
      if sqlerrm like 'Une suppression directe%' then raise; end if;
    end;
  end loop;
end $$;

-- 10) Modification directe d'une décision Direction : toujours refusée.
select set_config('request.jwt.claim.sub', (select user_id::text from stock.profiles where id=:'DIRECTION_UUID'::uuid), true);
do $$ begin
  update stock.purchase_needs set decision_status='approved' where id=:'UNENGAGED_NEED_UUID'::uuid;
  raise exception 'Une décision directe a été autorisée';
exception when others then
  if sqlerrm like 'Une décision directe%' then raise; end if;
end $$;

-- 11) Premier lien direct d'une commande vide : refusé par le trigger, même
-- lorsqu'aucun lien n'existe encore. Les RPC SECURITY DEFINER restent autorisées.
do $$ begin
  insert into stock.purchase_order_needs(purchase_order_id, need_id)
  values(:'ORDER_UUID'::uuid, :'UNENGAGED_NEED_UUID'::uuid);
  raise exception 'Le premier lien direct a été autorisé';
exception when others then
  if sqlerrm like 'Le premier lien direct%' then raise; end if;
end $$;

-- 12) RPC Direction officielle avec PIN : exécuter sur un besoin de test
-- non engagé et conserver le résultat dans la transaction rollbackée.
-- select stock.apply_purchase_need_line_decisions(
--   :'DIRECTION_PIN',
--   jsonb_build_array(jsonb_build_object(
--     'purchase_need_id', :'UNENGAGED_NEED_UUID'::uuid,
--     'decision', 'refused',
--     'refused_reason', 'test local'
--   ))
-- );

rollback;

-- Concurrence : ouvrir deux sessions authenticated distinctes, avec deux request_id
-- visant la même commande/les mêmes besoins. Exécuter simultanément la RPC de remplacement.
-- Résultat attendu : une transaction obtient les verrous, l’autre attend puis réussit
-- de façon idempotente ou échoue proprement sans état partiel. Vérifier ensuite les
-- lignes, liens, historique et table purchase_need_operation_requests.
