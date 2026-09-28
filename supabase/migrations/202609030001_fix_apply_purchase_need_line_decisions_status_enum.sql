-- Correction enum idempotente pour Supabase test uniquement.
-- Elle n'est pas exécutée par ce changement local.
create or replace function stock.apply_purchase_need_line_decisions(
  p_pin text,
  p_decisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = stock, public, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_cash_id uuid;
  v_cash_reference text;
  v_order_id uuid;
  v_order_reference text;
  v_supplier record;
  v_decision record;
  v_need record;
  v_cash_count integer := 0;
  v_supplier_count integer := 0;
  v_refused_count integer := 0;
  v_cash_ids jsonb := '[]'::jsonb;
  v_orders jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_decisions) <> 'array' or jsonb_array_length(p_decisions) = 0 then
    raise exception 'Aucune décision à appliquer';
  end if;

  v_profile_id := stock.assert_sensitive_action(
    'purchase_need.validate', p_pin, 'purchase_need.decide_lines', 'purchase_need_batch', null,
    null, jsonb_build_object('decision_count', jsonb_array_length(p_decisions))
  );

  for v_decision in select * from jsonb_to_recordset(p_decisions)
    as d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text)
  loop
    select * into v_need from stock.purchase_needs where id = v_decision.purchase_need_id for update;
    if not found then raise exception 'Ligne de besoin introuvable : %', v_decision.purchase_need_id; end if;
    if coalesce(v_need.decision_status, 'pending') <> 'pending' or v_need.status not in ('a_faire','valide') then
      raise exception 'La ligne % a déjà été décidée ou traitée', coalesce(v_need.id::text, 'inconnue');
    end if;
    if v_decision.decision not in ('cash','supplier','refused') then raise exception 'Décision de ligne invalide'; end if;
    if v_decision.decision = 'supplier' and v_decision.supplier_id is null then raise exception 'Fournisseur obligatoire pour une ligne commande fournisseur'; end if;
    if v_decision.decision = 'refused' and nullif(btrim(v_decision.refused_reason), '') is null then raise exception 'Motif obligatoire pour une ligne refusée'; end if;
    if exists (select 1 from stock.cash_purchase_items c where c.purchase_need_id = v_need.id)
       or exists (select 1 from stock.purchase_order_needs o where o.need_id = v_need.id) then
      raise exception 'La ligne % a déjà un traitement en cours', v_need.id;
    end if;
    if v_decision.decision = 'supplier' and not exists (select 1 from stock.suppliers s where s.id = v_decision.supplier_id) then
      raise exception 'Fournisseur introuvable pour la ligne %', v_need.id;
    end if;
  end loop;

  if exists (select 1 from jsonb_to_recordset(p_decisions) as d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) where decision = 'cash') then
    v_cash_id := gen_random_uuid();
    v_cash_reference := 'CA-' || to_char(current_date, 'YYYY-MM-DD') || '-' || upper(substr(replace(v_cash_id::text,'-',''),1,6));
    insert into stock.cash_purchases(id, reference, buyer_id, cash_source, reason, request_date, total_estimated, amount_requested, status, cash_status, created_by)
    select v_cash_id, v_cash_reference, v_profile_id, 'caisse_principale', 'Achat espèces issu de décisions Direction', current_date, sum(n.estimated_cost), sum(n.estimated_cost), 'en_attente', 'especes_demandees', v_profile_id
    from stock.purchase_needs n join jsonb_to_recordset(p_decisions) d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) on d.purchase_need_id=n.id where d.decision='cash';
    insert into stock.cash_purchase_items(cash_purchase_id, article_id, purchase_need_id, quantity_planned, unit_id, unit_price_estimated, total_estimated, stock_unit_id, quantity_planned_stock)
    select v_cash_id, n.article_id, n.id, n.quantity, n.unit_id, coalesce(n.estimated_price,0), coalesce(n.estimated_cost,0), n.unit_id, n.quantity
    from stock.purchase_needs n join jsonb_to_recordset(p_decisions) d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) on d.purchase_need_id=n.id where d.decision='cash';
    v_cash_count := 1;
    v_cash_ids := jsonb_build_array(jsonb_build_object('id', v_cash_id, 'reference', v_cash_reference));
  end if;

  for v_supplier in select distinct supplier_id from jsonb_to_recordset(p_decisions) as d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) where decision='supplier'
  loop
    v_order_id := gen_random_uuid();
    v_order_reference := 'PO-' || to_char(current_date, 'YYYY-MM-DD') || '-' || upper(substr(replace(v_order_id::text,'-',''),1,6));
    insert into stock.purchase_orders(id, reference, supplier_id, delivery_date, total_amount, status, created_by)
    select v_order_id, v_order_reference, v_supplier.supplier_id, current_date, sum(n.estimated_cost), 'brouillon', v_profile_id
    from stock.purchase_needs n join jsonb_to_recordset(p_decisions) d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) on d.purchase_need_id=n.id where d.decision='supplier' and d.supplier_id=v_supplier.supplier_id;
    insert into stock.purchase_order_items(purchase_order_id, article_id, quantity_ordered, unit_id, unit_price, comment, stock_unit_id, quantity_ordered_stock)
    select v_order_id, n.article_id, n.quantity, n.unit_id, coalesce(n.estimated_price,0), n.comment, n.unit_id, n.quantity
    from stock.purchase_needs n join jsonb_to_recordset(p_decisions) d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) on d.purchase_need_id=n.id where d.decision='supplier' and d.supplier_id=v_supplier.supplier_id;
    insert into stock.purchase_order_needs(purchase_order_id, need_id)
    select v_order_id, d.purchase_need_id from jsonb_to_recordset(p_decisions) d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) where d.decision='supplier' and d.supplier_id=v_supplier.supplier_id;
    v_supplier_count := v_supplier_count + 1;
    v_orders := v_orders || jsonb_build_array(jsonb_build_object('id', v_order_id, 'reference', v_order_reference, 'supplier_id', v_supplier.supplier_id));
  end loop;

  update stock.purchase_needs n set decision_status = case when d.decision='refused' then 'refused' else 'approved' end, processing_mode = case when d.decision='refused' then 'none' else d.decision end, processing_supplier_id = case when d.decision='supplier' then d.supplier_id else null end, refused_reason = d.refused_reason, direction_comment = d.direction_comment, decided_by = v_profile_id, decided_at = now(), status = (case when d.decision='refused' then 'refuse' else 'regroupe' end)::stock.purchase_need_status, validated_by = v_profile_id, validated_at = now(), updated_by = v_profile_id, updated_at = now() from jsonb_to_recordset(p_decisions) d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) where n.id=d.purchase_need_id;
  select count(*) into v_refused_count from jsonb_to_recordset(p_decisions) as d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) where d.decision='refused';
  return jsonb_build_object('refused_count',v_refused_count,'cash_purchases',v_cash_ids,'purchase_orders',v_orders,'cash_count',v_cash_count,'supplier_count',v_supplier_count);
end;
$$;
revoke all on function stock.apply_purchase_need_line_decisions(text, jsonb) from public, anon;
grant execute on function stock.apply_purchase_need_line_decisions(text, jsonb) to authenticated;