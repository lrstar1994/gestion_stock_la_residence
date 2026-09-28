-- Lot Achats 2 : RPC locale étendue aux quatre orientations. Non exécutée à distance.
alter table stock.purchase_needs drop constraint if exists purchase_needs_line_processing_mode_check;
alter table stock.purchase_needs add constraint purchase_needs_line_processing_mode_check check (processing_mode is null or processing_mode in ('none','cash','supplier','supplier_delivery','to_reorient')) not valid;
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
    if v_decision.decision not in ('cash','supplier_delivery','supplier','refused') then raise exception 'Décision de ligne invalide'; end if;
    if v_decision.decision in ('supplier','supplier_delivery') and v_decision.supplier_id is null then raise exception 'Fournisseur obligatoire pour une ligne commande fournisseur'; end if;
    if v_decision.decision = 'refused' and nullif(btrim(v_decision.refused_reason), '') is null then raise exception 'Motif obligatoire pour une ligne refusée'; end if;
    if exists (select 1 from stock.cash_purchase_items c where c.purchase_need_id = v_need.id)
       or exists (select 1 from stock.purchase_order_needs o where o.need_id = v_need.id) then
      raise exception 'La ligne % a déjà un traitement en cours', v_need.id;
    end if;
    if v_decision.decision in ('supplier','supplier_delivery') and not exists (select 1 from stock.suppliers s where s.id = v_decision.supplier_id) then
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

  update stock.purchase_needs n set decision_status = case when d.decision='refused' then 'refused' else 'approved' end, processing_mode = case when d.decision='refused' then 'none' when d.decision='supplier_delivery' then 'supplier_delivery' else d.decision end, processing_supplier_id = case when d.decision in ('supplier','supplier_delivery') then d.supplier_id else null end, refused_reason = d.refused_reason, direction_comment = d.direction_comment, decided_by = v_profile_id, decided_at = now(), status = (case when d.decision='refused' then 'refuse' else 'regroupe' end)::stock.purchase_need_status, validated_by = v_profile_id, validated_at = now(), updated_by = v_profile_id, updated_at = now() from jsonb_to_recordset(p_decisions) d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) where n.id=d.purchase_need_id;
  select count(*) into v_refused_count from jsonb_to_recordset(p_decisions) as d(purchase_need_id uuid, decision text, supplier_id uuid, refused_reason text, direction_comment text) where d.decision='refused';
  return jsonb_build_object('refused_count',v_refused_count,'cash_purchases',v_cash_ids,'purchase_orders',v_orders,'cash_count',v_cash_count,'supplier_count',v_supplier_count);
end;
$$;
revoke all on function stock.apply_purchase_need_line_decisions(text, jsonb) from public, anon;
grant execute on function stock.apply_purchase_need_line_decisions(text, jsonb) to authenticated;