-- Lot A : garanties serveur spécialisées.
-- Préparée localement uniquement. Ne pas exécuter avant validation TEST.

create table if not exists stock.purchase_need_operation_requests (
  request_id uuid primary key,
  operation text not null,
  payload_hash text not null,
  actor_profile_id uuid not null references stock.profiles(id),
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table stock.purchase_need_operation_requests enable row level security;
revoke all on stock.purchase_need_operation_requests from public, anon, authenticated;

-- Les mutations sensibles de purchase_needs ne peuvent venir que d'une RPC
-- SECURITY DEFINER. Les champs ordinaires restent modifiables selon les RLS
-- existantes pour préserver les formulaires et circuits légitimes.
create or replace function stock.guard_purchase_need_direct_write() returns trigger
language plpgsql security invoker set search_path=pg_catalog,stock as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_op='DELETE' then
      if exists(select 1 from stock.cash_purchase_items c where c.purchase_need_id=old.id)
         or exists(select 1 from stock.purchase_order_needs pon where pon.need_id=old.id)
         or exists(select 1 from stock.receptions r join stock.purchase_orders po on po.id=r.purchase_order_id join stock.purchase_order_needs pon on pon.purchase_order_id=po.id where pon.need_id=old.id) then
        raise exception 'Besoin engagé ou réceptionné : suppression directe interdite';
      end if;
    elsif tg_op='INSERT' then
      if new.status is distinct from 'a_faire'::stock.purchase_need_status
         or coalesce(new.decision_status,'pending') <> 'pending'
         or coalesce(new.processing_mode,'none') <> 'none'
         or new.validated_by is not null or new.decided_by is not null then
        raise exception 'Création directe avec décision ou statut protégé interdite';
      end if;
    elsif tg_op='UPDATE' then
      if old.status is distinct from new.status
         or old.workflow_status is distinct from new.workflow_status
         or old.decision_status is distinct from new.decision_status
         or old.processing_mode is distinct from new.processing_mode
         or old.processing_supplier_id is distinct from new.processing_supplier_id
         or old.refused_reason is distinct from new.refused_reason
         or old.direction_comment is distinct from new.direction_comment
         or old.decided_by is distinct from new.decided_by
         or old.decided_at is distinct from new.decided_at
         or old.validated_by is distinct from new.validated_by
         or old.validated_at is distinct from new.validated_at
         or old.validation_comment is distinct from new.validation_comment then
        raise exception 'Décision ou statut protégé : utiliser la RPC officielle';
      end if;
      if exists(select 1 from stock.cash_purchase_items c where c.purchase_need_id=old.id)
         or exists(select 1 from stock.purchase_order_needs pon where pon.need_id=old.id)
         or exists(select 1 from stock.receptions r join stock.purchase_orders po on po.id=r.purchase_order_id join stock.purchase_order_needs pon on pon.purchase_order_id=po.id where pon.need_id=old.id) then
        raise exception 'Besoin engagé ou réceptionné : modification directe interdite';
      end if;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists lot_a_guard_purchase_needs_write on stock.purchase_needs;
create trigger lot_a_guard_purchase_needs_write
before insert or update or delete on stock.purchase_needs
for each row execute function stock.guard_purchase_need_direct_write();

create or replace function stock.regenerate_event_purchase_needs(
  p_event_id uuid, p_lines jsonb, p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path = stock, public, auth, extensions as $$
declare
  v_actor uuid := stock.current_profile_id();
  v_hash text := md5(p_event_id::text || ':' || coalesce(p_lines::text, '[]'));
  v_cached stock.purchase_need_operation_requests%rowtype;
  v_event uuid; v_need record; v_item record; v_candidate uuid;
  v_used uuid[] := '{}'::uuid[]; v_updated uuid[] := '{}'::uuid[];
  v_inserted uuid[] := '{}'::uuid[]; v_conflicts jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if v_actor is null or not exists (select 1 from stock.profiles p where p.id=v_actor and p.status='active' and p.role in ('direction','chef_cuisine','fiche_technique')) then raise exception 'Profil non autorisé'; end if;
  if p_request_id is null then raise exception 'request_id obligatoire'; end if;
  select * into v_cached from stock.purchase_need_operation_requests where request_id=p_request_id for update;
  if found then
    if v_cached.operation <> 'regenerate_event_purchase_needs' or v_cached.payload_hash <> v_hash then raise exception 'request_id déjà utilisé avec un contenu différent'; end if;
    return v_cached.result;
  end if;
  select e.id into v_event from stock.events e where e.id=p_event_id for update;
  if v_event is null then raise exception 'Événement introuvable'; end if;
  for v_need in select n.* from stock.purchase_needs n where n.event_id=p_event_id order by n.id for update loop
    if v_need.status not in ('a_faire','en_cours') or coalesce(v_need.decision_status,'pending') <> 'pending'
       or coalesce(v_need.processing_mode,'none') <> 'none'
       or exists(select 1 from stock.cash_purchase_items c where c.purchase_need_id=v_need.id)
       or exists(select 1 from stock.purchase_order_needs pon where pon.need_id=v_need.id)
       or exists(select 1 from stock.receptions r join stock.purchase_orders po on po.id=r.purchase_order_id join stock.purchase_order_needs pon on pon.purchase_order_id=po.id where pon.need_id=v_need.id)
    then v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('id',v_need.id,'status',v_need.status,'reason','engagé_ou_protégé')); end if;
  end loop;
  for v_item in select * from jsonb_to_recordset(coalesce(p_lines,'[]'::jsonb)) as x(article_id uuid,unit_id uuid,quantity numeric,estimated_price numeric,estimated_cost numeric,origin text,type_de_besoin text,destination_prevue text,source_du_calcul text,service_demandeur text) loop
    select n.id into v_candidate from stock.purchase_needs n
    where n.event_id=p_event_id and n.article_id=v_item.article_id and n.unit_id=v_item.unit_id
      and n.status in ('a_faire','en_cours') and coalesce(n.decision_status,'pending')='pending' and coalesce(n.processing_mode,'none')='none'
      and not (n.id=any(v_used)) and not exists(select 1 from stock.cash_purchase_items c where c.purchase_need_id=n.id)
      and not exists(select 1 from stock.purchase_order_needs pon where pon.need_id=n.id)
    order by n.created_at,n.id limit 1;
    if v_candidate is null then
      insert into stock.purchase_needs(event_id,article_id,quantity,quantity_needed,unit_id,estimated_price,estimated_cost,origin,type_de_besoin,destination_prevue,source_du_calcul,service_demandeur,status,created_by,updated_by)
      values(p_event_id,v_item.article_id,v_item.quantity,v_item.quantity,v_item.unit_id,v_item.estimated_price,v_item.estimated_cost,coalesce(v_item.origin,'evenement'),v_item.type_de_besoin,v_item.destination_prevue,v_item.source_du_calcul,v_item.service_demandeur,'a_faire',v_actor,v_actor)
      returning id into v_candidate;
      v_inserted:=array_append(v_inserted,v_candidate);
    else
      update stock.purchase_needs set quantity=v_item.quantity,quantity_needed=v_item.quantity,estimated_price=v_item.estimated_price,estimated_cost=v_item.estimated_cost,updated_by=v_actor,updated_at=now() where id=v_candidate;
      v_updated:=array_append(v_updated,v_candidate);
    end if;
    v_used:=array_append(v_used,v_candidate);
  end loop;
  v_result:=jsonb_build_object('updated_ids',to_jsonb(v_updated),'inserted_ids',to_jsonb(v_inserted),'conflicts',v_conflicts);
  insert into stock.purchase_need_operation_requests values(p_request_id,'regenerate_event_purchase_needs',v_hash,v_actor,v_result,now());
  return v_result;
end $$;

create or replace function stock.replace_purchase_order_items(
  p_order_id uuid, p_items jsonb, p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path = stock, public, auth, extensions as $$
declare
  v_actor uuid := stock.current_profile_id(); v_hash text := md5(p_order_id::text||':'||coalesce(p_items::text,'[]'));
  v_cached stock.purchase_need_operation_requests%rowtype; v_result jsonb; v_order stock.purchase_orders%rowtype;
begin
  if v_actor is null or not exists(select 1 from stock.profiles p where p.id=v_actor and p.status='active' and p.role in ('direction','acheteur','magasinier')) then raise exception 'Profil non autorisé'; end if;
  if p_request_id is null then raise exception 'request_id obligatoire'; end if;
  select * into v_cached from stock.purchase_need_operation_requests where request_id=p_request_id for update;
  if found then if v_cached.operation<>'replace_purchase_order_items' or v_cached.payload_hash<>v_hash then raise exception 'request_id déjà utilisé avec un contenu différent'; end if; return v_cached.result; end if;
  select * into v_order from stock.purchase_orders where id=p_order_id for update;
  if not found or v_order.status<>'brouillon' then raise exception 'Commande non modifiable'; end if;
  if exists(select 1 from stock.receptions r where r.purchase_order_id=p_order_id) or exists(select 1 from stock.invoices i where i.purchase_order_id=p_order_id) then raise exception 'Commande déjà engagée'; end if;
  perform set_config('stock.lot_a_rpc_context','replace_purchase_order_items',true);
  delete from stock.purchase_order_items where purchase_order_id=p_order_id;
  insert into stock.purchase_order_items(purchase_order_id,article_id,quantity_ordered,unit_id,stock_unit_id,conversion_factor,quantity_ordered_stock,unit_price,unit_price_stock,comment)
  select p_order_id,x.article_id,x.quantity_ordered,x.unit_id,x.stock_unit_id,coalesce(x.conversion_factor,1),coalesce(x.quantity_ordered_stock,x.quantity_ordered),x.unit_price,coalesce(x.unit_price_stock,x.unit_price),x.comment
  from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(article_id uuid,quantity_ordered numeric,unit_id uuid,stock_unit_id uuid,conversion_factor numeric,quantity_ordered_stock numeric,unit_price numeric,unit_price_stock numeric,comment text);
  v_result:=jsonb_build_object('order_id',p_order_id,'item_count',jsonb_array_length(coalesce(p_items,'[]'::jsonb)));
  insert into stock.purchase_need_operation_requests values(p_request_id,'replace_purchase_order_items',v_hash,v_actor,v_result,now());
  return v_result;
end $$;

create or replace function stock.update_event_purchase_need_status(
  p_need_id uuid, p_status text, p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path = stock, public, auth, extensions as $$
declare
  v_actor uuid := stock.current_profile_id(); v_hash text := md5(p_need_id::text||':'||coalesce(p_status,'') );
  v_cached stock.purchase_need_operation_requests%rowtype; v_need stock.purchase_needs%rowtype; v_result jsonb;
begin
  if v_actor is null or not exists(select 1 from stock.profiles p where p.id=v_actor and p.status='active' and p.role in ('direction','chef_cuisine','fiche_technique')) then raise exception 'Profil non autorisé'; end if;
  if p_request_id is null or p_status is null then raise exception 'request_id et statut obligatoires'; end if;
  select * into v_cached from stock.purchase_need_operation_requests where request_id=p_request_id for update;
  if found then if v_cached.operation<>'update_event_purchase_need_status' or v_cached.payload_hash<>v_hash then raise exception 'request_id déjà utilisé avec un contenu différent'; end if; return v_cached.result; end if;
  select * into v_need from stock.purchase_needs where id=p_need_id and event_id is not null for update;
  if not found then raise exception 'Besoin événementiel introuvable'; end if;
  if not (
    (v_need.status='a_faire' and p_status in ('a_faire','en_cours')) or
    (v_need.status='en_cours' and p_status='en_cours') or
    (v_need.status='valide' and p_status in ('valide','regroupe')) or
    (v_need.status='regroupe' and p_status='regroupe') or
    (v_need.status='refuse' and p_status='refuse') or
    (v_need.status='annule' and p_status='annule')
  ) then raise exception 'Transition de besoin interdite'; end if;
  if coalesce(v_need.decision_status,'pending')<>'pending' or coalesce(v_need.processing_mode,'none')<>'none'
     or exists(select 1 from stock.cash_purchase_items c where c.purchase_need_id=p_need_id)
     or exists(select 1 from stock.purchase_order_needs pon where pon.need_id=p_need_id)
     or exists(select 1 from stock.receptions r join stock.purchase_orders po on po.id=r.purchase_order_id join stock.purchase_order_needs pon on pon.purchase_order_id=po.id where pon.need_id=p_need_id)
  then raise exception 'Besoin engagé ou protégé'; end if;
  update stock.purchase_needs set status=p_status::stock.purchase_need_status,updated_by=v_actor,updated_at=now() where id=p_need_id;
  v_result:=jsonb_build_object('need_id',p_need_id,'previous_status',v_need.status,'status',p_status);
  insert into stock.purchase_need_operation_requests values(p_request_id,'update_event_purchase_need_status',v_hash,v_actor,v_result,now());
  return v_result;
end $$;

create or replace function stock.replace_purchase_order_need_links(
  p_order_id uuid, p_need_ids uuid[], p_supplier_id uuid, p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path = stock, public, auth, extensions as $$
declare
  v_actor uuid := stock.current_profile_id(); v_hash text := md5(p_order_id::text||':'||coalesce(array_to_string(p_need_ids,','),'')||':'||coalesce(p_supplier_id::text,''));
  v_cached stock.purchase_need_operation_requests%rowtype; v_order stock.purchase_orders%rowtype; v_need uuid; v_old uuid[]; v_lock_ids uuid[]; v_result jsonb;
begin
  if v_actor is null or not exists(select 1 from stock.profiles p where p.id=v_actor and p.status='active' and p.role in ('direction','acheteur')) then raise exception 'Profil non autorisé'; end if;
  if p_request_id is null then raise exception 'request_id obligatoire'; end if;
  select * into v_cached from stock.purchase_need_operation_requests where request_id=p_request_id for update;
  if found then if v_cached.operation<>'replace_purchase_order_need_links' or v_cached.payload_hash<>v_hash then raise exception 'request_id déjà utilisé avec un contenu différent'; end if; return v_cached.result; end if;
  select * into v_order from stock.purchase_orders where id=p_order_id for update;
  if not found or v_order.status<>'brouillon' then raise exception 'Commande non modifiable'; end if;
  if exists(select 1 from stock.receptions r where r.purchase_order_id=p_order_id) or exists(select 1 from stock.invoices i where i.purchase_order_id=p_order_id) then raise exception 'Commande déjà engagée'; end if;
  select array_agg(need_id order by need_id) into v_old from stock.purchase_order_needs where purchase_order_id=p_order_id;
  select array_agg(id order by id) into v_lock_ids from (select distinct unnest(array_cat(coalesce(v_old,'{}'::uuid[]),coalesce(p_need_ids,'{}'::uuid[]))) as id) ids;
  foreach v_need in array coalesce(v_lock_ids,'{}'::uuid[]) loop
    perform 1 from stock.purchase_needs n where n.id=v_need for update;
    if not found or not exists(select 1 from stock.purchase_needs n where n.id=v_need and n.status in ('valide','regroupe') and coalesce(n.decision_status,'pending')='pending' and coalesce(n.processing_mode,'none')='none') then raise exception 'Besoin non remplaçable'; end if;
    if exists(select 1 from stock.cash_purchase_items c where c.purchase_need_id=v_need) or exists(select 1 from stock.purchase_order_needs pon where pon.need_id=v_need and pon.purchase_order_id<>p_order_id) then raise exception 'Besoin déjà engagé'; end if;
  end loop;
  perform set_config('stock.lot_a_rpc_context','replace_purchase_order_need_links',true);
  -- Détacher uniquement les anciens besoins encore regroupés par cette commande
  -- et sans autre engagement ; aucune décision Direction n'est réécrite.
  update stock.purchase_needs n
     set status='valide', updated_by=v_actor, updated_at=now()
   where n.id=any(coalesce(v_old,'{}'::uuid[]))
     and n.status='regroupe'
     and not exists(select 1 from stock.cash_purchase_items c where c.purchase_need_id=n.id)
     and not exists(select 1 from stock.purchase_order_needs pon where pon.need_id=n.id and pon.purchase_order_id<>p_order_id);
  delete from stock.purchase_order_needs where purchase_order_id=p_order_id;
  insert into stock.purchase_order_needs(purchase_order_id,need_id) select p_order_id,unnest(coalesce(p_need_ids,'{}'::uuid[]));
  update stock.purchase_needs set status='regroupe',supplier_id=p_supplier_id,updated_by=v_actor,updated_at=now() where id=any(coalesce(p_need_ids,'{}'::uuid[]));
  insert into stock.purchase_order_history(purchase_order_id,action,description,created_by) values(p_order_id,'modification','Liens besoins remplacés par RPC sécurisée',v_actor);
  v_result:=jsonb_build_object('order_id',p_order_id,'need_ids',to_jsonb(coalesce(p_need_ids,'{}'::uuid[])));
  insert into stock.purchase_need_operation_requests values(p_request_id,'replace_purchase_order_need_links',v_hash,v_actor,v_result,now());
  return v_result;
end $$;

create or replace function stock.cancel_purchase_need(
  p_need_id uuid, p_reason text, p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path = stock, public, auth, extensions as $$
declare
  v_actor uuid := stock.current_profile_id(); v_need stock.purchase_needs%rowtype;
  v_hash text := md5(p_need_id::text||':'||coalesce(btrim(p_reason),'') );
  v_cached stock.purchase_need_operation_requests%rowtype; v_result jsonb;
begin
  if v_actor is null or not exists(select 1 from stock.profiles p where p.id=v_actor and p.status='active') then raise exception 'Profil actif requis'; end if;
  if p_request_id is null or nullif(btrim(p_reason),'') is null then raise exception 'request_id et motif obligatoires'; end if;
  select * into v_cached from stock.purchase_need_operation_requests where request_id=p_request_id for update;
  if found then if v_cached.operation<>'cancel_purchase_need' or v_cached.payload_hash<>v_hash then raise exception 'request_id déjà utilisé avec un contenu différent'; end if; return v_cached.result; end if;
  select * into v_need from stock.purchase_needs where id=p_need_id for update;
  if not found then raise exception 'Besoin introuvable'; end if;
  if not (v_need.created_by=v_actor or exists(select 1 from stock.profiles p where p.id=v_actor and p.role in ('direction','acheteur'))) then raise exception 'Profil non autorisé à classer ce besoin sans suite'; end if;
  if v_need.status<>'a_faire' or coalesce(v_need.decision_status,'pending')<>'pending' or coalesce(v_need.processing_mode,'none')<>'none' then raise exception 'Besoin déjà orienté ou traité'; end if;
  if exists(select 1 from stock.cash_purchase_items c where c.purchase_need_id=p_need_id) or exists(select 1 from stock.purchase_order_needs pon where pon.need_id=p_need_id) then raise exception 'Besoin déjà engagé'; end if;
  update stock.purchase_needs set status='annule', decision_status='pending', processing_mode='none', validation_comment=btrim(p_reason), updated_by=v_actor, updated_at=now() where id=p_need_id;
  v_result:=jsonb_build_object('need_id',p_need_id,'status','annule','reason',btrim(p_reason));
  insert into stock.purchase_need_operation_requests values(p_request_id,'cancel_purchase_need',v_hash,v_actor,v_result,now());
  return v_result;
end $$;

create or replace function stock.replace_purchase_order_draft(
  p_order_id uuid, p_supplier_id uuid, p_order_patch jsonb, p_items jsonb, p_need_ids uuid[], p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path = stock, public, auth, extensions as $$
declare
  v_actor uuid := stock.current_profile_id(); v_hash text := md5(p_order_id::text||':'||coalesce(p_supplier_id::text,'')||':'||coalesce(p_order_patch::text,'{}')||':'||coalesce(p_items::text,'[]')||':'||coalesce(array_to_string(p_need_ids,','),'') );
  v_cached stock.purchase_need_operation_requests%rowtype; v_order stock.purchase_orders%rowtype; v_need uuid; v_old uuid[]; v_lock_ids uuid[]; v_result jsonb;
begin
  if v_actor is null or not exists(select 1 from stock.profiles p where p.id=v_actor and p.status='active' and p.role in ('direction','acheteur','magasinier')) then raise exception 'Profil non autorisé'; end if;
  if p_request_id is null then raise exception 'request_id obligatoire'; end if;
  select * into v_cached from stock.purchase_need_operation_requests where request_id=p_request_id for update;
  if found then if v_cached.operation<>'replace_purchase_order_draft' or v_cached.payload_hash<>v_hash then raise exception 'request_id déjà utilisé avec un contenu différent'; end if; return v_cached.result; end if;
  select * into v_order from stock.purchase_orders where id=p_order_id for update;
  if not found or v_order.status<>'brouillon' then raise exception 'Commande non modifiable'; end if;
  if exists(select 1 from stock.receptions r where r.purchase_order_id=p_order_id) or exists(select 1 from stock.invoices i where i.purchase_order_id=p_order_id) then raise exception 'Commande déjà engagée'; end if;
  select array_agg(need_id order by need_id) into v_old from stock.purchase_order_needs where purchase_order_id=p_order_id;
  select array_agg(id order by id) into v_lock_ids from (select distinct unnest(array_cat(coalesce(v_old,'{}'::uuid[]),coalesce(p_need_ids,'{}'::uuid[]))) as id) ids;
  foreach v_need in array coalesce(v_lock_ids,'{}'::uuid[]) loop
    perform 1 from stock.purchase_needs n where n.id=v_need for update;
    if not found or not exists(select 1 from stock.purchase_needs n where n.id=v_need and n.status in ('valide','regroupe') and coalesce(n.decision_status,'pending')='pending' and coalesce(n.processing_mode,'none')='none') then raise exception 'Besoin non remplaçable'; end if;
    if exists(select 1 from stock.cash_purchase_items c where c.purchase_need_id=v_need) or exists(select 1 from stock.purchase_order_needs pon where pon.need_id=v_need and pon.purchase_order_id<>p_order_id) then raise exception 'Besoin déjà engagé'; end if;
  end loop;
  perform set_config('stock.lot_a_rpc_context','replace_purchase_order_draft',true);
  update stock.purchase_orders set
    supplier_id = coalesce((p_order_patch->>'supplier_id')::uuid, supplier_id),
    order_date = coalesce((p_order_patch->>'order_date')::date, order_date),
    delivery_date = case when p_order_patch ? 'delivery_date' then nullif(p_order_patch->>'delivery_date','')::date else delivery_date end,
    supplier_reference = case when p_order_patch ? 'supplier_reference' then nullif(p_order_patch->>'supplier_reference','') else supplier_reference end,
    payment_terms = case when p_order_patch ? 'payment_terms' then nullif(p_order_patch->>'payment_terms','') else payment_terms end,
    delivery_mode = case when p_order_patch ? 'delivery_mode' then nullif(p_order_patch->>'delivery_mode','') else delivery_mode end,
    comment = case when p_order_patch ? 'comment' then nullif(p_order_patch->>'comment','') else comment end,
    total_amount = coalesce((p_order_patch->>'total_amount')::numeric, total_amount),
    updated_by = v_actor,
    updated_at = now()
  where id=p_order_id;
  update stock.purchase_needs n set status='valide',updated_by=v_actor,updated_at=now() where n.id=any(coalesce(v_old,'{}'::uuid[])) and n.status='regroupe';
  delete from stock.purchase_order_needs where purchase_order_id=p_order_id;
  delete from stock.purchase_order_items where purchase_order_id=p_order_id;
  insert into stock.purchase_order_items(purchase_order_id,article_id,quantity_ordered,unit_id,stock_unit_id,conversion_factor,quantity_ordered_stock,unit_price,unit_price_stock,comment)
  select p_order_id,x.article_id,x.quantity_ordered,x.unit_id,x.stock_unit_id,coalesce(x.conversion_factor,1),coalesce(x.quantity_ordered_stock,x.quantity_ordered),x.unit_price,coalesce(x.unit_price_stock,x.unit_price),x.comment from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(article_id uuid,quantity_ordered numeric,unit_id uuid,stock_unit_id uuid,conversion_factor numeric,quantity_ordered_stock numeric,unit_price numeric,unit_price_stock numeric,comment text);
  insert into stock.purchase_order_needs(purchase_order_id,need_id) select p_order_id,unnest(coalesce(p_need_ids,'{}'::uuid[]));
  update stock.purchase_needs set status='regroupe',supplier_id=p_supplier_id,updated_by=v_actor,updated_at=now() where id=any(coalesce(p_need_ids,'{}'::uuid[]));
  insert into stock.purchase_order_history(purchase_order_id,action,description,created_by) values(p_order_id,'modification','Commande brouillon remplacée atomiquement',v_actor);
  v_result:=jsonb_build_object('order_id',p_order_id,'need_ids',to_jsonb(coalesce(p_need_ids,'{}'::uuid[])),'item_count',jsonb_array_length(coalesce(p_items,'[]'::jsonb)));
  insert into stock.purchase_need_operation_requests values(p_request_id,'replace_purchase_order_draft',v_hash,v_actor,v_result,now());
  return v_result;
end $$;

create or replace function stock.guard_lot_a_direct_order_write() returns trigger
language plpgsql security invoker set search_path=pg_catalog,stock as $$
begin
  if current_user in ('anon','authenticated') then
    raise exception 'Écriture directe interdite : utiliser la RPC Lot A';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists lot_a_guard_order_items_delete on stock.purchase_order_items;
drop trigger if exists lot_a_guard_order_items_write on stock.purchase_order_items;
create trigger lot_a_guard_order_items_write before update or delete on stock.purchase_order_items for each row execute function stock.guard_lot_a_direct_order_write();
drop trigger if exists lot_a_guard_order_needs_write on stock.purchase_order_needs;
create trigger lot_a_guard_order_needs_write before update or insert or delete on stock.purchase_order_needs for each row execute function stock.guard_lot_a_direct_order_write();

revoke all on function stock.regenerate_event_purchase_needs(uuid,jsonb,uuid) from public, anon;
revoke all on function stock.replace_purchase_order_items(uuid,jsonb,uuid) from public, anon;
revoke all on function stock.update_event_purchase_need_status(uuid,text,uuid) from public, anon;
revoke all on function stock.replace_purchase_order_need_links(uuid,uuid[],uuid,uuid) from public, anon;
revoke all on function stock.cancel_purchase_need(uuid,text,uuid) from public, anon;
revoke all on function stock.replace_purchase_order_draft(uuid,uuid,jsonb,jsonb,uuid[],uuid) from public, anon;
grant execute on function stock.regenerate_event_purchase_needs(uuid,jsonb,uuid) to authenticated;
grant execute on function stock.replace_purchase_order_items(uuid,jsonb,uuid) to authenticated;
grant execute on function stock.update_event_purchase_need_status(uuid,text,uuid) to authenticated;
grant execute on function stock.replace_purchase_order_need_links(uuid,uuid[],uuid,uuid) to authenticated;
grant execute on function stock.cancel_purchase_need(uuid,text,uuid) to authenticated;
grant execute on function stock.replace_purchase_order_draft(uuid,uuid,jsonb,jsonb,uuid[],uuid) to authenticated;
