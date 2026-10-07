-- Disposable PostgreSQL fixture for INT-1 internal tests only.
-- It reproduces only the OP-1 relation shapes referenced by INT-1.
-- It does not provide or claim an OP -> ARTICLE mapping.
create table stock.production_orders(
  id uuid primary key,
  status text not null default 'draft'
);
create table stock.production_order_lines(
  id uuid primary key,
  production_order_id uuid not null references stock.production_orders(id),
  line_number integer not null
);
create table stock.production_order_revisions(
  id uuid primary key,
  production_order_id uuid not null references stock.production_orders(id),
  revision_number integer not null,
  status text not null default 'draft'
);
create table stock.production_order_revision_lines(
  id uuid primary key,
  revision_id uuid not null references stock.production_order_revisions(id),
  production_order_line_id uuid not null references stock.production_order_lines(id),
  recipe_id uuid not null,
  quantity numeric(14,4) not null,
  coefficient numeric(14,6) not null default 1
);
create table stock.production_order_revision_changes(
  id uuid primary key,
  revision_id uuid not null references stock.production_order_revisions(id),
  change_sequence bigint not null,
  request_id uuid
);
create table stock.production_order_number_counters(op_year integer primary key,last_number integer not null);
create table stock.purchase_needs(id uuid primary key);

-- Minimal OP-2 contract shapes required by the INT-1 step-1 schema migration.
-- These are disposable test doubles; the canonical definitions remain owned by
-- FT/OP migration 202610020005_production_order_stock_contributions.sql.
create table stock.production_order_calculation_runs(
  calculation_run_id uuid primary key,
  production_order_id uuid not null references stock.production_orders(id),
  revision_id uuid not null references stock.production_order_revisions(id),
  change_sequence bigint not null,
  run_status text not null,
  result_status text not null default 'resolved',
  unique(calculation_run_id,production_order_id,revision_id,change_sequence)
);
create table stock.recipe_stock_output_mappings(
  mapping_source_id uuid primary key,
  recipe_id uuid not null,
  usage_key text not null,
  article_id uuid not null references stock.articles(id),
  canonical_unit_id uuid not null references stock.units(id),
  source_unit_id uuid not null references stock.units(id),
  mapping_conversion_factor numeric(18,8) not null,
  is_current boolean not null default true
);
create table stock.production_order_contributions(
  contribution_id uuid primary key,
  calculation_run_id uuid not null references stock.production_order_calculation_runs(calculation_run_id),
  production_order_id uuid not null references stock.production_orders(id),
  revision_id uuid not null references stock.production_order_revisions(id),
  change_sequence bigint not null,
  production_order_line_id uuid not null references stock.production_order_lines(id),
  production_order_revision_line_id uuid not null references stock.production_order_revision_lines(id),
  usage_key text not null,
  recipe_id uuid not null,
  mapping_source_id uuid references stock.recipe_stock_output_mappings(mapping_source_id),
  resource_type text not null,
  resource_id uuid references stock.articles(id),
  canonical_unit_id uuid references stock.units(id),
  target_quantity numeric(14,4),
  resolution_status text not null default 'resolved',
  resolution_code text not null default 'RESOLVED'
);
create table stock.production_order_contribution_snapshots(
  contribution_snapshot_id uuid primary key,
  contribution_id uuid not null references stock.production_order_contributions(contribution_id),
  calculation_run_id uuid not null references stock.production_order_calculation_runs(calculation_run_id),
  production_order_line_id uuid not null references stock.production_order_lines(id),
  production_order_revision_line_id uuid not null references stock.production_order_revision_lines(id),
  revision_id uuid not null references stock.production_order_revisions(id),
  change_sequence bigint not null,
  usage_key text not null,
  recipe_id uuid not null,
  mapping_source_id uuid references stock.recipe_stock_output_mappings(mapping_source_id),
  resource_type text not null,
  resource_id uuid references stock.articles(id),
  canonical_unit_id uuid references stock.units(id),
  target_quantity numeric(14,4),
  source_fingerprint text not null default repeat('a',64)
);

create function stock.resolve_op_stock_need(p_production_order_line_id uuid,p_revision_id uuid,
  p_change_sequence bigint,p_usage_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,stock as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'contribution_snapshot_id',s.contribution_snapshot_id,'contribution_id',s.contribution_id,
    'calculation_run_id',s.calculation_run_id,'production_order_line_id',s.production_order_line_id,
    'production_order_revision_line_id',s.production_order_revision_line_id,
    'revision_id',s.revision_id,'change_sequence',s.change_sequence,'usage_key',s.usage_key,
    'resource_type',s.resource_type,'resource_id',s.resource_id,
    'canonical_unit_id',s.canonical_unit_id,'target_quantity',s.target_quantity,
    'source_fingerprint',s.source_fingerprint,'mapping_source_id',s.mapping_source_id)
    into v from stock.production_order_contribution_snapshots s
    join stock.production_order_calculation_runs r on r.calculation_run_id=s.calculation_run_id
    join stock.production_order_contributions c on c.contribution_id=s.contribution_id
   where s.production_order_line_id=p_production_order_line_id and s.revision_id=p_revision_id
     and s.change_sequence=p_change_sequence and s.usage_key=p_usage_key
     and r.run_status='published' and c.resolution_status='resolved';
  if v is null then
    if exists(select 1 from stock.production_order_contribution_snapshots s
       where s.production_order_line_id=p_production_order_line_id and s.revision_id=p_revision_id
         and s.change_sequence=p_change_sequence and s.usage_key=p_usage_key) then
      raise exception 'OP2_CANONICAL_NEED_NOT_RESOLVED';
    end if;
    raise exception 'OP2_CANONICAL_SNAPSHOT_NOT_FOUND';
  end if;
  return v;
end $$;

create function stock.list_op_stock_needs(p_revision_id uuid,p_change_sequence bigint)
returns jsonb language sql security definer stable set search_path=pg_catalog,stock as $$
  select jsonb_build_object(
    'revision_id',p_revision_id,'change_sequence',p_change_sequence,
    'run_status',r.run_status,'result_status',r.result_status,
    'calculation_run_id',r.calculation_run_id,
    'needs',coalesce((select jsonb_agg(jsonb_build_object(
      'contribution_snapshot_id',s.contribution_snapshot_id,
      'contribution_id',s.contribution_id,'production_order_line_id',s.production_order_line_id,
      'revision_id',s.revision_id,'change_sequence',s.change_sequence,'usage_key',s.usage_key,
      'resource_type',s.resource_type,'resource_id',s.resource_id,
      'canonical_unit_id',s.canonical_unit_id,'target_quantity',s.target_quantity,
      'mapping_source_id',s.mapping_source_id)
      order by s.production_order_line_id,s.usage_key)
      from stock.production_order_contribution_snapshots s
      join stock.production_order_contributions c on c.contribution_id=s.contribution_id
      where s.calculation_run_id=r.calculation_run_id and c.resolution_status='resolved'),'[]'::jsonb)
  ) from stock.production_order_calculation_runs r
  where r.revision_id=p_revision_id and r.change_sequence=p_change_sequence
    and r.run_status='published';
$$;

