-- Micro-lot 3A : remise physique distincte du plafond Direction.
-- Préparée localement, non appliquée. Cible autorisée : TEST uniquement.
create or replace function stock.disburse_cash_purchase(p_cash_purchase_id uuid, p_amount numeric, p_pin text)
returns jsonb language plpgsql security definer set search_path=stock,public,auth,extensions as $$
declare v_profile_id uuid; v_purchase stock.cash_purchases;
begin
  select id into v_profile_id from stock.profiles where user_id=auth.uid() and role='caisse'::stock.user_role and status='active'::stock.user_status;
  if v_profile_id is null then raise exception 'Profil Caisse actif requis'; end if;
  perform stock.assert_sensitive_action('cash_purchases.disburse', p_pin, 'cash_purchase.disburse', 'cash_purchase', p_cash_purchase_id, null, '{}'::jsonb);
  select * into v_purchase from stock.cash_purchases where id=p_cash_purchase_id for update;
  if not found then raise exception 'Dossier achat espèces introuvable'; end if;
  if v_purchase.status <> 'valide'::stock.cash_purchase_status then raise exception 'Le décaissement n’est pas autorisé par la Direction'; end if;
  if coalesce(v_purchase.amount_given,0) > 0 or v_purchase.given_at is not null then raise exception 'La remise d’espèces a déjà été effectuée'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Le montant remis doit être supérieur à 0'; end if;
  update stock.cash_purchases set amount_given=p_amount, status='especes_remises', cash_status='especes_remises', given_by=v_profile_id, given_at=now(), updated_by=v_profile_id, updated_at=now() where id=p_cash_purchase_id;
  return jsonb_build_object('cash_purchase_id',p_cash_purchase_id,'amount_given',p_amount,'given_by',v_profile_id,'given_at',now());
end $$;

-- Conserver explicitement les restrictions de 202609050003, à chaque application.
REVOKE EXECUTE ON FUNCTION stock.disburse_cash_purchase(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION stock.disburse_cash_purchase(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION stock.disburse_cash_purchase(uuid, numeric, text) TO authenticated;
