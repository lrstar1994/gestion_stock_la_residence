-- Read-only purchase reporting access before stock location scoping (160001).
-- These RPCs expose only report/regularization fields; they do not grant
-- SELECT on operational reception, location, movement, or inventory tables.

create or replace function stock.list_purchase_reporting_receptions(
  p_from_date date default null,
  p_to_date date default null,
  p_statuses text[] default null,
  p_reception_ids uuid[] default null,
  p_open_only boolean default false,
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  id uuid,
  reference text,
  reception_date date,
  status text,
  total_amount numeric,
  invoice_number text,
  supplier_name text,
  location_name text,
  receiver_name text,
  article_names text[],
  document_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, stock, auth
as $$
declare
  v_role stock.user_role;
begin
  select p.role into v_role
  from stock.profiles p
  where p.user_id = auth.uid() and p.status = 'active'
  limit 1;

  if v_role is null or v_role not in ('direction', 'controleur', 'caisse') then
    raise exception 'Profil actif non autorisé à consulter les rapports de réception';
  end if;
  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then
    raise exception 'Période de réception invalide';
  end if;
  if p_limit < 1 or p_limit > 500 or p_offset < 0 then
    raise exception 'Pagination de réception invalide';
  end if;

  return query
  select r.id, r.reference, r.reception_date, r.status::text, r.total_amount,
    r.invoice_number, s.name, l.name, p.full_name,
    coalesce(array_agg(distinct a.name) filter (where a.name is not null), '{}'::text[]),
    count(distinct rd.id)
  from stock.receptions r
  left join stock.suppliers s on s.id = r.supplier_id
  left join stock.locations l on l.id = r.location_id
  left join stock.profiles p on p.id = r.created_by
  left join stock.reception_items ri on ri.reception_id = r.id
  left join stock.articles a on a.id = ri.article_id
  left join stock.reception_documents rd on rd.reception_id = r.id
  where (p_from_date is null or r.reception_date >= p_from_date)
    and (p_to_date is null or r.reception_date <= p_to_date)
    and (p_statuses is null or r.status::text = any(p_statuses))
    and (p_reception_ids is null or r.id = any(p_reception_ids))
    and (not p_open_only or r.status::text not in ('entree_stock', 'refusee'))
  group by r.id, s.name, l.name, p.full_name
  order by r.reception_date desc, r.created_at desc, r.id
  limit p_limit offset p_offset;
end;
$$;
revoke all on function stock.list_purchase_reporting_receptions(date,date,text[],uuid[],boolean,integer,integer) from public, anon, authenticated;
grant execute on function stock.list_purchase_reporting_receptions(date,date,text[],uuid[],boolean,integer,integer) to authenticated;

create or replace function stock.list_supplier_regularization_reporting(
  p_cash_purchase_id uuid default null,
  p_regularization_id uuid default null,
  p_open_only boolean default true
)
returns table (
  id uuid,
  cash_purchase_id uuid,
  cash_purchase_reference text,
  cash_purchase_item_id uuid,
  article_name text,
  supplier_name text,
  quantity_delivered numeric,
  quantity_accepted numeric,
  quantity_refused numeric,
  value_to_regularize numeric,
  treatment_type text,
  status text,
  current_responsible_role text,
  physical_location_id uuid,
  physical_location_name text,
  physical_location_note text,
  opened_at timestamptz,
  due_at timestamptz,
  resolution_type text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, stock, auth
as $$
declare
  v_role stock.user_role;
begin
  select p.role into v_role
  from stock.profiles p
  where p.user_id = auth.uid() and p.status = 'active'
  limit 1;

  if v_role is null or v_role not in ('direction', 'caisse', 'controleur', 'magasinier') then
    raise exception 'Profil actif non autorisé au suivi des régularisations fournisseur';
  end if;

  return query
  select sr.id, sr.cash_purchase_id, cp.reference, sr.cash_purchase_item_id,
    a.name, s.name, sr.quantity_delivered, sr.quantity_accepted,
    sr.quantity_refused, sr.value_to_regularize,
    sr.treatment_type, sr.status, sr.current_responsible_role::text,
    sr.physical_location_id, l.name, sr.physical_location_note,
    sr.opened_at, sr.due_at, sr.resolution_type
  from stock.cash_purchase_supplier_regularizations sr
  left join stock.cash_purchases cp on cp.id = sr.cash_purchase_id
  left join stock.articles a on a.id = sr.article_id
  left join stock.suppliers s on s.id = sr.supplier_id
  left join stock.locations l on l.id = sr.physical_location_id
  where (p_cash_purchase_id is null or sr.cash_purchase_id = p_cash_purchase_id)
    and (p_regularization_id is null or sr.id = p_regularization_id)
    and (not p_open_only or sr.status <> 'resolved')
  order by sr.opened_at desc, sr.id;
end;
$$;
revoke all on function stock.list_supplier_regularization_reporting(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function stock.list_supplier_regularization_reporting(uuid,uuid,boolean) to authenticated;
