-- Lot 3B.1A : suivi partagé des lignes refusées, sans résolution financière.
create table if not exists stock.cash_purchase_supplier_regularizations (
  id uuid primary key default gen_random_uuid(),
  cash_purchase_id uuid not null references stock.cash_purchases(id) on delete restrict,
  cash_purchase_item_id uuid not null references stock.cash_purchase_items(id) on delete restrict,
  difference_id uuid references stock.cash_purchase_differences(id) on delete set null,
  article_id uuid references stock.articles(id) on delete set null,
  supplier_id uuid references stock.suppliers(id) on delete set null,
  quantity_delivered numeric(14,4) not null check (quantity_delivered >= 0),
  quantity_accepted numeric(14,4) not null check (quantity_accepted >= 0),
  quantity_refused numeric(14,4) not null check (quantity_refused >= 0),
  unit_price_real numeric(14,2) not null check (unit_price_real >= 0),
  value_to_regularize numeric(14,2) not null check (value_to_regularize >= 0),
  treatment_type text check (treatment_type is null or treatment_type in ('refund','replacement','credit_note','direction_arbitration')),
  status text not null default 'awaiting_isolation' check (status in ('open','awaiting_isolation','awaiting_treatment_decision','awaiting_supplier_return','returned_to_supplier','awaiting_refund','awaiting_replacement','awaiting_credit_note','awaiting_direction_arbitration','resolved')),
  current_responsible_role stock.user_role not null default 'magasinier' check (current_responsible_role in ('direction','caisse','controleur','magasinier')),
  assigned_profile_id uuid references stock.profiles(id) on delete set null,
  physical_location_id uuid references stock.locations(id) on delete set null,
  physical_location_note text,
  opened_at timestamptz not null default now(), opened_by uuid not null references stock.profiles(id) on delete restrict,
  due_at timestamptz,
  resolution_type text check (resolution_type is null or resolution_type in ('refund_received','replacement_accepted','credit_note_received','direction_decision','other')),
  resolution_comment text,
  resolved_at timestamptz,
  resolved_by uuid references stock.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists cash_purchase_supplier_regularizations_one_open_per_item_idx on stock.cash_purchase_supplier_regularizations(cash_purchase_item_id) where status <> 'resolved';
create table if not exists stock.cash_purchase_supplier_regularization_history (
  id uuid primary key default gen_random_uuid(), regularization_id uuid not null references stock.cash_purchase_supplier_regularizations(id) on delete cascade,
  event_type text not null, from_status text, to_status text, actor_profile_id uuid references stock.profiles(id) on delete set null,
  comment text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create or replace function stock.prevent_cash_purchase_closure_with_open_regularization() returns trigger language plpgsql security definer set search_path=pg_catalog,stock,auth,extensions as $$
begin
  if new.status='cloture' and old.status is distinct from new.status and exists(select 1 from stock.cash_purchase_supplier_regularizations where cash_purchase_id=new.id and status <> 'resolved') then raise exception 'Régularisation fournisseur non résolue'; end if; return new;
end; $$;
drop trigger if exists cash_purchase_supplier_regularization_closure_trg on stock.cash_purchases;
create trigger cash_purchase_supplier_regularization_closure_trg before update on stock.cash_purchases for each row execute function stock.prevent_cash_purchase_closure_with_open_regularization();
alter table stock.cash_purchase_supplier_regularizations enable row level security;
alter table stock.cash_purchase_supplier_regularization_history enable row level security;
create policy cash_purchase_supplier_regularizations_shared_read on stock.cash_purchase_supplier_regularizations for select using (exists(select 1 from stock.profiles p where p.user_id=auth.uid() and p.status='active' and p.role in ('direction','caisse','controleur','magasinier')));
create policy cash_purchase_supplier_regularization_history_shared_read on stock.cash_purchase_supplier_regularization_history for select using (exists(select 1 from stock.profiles p where p.user_id=auth.uid() and p.status='active' and p.role in ('direction','caisse','controleur','magasinier')));
revoke all on stock.cash_purchase_supplier_regularizations, stock.cash_purchase_supplier_regularization_history from public,anon,authenticated;
grant select on stock.cash_purchase_supplier_regularizations, stock.cash_purchase_supplier_regularization_history to authenticated;
create or replace function stock.isolate_cash_purchase_supplier_regularization(p_regularization_id uuid,p_location_id uuid,p_location_note text default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,stock,auth,extensions as $$
declare v_profile uuid; v_row record;
begin
 select id into v_profile from stock.profiles where user_id=auth.uid() and role='magasinier' and status='active';
 if v_profile is null then raise exception 'Profil Magasin actif requis'; end if;
 select * into v_row from stock.cash_purchase_supplier_regularizations where id=p_regularization_id for update;
 if not found then raise exception 'Régularisation introuvable'; end if;
 if v_row.status <> 'awaiting_isolation' or v_row.current_responsible_role <> 'magasinier' then raise exception 'Régularisation non prête pour isolation'; end if;
 update stock.cash_purchase_supplier_regularizations set physical_location_id=p_location_id, physical_location_note=nullif(btrim(p_location_note),''), status='awaiting_treatment_decision', current_responsible_role='controleur', assigned_profile_id=null, updated_at=now() where id=p_regularization_id;
 insert into stock.cash_purchase_supplier_regularization_history(regularization_id,event_type,from_status,to_status,actor_profile_id,comment,metadata) values(p_regularization_id,'isolated_and_located','awaiting_isolation','awaiting_treatment_decision',v_profile,nullif(btrim(p_location_note),''),jsonb_build_object('location_id',p_location_id));
 return jsonb_build_object('id',p_regularization_id,'status','awaiting_treatment_decision','current_responsible_role','controleur','physical_location_id',p_location_id);
end; $$;
revoke all on function stock.isolate_cash_purchase_supplier_regularization(uuid,uuid,text) from public,anon;
grant execute on function stock.isolate_cash_purchase_supplier_regularization(uuid,uuid,text) to authenticated;

-- L'ouverture est explicitement faite par la RPC après les différences, afin que difference_id soit déterministe.
drop trigger if exists cash_purchase_supplier_regularization_open_trg on stock.cash_purchases;
drop function if exists stock.open_cash_purchase_supplier_regularizations();
create or replace function stock.receive_and_control_cash_purchase(p_purchase_id uuid,p_payload jsonb,p_pin text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,stock,auth,extensions as $$
declare
 v_profile_id uuid; v_purchase record; v_item record; v_existing record; v_reg record;
 v_total numeric(14,2); v_accepted numeric(14,2); v_paid numeric(14,2); v_returned numeric(14,2);
 v_seen uuid[] := '{}'; v_count integer; v_now timestamptz := now(); v_expected numeric(14,2); v_difference_id uuid; v_reg_id uuid;
begin
 v_profile_id := stock.assert_sensitive_action('cash_purchases.control',p_pin,'cash_purchase.receive_and_control','cash_purchase',p_purchase_id,null,'{}'::jsonb);
 select * into v_purchase from stock.cash_purchases where id=p_purchase_id for update;
 if not found then raise exception 'Achat espèces introuvable'; end if;
 if v_purchase.status <> 'especes_remises' or v_purchase.controlled_at is not null then raise exception 'Achat espèces déjà contrôlé ou non prêt'; end if;
 if not exists(select 1 from stock.cash_purchase_receipts r where r.cash_purchase_id=p_purchase_id and r.cancelled_at is null and r.file_url is not null and btrim(r.file_url)<>'') then raise exception 'Justificatif fournisseur obligatoire'; end if;
 if jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'items')<>'array' or jsonb_array_length(p_payload->'items')=0 then raise exception 'Lignes de contrôle obligatoires'; end if;
 v_paid:=nullif(p_payload->>'amount_paid_supplier','')::numeric; v_returned:=nullif(p_payload->>'amount_returned_to_controller','')::numeric;
 if v_paid is null or v_paid<0 or v_returned is null or v_returned<0 then raise exception 'Montants fournisseur/retour invalides'; end if;
 select count(*) into v_count from stock.cash_purchase_items where cash_purchase_id=p_purchase_id;
 if v_count<>jsonb_array_length(p_payload->'items') then raise exception 'Toutes les lignes doivent être contrôlées'; end if;
 for v_item in select * from jsonb_to_recordset(p_payload->'items') as x(item_id uuid,quantity_bought numeric,quantity_bought_stock numeric,conversion_factor numeric,unit_price_real numeric,unit_price_real_stock numeric,supplier text,invoice_number text,invoice_date date,comment text,quantity_accepted numeric,control_comment text) loop
  if v_item.item_id is null or v_item.quantity_bought is null or v_item.unit_price_real is null or v_item.quantity_accepted is null or v_item.quantity_bought<0 or v_item.quantity_accepted<0 or v_item.quantity_accepted>v_item.quantity_bought then raise exception 'Données de ligne invalides'; end if;
  if v_item.item_id=any(v_seen) then raise exception 'Ligne de contrôle dupliquée'; end if; v_seen:=array_append(v_seen,v_item.item_id);
  select * into v_existing from stock.cash_purchase_items where id=v_item.item_id and cash_purchase_id=p_purchase_id for update;
  if not found then raise exception 'Ligne étrangère'; end if;
  update stock.cash_purchase_items set quantity_bought=v_item.quantity_bought,quantity_bought_stock=v_item.quantity_bought_stock,conversion_factor=coalesce(v_item.conversion_factor,conversion_factor),unit_price_real=v_item.unit_price_real,unit_price_real_stock=v_item.unit_price_real_stock,supplier=v_item.supplier,invoice_number=v_item.invoice_number,invoice_date=v_item.invoice_date,comment=v_item.comment,quantity_accepted=v_item.quantity_accepted,control_comment=nullif(btrim(v_item.control_comment),'') where id=v_item.item_id;
 end loop;
 select round(sum(quantity_bought*unit_price_real),2),round(sum(quantity_accepted*unit_price_real),2) into v_total,v_accepted from stock.cash_purchase_items where cash_purchase_id=p_purchase_id;
 if v_total is null or v_accepted is null then raise exception 'Montant contrôlé impossible à calculer'; end if;
 v_expected:=greatest(0,v_purchase.amount_given-v_paid);
 update stock.cash_purchases set total_purchased=v_total,amount_paid_supplier=v_paid,amount_returned_to_controller=v_returned,amount_accepted=v_accepted,change_expected=v_expected,difference=v_expected-v_returned,status=case when exists(select 1 from stock.cash_purchase_items i where i.cash_purchase_id=p_purchase_id and i.quantity_accepted<i.quantity_bought) then 'retour_partiel' else 'retour_complet' end,cash_status=case when v_expected=v_returned then 'monnaie_rendue' else 'ecart_a_valider' end,reception_status=case when exists(select 1 from stock.cash_purchase_items i where i.cash_purchase_id=p_purchase_id and i.quantity_accepted<i.quantity_bought) then 'reception_partielle' else 'reception_conforme' end,controlled_by=v_profile_id,controlled_at=v_now,updated_by=v_profile_id,updated_at=v_now where id=p_purchase_id;
 if greatest(0,v_paid-v_purchase.amount_given)>0 then insert into stock.cash_purchase_differences(cash_purchase_id,difference_type,amount,description,status) values(p_purchase_id,'funding_gap',round(greatest(0,v_paid-v_purchase.amount_given),2),'Financement complémentaire à justifier','a_justifier'); end if;
 if greatest(0,v_paid-v_accepted)>0 then insert into stock.cash_purchase_differences(cash_purchase_id,difference_type,amount,description,status) values(p_purchase_id,'control_regularization',round(greatest(0,v_paid-v_accepted),2),'Montant payé non accepté au contrôle','a_justifier') returning id into v_difference_id; end if;
 if greatest(0,v_expected-v_returned)>0 then insert into stock.cash_purchase_differences(cash_purchase_id,difference_type,amount,description,status) values(p_purchase_id,'cash_return_shortage',round(greatest(0,v_expected-v_returned),2),'Monnaie insuffisante remise au Contrôleur','a_justifier'); end if;
 if greatest(0,v_returned-v_expected)>0 then insert into stock.cash_purchase_differences(cash_purchase_id,difference_type,amount,description,status) values(p_purchase_id,'cash_return_surplus',round(greatest(0,v_returned-v_expected),2),'Surplus de monnaie remis au Contrôleur','a_justifier'); end if;
 for v_reg in select i.* from stock.cash_purchase_items i where i.cash_purchase_id=p_purchase_id and i.quantity_accepted is not null and i.quantity_bought>i.quantity_accepted loop
  insert into stock.cash_purchase_supplier_regularizations(cash_purchase_id,cash_purchase_item_id,difference_id,article_id,quantity_delivered,quantity_accepted,quantity_refused,unit_price_real,value_to_regularize,supplier_id,opened_by)
  values(p_purchase_id,v_reg.id,v_difference_id,v_reg.article_id,v_reg.quantity_bought,v_reg.quantity_accepted,v_reg.quantity_bought-v_reg.quantity_accepted,v_reg.unit_price_real,round((v_reg.quantity_bought-v_reg.quantity_accepted)*v_reg.unit_price_real,2),null,v_profile_id) returning id into v_reg_id;
  insert into stock.cash_purchase_supplier_regularization_history(regularization_id,event_type,to_status,actor_profile_id,metadata) values(v_reg_id,'opened','awaiting_isolation',v_profile_id,jsonb_build_object('current_responsible_role','magasinier','cash_purchase_item_id',v_reg.id,'quantity_refused',v_reg.quantity_bought-v_reg.quantity_accepted,'value_to_regularize',round((v_reg.quantity_bought-v_reg.quantity_accepted)*v_reg.unit_price_real,2)));
 end loop;
 return jsonb_build_object('id',p_purchase_id,'total_real',v_total,'amount_accepted',v_accepted,'amount_paid_supplier',v_paid,'amount_returned_to_controller',v_returned,'controlled_by',v_profile_id,'controlled_at',v_now);
end; $$;
revoke all on function stock.receive_and_control_cash_purchase(uuid,jsonb,text) from public,anon;
grant execute on function stock.receive_and_control_cash_purchase(uuid,jsonb,text) to authenticated;

