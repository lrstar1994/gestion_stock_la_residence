-- Local additive migration, intentionally held out of the active migration chain.
-- Makes buyer selection and cash disbursement one transactional RPC call.

create or replace function stock.disburse_cash_purchase(
  p_cash_purchase_id uuid,
  p_amount numeric,
  p_buyer_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_buyer_id uuid;
  v_purchase stock.cash_purchases%rowtype;
  v_account stock.financial_accounts%rowtype;
  v_existing_movement stock.financial_movements%rowtype;
  v_movement_id uuid;
  v_movement_count integer;
  v_idempotency_key text;
  v_given_at timestamptz;
begin
  select p.id into v_profile_id
  from stock.profiles p
  where p.user_id = auth.uid()
    and p.role = 'caisse'::stock.user_role
    and p.status = 'active'::stock.user_status;
  if v_profile_id is null then
    raise exception 'Profil Caisse actif requis';
  end if;

  perform stock.assert_sensitive_action(
    'cash_purchases.disburse', p_pin, 'cash_purchase.disburse',
    'cash_purchase', p_cash_purchase_id, null, '{}'::jsonb
  );

  select p.id into v_buyer_id
  from stock.profiles p
  where p.id = p_buyer_id
    and p.role = 'acheteur'::stock.user_role
    and p.status = 'active'::stock.user_status;
  if v_buyer_id is null then
    raise exception 'Acheteur actif requis';
  end if;

  select * into v_purchase
  from stock.cash_purchases
  where id = p_cash_purchase_id
  for update;
  if not found then
    raise exception 'Dossier achat espèces introuvable';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Le montant remis doit être supérieur à 0';
  end if;

  if coalesce(v_purchase.amount_given, 0) > 0 or v_purchase.given_at is not null then
    if v_purchase.amount_given is null
       or v_purchase.given_at is null
       or v_purchase.given_by is null
       or v_purchase.financial_account_id is null then
      raise exception 'Incohérence historique : remise journalisée incomplète';
    end if;
    select fa.* into v_account
    from stock.financial_accounts fa
    where fa.id = v_purchase.financial_account_id
      and fa.active
      and fa.account_type = 'cash'
      and fa.currency = 'MGA';
    if not found then
      raise exception 'Le compte financier mémorisé est introuvable ou inactif';
    end if;
    if not exists (
      select 1 from stock.financial_account_access faa
      where faa.account_id = v_purchase.financial_account_id
        and faa.profile_id = v_profile_id and faa.active
    ) then
      raise exception 'Le compte financier de ce décaissement n’est pas affecté à cette Caisse';
    end if;
    select fm.* into v_existing_movement
    from stock.financial_movements fm
    where fm.source_type = 'cash_purchase'
      and fm.event_type = 'cash_disbursed'
      and fm.source_id = v_purchase.id
    limit 1;
    if not found then
      raise exception 'Incohérence historique : remise enregistrée sans mouvement financier';
    end if;
    select count(*) into v_movement_count
    from stock.financial_movements fm
    where fm.source_type = 'cash_purchase'
      and fm.event_type = 'cash_disbursed'
      and fm.source_id = v_purchase.id;
    if v_movement_count <> 1 then
      raise exception 'Incohérence historique : plusieurs mouvements de remise existent';
    end if;
    if v_purchase.buyer_id is distinct from v_buyer_id
       or v_existing_movement.counterparty_profile_id is distinct from v_buyer_id
       or v_existing_movement.account_id is distinct from v_purchase.financial_account_id
       or v_existing_movement.amount is distinct from v_purchase.amount_given
       or v_existing_movement.confirmed_by is distinct from v_purchase.given_by
       or v_existing_movement.direction is distinct from 'out'
       or v_existing_movement.currency is distinct from 'MGA'
       or v_existing_movement.payment_mode is distinct from 'especes'
       or p_amount is distinct from v_purchase.amount_given then
      raise exception 'La remise existe déjà avec des données différentes';
    end if;
    return jsonb_build_object(
      'cash_purchase_id', v_purchase.id,
      'amount_given', v_purchase.amount_given,
      'buyer_id', v_buyer_id,
      'given_by', v_purchase.given_by,
      'given_at', v_purchase.given_at,
      'financial_account_id', v_purchase.financial_account_id,
      'financial_movement_id', v_existing_movement.id
    );
  end if;

  if v_purchase.status <> 'valide'::stock.cash_purchase_status then
    raise exception 'Le décaissement n’est pas autorisé par la Direction';
  end if;
  if v_purchase.cash_source <> 'caisse_principale'::stock.cash_purchase_source then
    raise exception 'Compte financier non configuré pour cette source de caisse';
  end if;

  select fa.* into v_account
  from stock.financial_accounts fa
  where fa.code = 'CASH_MAIN'
    and fa.active and fa.account_type = 'cash' and fa.currency = 'MGA';
  if not found then
    raise exception 'Compte financier non configuré pour cette source de caisse';
  end if;
  if not exists (
    select 1 from stock.financial_account_access faa
    where faa.account_id = v_account.id and faa.profile_id = v_profile_id and faa.active
  ) then
    raise exception 'Le compte financier n’est pas affecté à cette Caisse';
  end if;

  v_given_at := now();
  v_idempotency_key := 'cash_purchase:' || v_purchase.id::text
    || ':cash_disbursed:' || v_account.id::text;

  update stock.cash_purchases
  set buyer_id = v_buyer_id,
      amount_given = p_amount,
      given_by = v_profile_id,
      given_at = v_given_at,
      financial_account_id = v_account.id,
      status = 'especes_remises',
      cash_status = 'especes_remises',
      updated_by = v_profile_id,
      updated_at = v_given_at
  where id = v_purchase.id;

  insert into stock.financial_movements (
    account_id, direction, amount, currency, occurred_at, event_type,
    source_type, source_id, source_occurrence_id, idempotency_key,
    counterparty_profile_id, payment_mode, reference, description,
    confirmed_by, confirmed_at, created_by, metadata
  ) values (
    v_account.id, 'out', p_amount, 'MGA', v_given_at, 'cash_disbursed',
    'cash_purchase', v_purchase.id, null, v_idempotency_key,
    v_buyer_id, 'especes', v_purchase.reference,
    'Remise espèces achat direct', v_profile_id, v_given_at, v_profile_id,
    '{}'::jsonb
  ) returning id into v_movement_id;

  insert into stock.sensitive_action_audit (
    action_code, required_permission, actor_profile_id, entity_type, entity_id,
    outcome, reason, metadata
  ) values (
    'cash_purchase.disbursed', 'cash_purchases.disburse', v_profile_id,
    'cash_purchase', v_purchase.id, 'completed', null,
    jsonb_build_object('financial_account_id', v_account.id, 'amount_given', p_amount, 'buyer_id', v_buyer_id)
  );

  return jsonb_build_object(
    'cash_purchase_id', v_purchase.id,
    'amount_given', p_amount,
    'buyer_id', v_buyer_id,
    'given_by', v_profile_id,
    'given_at', v_given_at,
    'financial_account_id', v_account.id,
    'financial_movement_id', v_movement_id
  );
end;
$$;

revoke all on function stock.disburse_cash_purchase(uuid, numeric, uuid, text)
  from public, anon, authenticated;

grant execute on function stock.disburse_cash_purchase(uuid, numeric, uuid, text)
  to authenticated;

-- After the four-argument RPC is adopted, the legacy callable surface is closed.
revoke all on function stock.disburse_cash_purchase(uuid, numeric, text)
  from public, anon, authenticated;
