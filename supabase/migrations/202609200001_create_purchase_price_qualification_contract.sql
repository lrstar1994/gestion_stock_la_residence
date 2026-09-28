-- Achats: qualification explicite des observations de prix réels.
-- Les montants restent dans les lignes sources officielles; cette table ne
-- conserve que la qualification et son audit.

create table if not exists stock.purchase_price_qualifications (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('cash_purchase_item', 'reception_item', 'invoice_item')),
  source_line_id uuid not null,
  classification text not null check (classification in ('normal', 'promotional', 'exceptional')),
  reason text,
  qualified_by uuid not null references stock.profiles(id) on delete restrict,
  qualified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_line_id),
  check (classification = 'normal' or nullif(btrim(reason), '') is not null)
);

create index if not exists purchase_price_qualifications_article_lookup_idx
  on stock.purchase_price_qualifications (source_type, classification, qualified_at desc);

create table if not exists stock.purchase_price_qualification_history (
  id uuid primary key default gen_random_uuid(),
  qualification_id uuid not null references stock.purchase_price_qualifications(id) on delete restrict,
  source_type text not null,
  source_line_id uuid not null,
  previous_classification text,
  new_classification text not null,
  previous_reason text,
  new_reason text,
  action text not null check (action in ('created', 'changed')),
  actor_profile_id uuid not null references stock.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists purchase_price_qualification_history_lookup_idx
  on stock.purchase_price_qualification_history (qualification_id, created_at desc);

-- Cette vue interne expose uniquement les lignes dont le prix est arrivé à
-- une étape métier suffisamment finale. Elle ne vaut pas qualification:
-- classification reste NULL tant qu'une Direction ne l'a pas explicitement
-- attribuée.
-- `unit_price_real_stock` est déjà exprimé dans l'unité de stock lorsqu'il
-- est renseigné. `effective_material_unit_cost` des réceptions est déjà le
-- coût normalisé produit par le moteur de coût matière. Ces valeurs peuvent
-- donc être utilisées sans appliquer une seconde conversion.
create or replace view stock.purchase_actual_price_candidates as
select
  cpi.article_id,
  q.classification,
  cpi.unit_price_real::numeric as actual_unit_price_source,
  cpi.unit_id as source_unit_id,
  case
    when coalesce(cpi.stock_unit_id, a.unit_id) is null then null::numeric
    when cpi.unit_id = coalesce(cpi.stock_unit_id, a.unit_id) then cpi.unit_price_real::numeric
    when cpi.unit_price_real_stock is not null then cpi.unit_price_real_stock::numeric
    when cpi.conversion_factor is not null and cpi.conversion_factor > 0
      then (cpi.unit_price_real / cpi.conversion_factor)::numeric
    else null::numeric
  end as normalized_unit_price,
  coalesce(cpi.stock_unit_id, a.unit_id) as normalized_unit_id,
  case
    when coalesce(cpi.stock_unit_id, a.unit_id) is null then null::numeric
    when cpi.unit_id = coalesce(cpi.stock_unit_id, a.unit_id) then 1::numeric
    when cpi.conversion_factor is not null and cpi.conversion_factor > 0 then cpi.conversion_factor::numeric
    else null::numeric
  end as conversion_factor,
  cp.controlled_at as effective_date,
  null::uuid as supplier_id,
  'cash_purchase_item'::text as source_type,
  cpi.id as source_line_id,
  cpi.cash_purchase_id as source_id,
  null::text as tax_treatment,
  null::numeric as vat_rate,
  'actual_paid_price'::text as price_basis,
  cp.status::text as source_status
from stock.cash_purchase_items cpi
join stock.cash_purchases cp on cp.id = cpi.cash_purchase_id
left join stock.articles a on a.id = cpi.article_id
left join stock.purchase_price_qualifications q
  on q.source_type = 'cash_purchase_item' and q.source_line_id = cpi.id
where cpi.article_id is not null
  and cpi.unit_price_real is not null
  and cp.controlled_at is not null
  and cp.status::text in ('retour_partiel', 'retour_complet', 'cloture')

union all

select
  ri.article_id,
  q.classification,
  coalesce(ri.unit_price_display, ri.unit_price_real)::numeric as actual_unit_price_source,
  coalesce(ri.unit_display_id, ri.unit_id) as source_unit_id,
  case
    when ri.unit_id is null then null::numeric
    when coalesce(ri.unit_display_id, ri.unit_id) = ri.unit_id
      then coalesce(ri.effective_material_unit_cost, ri.unit_price_real)::numeric
    when ri.effective_material_unit_cost is not null
      then ri.effective_material_unit_cost::numeric
    when ri.conversion_factor is not null and ri.conversion_factor > 0
      then (ri.unit_price_real / ri.conversion_factor)::numeric
    else null::numeric
  end as normalized_unit_price,
  ri.unit_id as normalized_unit_id,
  case
    when ri.unit_id is null then null::numeric
    when coalesce(ri.unit_display_id, ri.unit_id) = ri.unit_id then 1::numeric
    when ri.conversion_factor is not null and ri.conversion_factor > 0 then ri.conversion_factor::numeric
    else null::numeric
  end as conversion_factor,
  r.validated_at as effective_date,
  r.supplier_id,
  'reception_item'::text as source_type,
  ri.id as source_line_id,
  ri.reception_id as source_id,
  ri.invoice_tax_mode::text as tax_treatment,
  ri.vat_rate::numeric,
  coalesce(ri.effective_cost_method::text, 'actual_reception_price') as price_basis,
  r.status::text as source_status
from stock.reception_items ri
join stock.receptions r on r.id = ri.reception_id
left join stock.purchase_price_qualifications q
  on q.source_type = 'reception_item' and q.source_line_id = ri.id
where ri.article_id is not null
  and ri.quantity_accepted > 0
  and ri.unit_price_real is not null
  and r.validated_at is not null
  and r.status::text in ('validee', 'validee_avec_anomalies', 'entree_stock')

union all

select
  ii.article_id,
  q.classification,
  ii.unit_price::numeric as actual_unit_price_source,
  ii.unit_id as source_unit_id,
  case when ii.unit_id = a.unit_id
    then coalesce(ii.effective_material_unit_cost, ii.unit_price)::numeric
    else null end as normalized_unit_price,
  a.unit_id as normalized_unit_id,
  case when ii.unit_id = a.unit_id then 1::numeric else null::numeric end as conversion_factor,
  i.validated_at as effective_date,
  i.supplier_id,
  'invoice_item'::text as source_type,
  ii.id as source_line_id,
  ii.invoice_id as source_id,
  ii.invoice_tax_mode::text as tax_treatment,
  ii.vat_rate::numeric,
  coalesce(ii.effective_cost_method::text, 'actual_invoice_price') as price_basis,
  i.status::text as source_status
from stock.invoice_items ii
join stock.invoices i on i.id = ii.invoice_id
left join stock.articles a on a.id = ii.article_id
left join stock.purchase_price_qualifications q
  on q.source_type = 'invoice_item' and q.source_line_id = ii.id
where ii.article_id is not null
  and ii.quantity > 0
  and ii.unit_price is not null
  and i.validated_at is not null
  and i.status::text in ('validee', 'a_payer', 'partiellement_paye', 'payee', 'cloturee');

create or replace function stock.record_purchase_price_qualification_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
begin
  insert into stock.purchase_price_qualification_history(
    qualification_id, source_type, source_line_id,
    previous_classification, new_classification,
    previous_reason, new_reason, action, actor_profile_id
  ) values (
    new.id, new.source_type, new.source_line_id,
    case when tg_op = 'UPDATE' then old.classification else null end,
    new.classification,
    case when tg_op = 'UPDATE' then old.reason else null end,
    new.reason,
    case when tg_op = 'UPDATE' then 'changed' else 'created' end,
    new.qualified_by
  );
  return new;
end;
$$;

drop trigger if exists purchase_price_qualification_history_trg
  on stock.purchase_price_qualifications;
create trigger purchase_price_qualification_history_trg
after insert or update on stock.purchase_price_qualifications
for each row execute function stock.record_purchase_price_qualification_history();

create or replace function stock.qualify_purchase_price(
  p_source_type text,
  p_source_line_id uuid,
  p_classification text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_profile_id uuid;
  v_id uuid;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if not stock.is_current_user_direction() then
    raise exception 'Seule la Direction peut qualifier un prix d achat';
  end if;

  v_profile_id := stock.current_profile_id();
  if v_profile_id is null then
    raise exception 'Profil Direction actif introuvable';
  end if;

  if p_source_type not in ('cash_purchase_item', 'reception_item', 'invoice_item') then
    raise exception 'Type de source de prix invalide';
  end if;
  if p_classification not in ('normal', 'promotional', 'exceptional') then
    raise exception 'Qualification de prix invalide';
  end if;
  if p_classification <> 'normal' and v_reason is null then
    raise exception 'Un motif est obligatoire pour un prix promotionnel ou exceptionnel';
  end if;
  if not exists (
    select 1 from stock.purchase_actual_price_candidates c
    where c.source_type = p_source_type
      and c.source_line_id = p_source_line_id
  ) then
    raise exception 'La ligne source n est pas admissible comme prix réel';
  end if;

  insert into stock.purchase_price_qualifications(
    source_type, source_line_id, classification, reason,
    qualified_by, qualified_at, updated_at
  ) values (
    p_source_type, p_source_line_id, p_classification, v_reason,
    v_profile_id, now(), now()
  )
  on conflict (source_type, source_line_id) do update set
    classification = excluded.classification,
    reason = excluded.reason,
    qualified_by = excluded.qualified_by,
    qualified_at = excluded.qualified_at,
    updated_at = excluded.updated_at
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function stock.get_last_normal_actual_purchase_price(p_article_id uuid)
returns table (
  article_id uuid,
  classification text,
  actual_unit_price_source numeric,
  source_unit_id uuid,
  normalized_unit_price numeric,
  normalized_unit_id uuid,
  conversion_factor numeric,
  effective_date timestamptz,
  supplier_id uuid,
  source_type text,
  source_id uuid,
  source_line_id uuid,
  tax_treatment text,
  vat_rate numeric,
  price_basis text,
  source_status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
begin
  if stock.current_profile_id() is null then
    raise exception 'Profil actif requis pour consulter les prix Achats';
  end if;

  return query
  select c.article_id, c.classification, c.actual_unit_price_source,
    c.source_unit_id, c.normalized_unit_price, c.normalized_unit_id,
    c.conversion_factor, c.effective_date, c.supplier_id, c.source_type,
    c.source_id, c.source_line_id, c.tax_treatment, c.vat_rate,
    c.price_basis, c.source_status
  from stock.purchase_actual_price_candidates c
  where c.article_id = p_article_id
    and c.classification = 'normal'
  order by c.effective_date desc, c.source_line_id desc
  limit 1;
end;
$$;

create or replace function stock.get_last_normal_actual_purchase_prices(p_article_ids uuid[])
returns table (
  article_id uuid,
  classification text,
  actual_unit_price_source numeric,
  source_unit_id uuid,
  normalized_unit_price numeric,
  normalized_unit_id uuid,
  conversion_factor numeric,
  effective_date timestamptz,
  supplier_id uuid,
  source_type text,
  source_id uuid,
  source_line_id uuid,
  tax_treatment text,
  vat_rate numeric,
  price_basis text,
  source_status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
begin
  if stock.current_profile_id() is null then
    raise exception 'Profil actif requis pour consulter les prix Achats';
  end if;

  return query
  select distinct on (c.article_id)
    c.article_id, c.classification, c.actual_unit_price_source,
    c.source_unit_id, c.normalized_unit_price, c.normalized_unit_id,
    c.conversion_factor, c.effective_date, c.supplier_id, c.source_type,
    c.source_id, c.source_line_id, c.tax_treatment, c.vat_rate,
    c.price_basis, c.source_status
  from stock.purchase_actual_price_candidates c
  where c.article_id = any(p_article_ids)
    and c.classification = 'normal'
  order by c.article_id, c.effective_date desc, c.source_line_id desc;
end;
$$;

alter table stock.purchase_price_qualifications enable row level security;
alter table stock.purchase_price_qualification_history enable row level security;

drop policy if exists purchase_price_qualifications_active_read
  on stock.purchase_price_qualifications;
create policy purchase_price_qualifications_active_read
on stock.purchase_price_qualifications for select to authenticated
using (exists (
  select 1 from stock.profiles p
  where p.id = stock.current_profile_id() and p.status = 'active'
));

drop policy if exists purchase_price_qualification_history_direction_read
  on stock.purchase_price_qualification_history;
create policy purchase_price_qualification_history_direction_read
on stock.purchase_price_qualification_history for select to authenticated
using (stock.is_current_user_direction());

revoke all on stock.purchase_price_qualifications from public, anon, authenticated;
grant select on stock.purchase_price_qualifications to authenticated;
revoke all on stock.purchase_price_qualification_history from public, anon, authenticated;
grant select on stock.purchase_price_qualification_history to authenticated;
revoke all on stock.purchase_actual_price_candidates from public, anon, authenticated;

revoke all on function stock.record_purchase_price_qualification_history() from public, anon, authenticated;
revoke all on function stock.qualify_purchase_price(text, uuid, text, text) from public, anon, authenticated;
grant execute on function stock.qualify_purchase_price(text, uuid, text, text) to authenticated;
revoke all on function stock.get_last_normal_actual_purchase_price(uuid) from public, anon, authenticated;
grant execute on function stock.get_last_normal_actual_purchase_price(uuid) to authenticated;
revoke all on function stock.get_last_normal_actual_purchase_prices(uuid[]) from public, anon, authenticated;
grant execute on function stock.get_last_normal_actual_purchase_prices(uuid[]) to authenticated;
