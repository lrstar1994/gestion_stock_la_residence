-- C1.4 : branchement transactionnel de la remise 3A au journal financier.
-- Local uniquement : aucun backfill et aucune donnée créée par cette migration.

alter table stock.cash_purchases
  add column if not exists financial_account_id uuid
    references stock.financial_accounts(id) on delete restrict;

create index if not exists cash_purchases_financial_account_idx
  on stock.cash_purchases(financial_account_id);

create unique index if not exists financial_movements_one_cash_purchase_disbursement_idx
  on stock.financial_movements(source_type, event_type, source_id)
  where source_type = 'cash_purchase' and event_type = 'cash_disbursed';

create or replace function stock.disburse_cash_purchase(
  p_cash_purchase_id uuid,
  p_amount numeric,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_purchase stock.cash_purchases%rowtype;
  v_account stock.financial_accounts%rowtype;
  v_existing_movement stock.financial_movements%rowtype;
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
    select fm.* into v_existing_movement
    from stock.financial_movements fm
    where fm.source_type = 'cash_purchase'
      and fm.event_type = 'cash_disbursed'
      and fm.source_id = v_purchase.id
    limit 1;

    if v_purchase.financial_account_id is not null
       and found
       and v_existing_movement.account_id = v_purchase.financial_account_id
       and v_existing_movement.amount = v_purchase.amount_given
       and p_amount = v_purchase.amount_given then
      return jsonb_build_object(
        'cash_purchase_id', v_purchase.id,
        'amount_given', v_purchase.amount_given,
        'given_by', v_purchase.given_by,
        'given_at', v_purchase.given_at,
        'financial_account_id', v_purchase.financial_account_id,
        'financial_movement_id', v_existing_movement.id
      );
    end if;

    if v_purchase.financial_account_id is null and not found then
      raise exception 'Ancien décaissement pré-journal : aucune remise financière rétroactive';
    end if;
    raise exception 'La remise d’espèces a déjà été effectuée avec un montant différent';
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
    and fa.active
    and fa.account_type = 'cash'
    and fa.currency = 'MGA';
  if not found then
    raise exception 'Compte financier non configuré pour cette source de caisse';
  end if;

  if not exists (
    select 1
    from stock.financial_account_access faa
    where faa.account_id = v_account.id
      and faa.profile_id = v_profile_id
      and faa.active
  ) then
    raise exception 'Le compte financier n’est pas affecté à cette Caisse';
  end if;

  v_given_at := now();
  v_idempotency_key := 'cash_purchase:' || v_purchase.id::text
    || ':cash_disbursed:' || v_account.id::text;

  update stock.cash_purchases
  set amount_given = p_amount,
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
    source_type, source_id, source_occurrence_id, idempotency_key, counterparty_profile_id,
    payment_mode,
    reference, description, confirmed_by, confirmed_at, created_by, metadata
  ) values (
    v_account.id, 'out', p_amount, 'MGA', v_given_at, 'cash_disbursed',
    'cash_purchase', v_purchase.id, null, v_idempotency_key, v_purchase.buyer_id,
    'especes',
    v_purchase.reference, 'Remise espèces achat direct', v_profile_id,
    v_given_at, v_profile_id, '{}'::jsonb
  );

  insert into stock.sensitive_action_audit (
    action_code, required_permission, actor_profile_id, entity_type, entity_id,
    outcome, reason, metadata
  ) values (
    'cash_purchase.disbursed', 'cash_purchases.disburse', v_profile_id,
    'cash_purchase', v_purchase.id, 'completed', null,
    jsonb_build_object('financial_account_id', v_account.id, 'amount_given', p_amount)
  );

  return jsonb_build_object(
    'cash_purchase_id', v_purchase.id,
    'amount_given', p_amount,
    'given_by', v_profile_id,
    'given_at', v_given_at,
    'financial_account_id', v_account.id,
    'financial_movement_id', (select fm.id from stock.financial_movements fm where fm.idempotency_key = v_idempotency_key)
  );
end;
$$;

revoke all on function stock.disburse_cash_purchase(uuid, numeric, text)
  from public, anon, authenticated;
grant execute on function stock.disburse_cash_purchase(uuid, numeric, text)
  to authenticated;
