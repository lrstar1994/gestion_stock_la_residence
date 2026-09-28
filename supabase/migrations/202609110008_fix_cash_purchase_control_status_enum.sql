-- Corrective cast for cash_purchases.status enum assignment.
-- The RPC body matches 202609110006 except for the explicit enum cast.
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
 update stock.cash_purchases set total_purchased=v_total,amount_paid_supplier=v_paid,amount_returned_to_controller=v_returned,amount_accepted=v_accepted,change_expected=v_expected,difference=v_expected-v_returned,status=(case when exists(select 1 from stock.cash_purchase_items i where i.cash_purchase_id=p_purchase_id and i.quantity_accepted<i.quantity_bought) then 'retour_partiel' else 'retour_complet' end)::stock.cash_purchase_status,cash_status=case when v_expected=v_returned then 'monnaie_rendue' else 'ecart_a_valider' end,reception_status=case when exists(select 1 from stock.cash_purchase_items i where i.cash_purchase_id=p_purchase_id and i.quantity_accepted<i.quantity_bought) then 'reception_partielle' else 'reception_conforme' end,controlled_by=v_profile_id,controlled_at=v_now,updated_by=v_profile_id,updated_at=v_now where id=p_purchase_id;
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
