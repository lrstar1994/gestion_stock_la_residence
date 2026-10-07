-- INT-1 step 2 / OP-2 boundary helpers. LOCAL HOLD ONLY.
-- Reads the published immutable OP-2 snapshot contract. No RES-2 writer,
-- physical STOCK lock, purchase write, activation, or application grant.

do $$
begin
  if current_user <> 'postgres' or not exists (
    select 1 from pg_roles where rolname=current_user and rolbypassrls
  ) then
    raise exception 'INT-1 step 2 requires the existing postgres owner with BYPASSRLS';
  end if;
  if to_regprocedure('stock._int1_fail(text)') is null
     or to_regclass('stock.op_reservation_integration_control') is null
     or to_regclass('stock.production_order_calculation_runs') is null
     or to_regclass('stock.production_order_contributions') is null
     or to_regclass('stock.production_order_contribution_snapshots') is null
     or to_regclass('stock.recipe_stock_output_mappings') is null
     or to_regprocedure('stock.resolve_op_stock_need(uuid,uuid,bigint,text)') is null
     or to_regprocedure('stock.list_op_stock_needs(uuid,bigint)') is null then
    raise exception 'INT-1 step 2 requires INT-1 step 1 and OP-2 read contract';
  end if;
end $$;

create function stock._int1_resolve_published_op_stock_need(
  p_op_id uuid,
  p_revision_id uuid,
  p_op_change_sequence bigint,
  p_production_order_line_id uuid,
  p_usage_key text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,stock
as $$
declare
  v_revision_op_id uuid;
  v_run_id uuid;
  v_run_status text;
  v_op2 jsonb;
  v_row record;
begin
  if p_op_id is null or p_revision_id is null or p_op_change_sequence is null
     or p_op_change_sequence<=0 or p_production_order_line_id is null
     or p_usage_key is null or btrim(p_usage_key)='' then
    perform stock._int1_fail('OP_RESERVATION_INPUT_INVALID');
  end if;

  if not exists(select 1 from stock.production_orders o where o.id=p_op_id) then
    perform stock._int1_fail('OP_RESERVATION_OP_NOT_FOUND');
  end if;
  select r.production_order_id into v_revision_op_id
    from stock.production_order_revisions r where r.id=p_revision_id;
  if not found then perform stock._int1_fail('OP_RESERVATION_REVISION_NOT_FOUND'); end if;
  if v_revision_op_id is distinct from p_op_id then
    perform stock._int1_fail('OP_RESERVATION_SNAPSHOT_MISMATCH');
  end if;
  if not exists (
    select 1 from stock.production_order_revision_changes c
     where c.revision_id=p_revision_id and c.change_sequence=p_op_change_sequence
  ) then
    perform stock._int1_fail('OP_RESERVATION_CHANGE_SEQUENCE_NOT_FOUND');
  end if;

  select r.calculation_run_id,r.run_status into v_run_id,v_run_status
    from stock.production_order_calculation_runs r
   where r.production_order_id=p_op_id and r.revision_id=p_revision_id
     and r.change_sequence=p_op_change_sequence;
  if not found then perform stock._int1_fail('OP_RESERVATION_RUN_NOT_PUBLISHED'); end if;
  if v_run_status is distinct from 'published' then
    perform stock._int1_fail('OP_RESERVATION_RUN_NOT_PUBLISHED');
  end if;

  begin
    v_op2:=stock.resolve_op_stock_need(
      p_production_order_line_id,p_revision_id,p_op_change_sequence,p_usage_key);
  exception when others then
    if sqlerrm='OP2_CANONICAL_SNAPSHOT_NOT_FOUND' then
      perform stock._int1_fail('OP_RESERVATION_SNAPSHOT_NOT_FOUND');
    elsif sqlerrm='OP2_CANONICAL_NEED_NOT_RESOLVED' then
      perform stock._int1_fail('OP_RESERVATION_SNAPSHOT_UNRESOLVED');
    else
      raise;
    end if;
  end;

  select s.contribution_snapshot_id,s.contribution_id,s.calculation_run_id,
         s.production_order_line_id,s.production_order_revision_line_id,
         s.revision_id,s.change_sequence,s.usage_key,s.recipe_id,s.mapping_source_id,
         s.resource_type,s.resource_id,s.canonical_unit_id,s.target_quantity,
         s.source_fingerprint,c.production_order_id,c.calculation_run_id as contribution_run_id,c.resolution_status,
         c.resolution_code,c.mapping_source_id as contribution_mapping_source_id,
         c.resource_type as contribution_resource_type,c.resource_id as contribution_resource_id,
         c.canonical_unit_id as contribution_unit_id,c.target_quantity as contribution_target,
         c.production_order_line_id as contribution_order_line_id,
         c.production_order_revision_line_id as contribution_revision_line_id,
         c.revision_id as contribution_revision_id,c.change_sequence as contribution_sequence,
         c.usage_key as contribution_usage_key,
         rl.revision_id as line_revision_id,rl.production_order_line_id as line_order_line_id,
         rl.recipe_id as line_recipe_id,ol.production_order_id as line_order_op_id,
         m.mapping_source_id as existing_mapping_source_id,m.recipe_id as mapping_recipe_id,
         m.usage_key as mapping_usage_key,m.article_id as mapping_article_id,
         m.canonical_unit_id as mapping_unit_id,m.source_unit_id as mapping_source_unit_id,
         m.mapping_conversion_factor,a.unit_id as article_unit_id,r.run_status as joined_run_status
    into v_row
    from stock.production_order_contribution_snapshots s
    join stock.production_order_contributions c on c.contribution_id=s.contribution_id
    join stock.production_order_calculation_runs r on r.calculation_run_id=s.calculation_run_id
    join stock.production_order_revision_lines rl on rl.id=s.production_order_revision_line_id
    join stock.production_order_lines ol on ol.id=s.production_order_line_id
    left join stock.recipe_stock_output_mappings m on m.mapping_source_id=s.mapping_source_id
    left join stock.articles a on a.id=s.resource_id
   where s.contribution_snapshot_id=(v_op2->>'contribution_snapshot_id')::uuid;

  if not found then perform stock._int1_fail('OP_RESERVATION_SNAPSHOT_NOT_FOUND'); end if;

  if v_row.joined_run_status is distinct from 'published'
     or v_row.calculation_run_id is distinct from v_run_id
     or v_row.contribution_run_id is distinct from v_run_id
     or v_row.production_order_id is distinct from p_op_id
     or v_row.revision_id is distinct from p_revision_id
     or v_row.change_sequence is distinct from p_op_change_sequence
     or v_row.production_order_line_id is distinct from p_production_order_line_id
     or v_row.usage_key is distinct from p_usage_key
     or v_row.contribution_id is distinct from (v_op2->>'contribution_id')::uuid
     or v_row.production_order_revision_line_id is distinct from (v_op2->>'production_order_revision_line_id')::uuid
     or v_row.contribution_order_line_id is distinct from v_row.production_order_line_id
     or v_row.contribution_revision_line_id is distinct from v_row.production_order_revision_line_id
     or v_row.contribution_revision_id is distinct from p_revision_id
     or v_row.contribution_sequence is distinct from p_op_change_sequence
     or v_row.contribution_usage_key is distinct from v_row.usage_key
     or v_row.line_revision_id is distinct from p_revision_id
     or v_row.line_order_line_id is distinct from p_production_order_line_id
     or v_row.line_recipe_id is distinct from v_row.recipe_id
     or v_row.line_order_op_id is distinct from p_op_id
     or v_row.production_order_id is distinct from v_revision_op_id
     or v_row.mapping_source_id is distinct from v_row.contribution_mapping_source_id
     or v_row.resource_id is distinct from v_row.contribution_resource_id
     or v_row.canonical_unit_id is distinct from v_row.contribution_unit_id
     or v_row.target_quantity is distinct from v_row.contribution_target then
    perform stock._int1_fail('OP_RESERVATION_SNAPSHOT_MISMATCH');
  end if;

  if v_row.resolution_status is distinct from 'resolved' then
    perform stock._int1_fail('OP_RESERVATION_SNAPSHOT_UNRESOLVED');
  end if;
  if v_row.resource_type is distinct from 'article'
     or v_row.contribution_resource_type is distinct from 'article' then
    perform stock._int1_fail('OP_RESERVATION_RESOURCE_TYPE_UNSUPPORTED');
  end if;
  if v_row.resource_id is null or v_row.canonical_unit_id is null
     or v_row.target_quantity is null or v_row.target_quantity<=0
     or v_row.target_quantity>='Infinity'::numeric then
    perform stock._int1_fail('OP_RESERVATION_SNAPSHOT_UNRESOLVED');
  end if;
  if v_row.article_unit_id is null or v_row.article_unit_id is distinct from v_row.canonical_unit_id then
    perform stock._int1_fail('OP_RESERVATION_CANONICAL_UNIT_MISMATCH');
  end if;
  if v_row.existing_mapping_source_id is null
     or v_row.mapping_recipe_id is distinct from v_row.recipe_id
     or v_row.mapping_usage_key is distinct from v_row.usage_key
     or v_row.mapping_article_id is distinct from v_row.resource_id
     or v_row.mapping_unit_id is distinct from v_row.canonical_unit_id
     or v_row.mapping_source_unit_id is null
     or v_row.mapping_conversion_factor is null
     or v_row.mapping_conversion_factor<=0 then
    perform stock._int1_fail('OP_RESERVATION_SNAPSHOT_MISMATCH');
  end if;

  return jsonb_build_object(
    'published_run_id',v_run_id,
    'contribution_id',v_row.contribution_id,
    'contribution_snapshot_id',v_row.contribution_snapshot_id,
    'production_order_id',p_op_id,
    'production_order_line_id',v_row.production_order_line_id,
    'production_order_revision_line_id',v_row.production_order_revision_line_id,
    'usage_key',v_row.usage_key,
    'resource_type',v_row.resource_type,
    'resource_id',v_row.resource_id,
    'canonical_unit_id',v_row.canonical_unit_id,
    'target_quantity',v_row.target_quantity,
    'mapping_source_id',v_row.mapping_source_id,
    'revision_id',v_row.revision_id,
    'op_change_sequence',v_row.change_sequence,
    'source_fingerprint',v_row.source_fingerprint
  );
end $$;

create function stock._int1_list_published_op_stock_needs(
  p_op_id uuid,
  p_revision_id uuid,
  p_op_change_sequence bigint,
  p_scope_contribution_snapshot_ids uuid[] default null
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,stock
as $$
declare
  v_revision_op_id uuid;
  v_run_id uuid;
  v_run_status text;
  v_op2 jsonb;
  v_ids uuid[];
  v_id uuid;
  v_identity record;
  v_needs jsonb:='[]'::jsonb;
begin
  if p_op_id is null or p_revision_id is null or p_op_change_sequence is null
     or p_op_change_sequence<=0 then
    perform stock._int1_fail('OP_RESERVATION_INPUT_INVALID');
  end if;
  if not exists(select 1 from stock.production_orders o where o.id=p_op_id) then
    perform stock._int1_fail('OP_RESERVATION_OP_NOT_FOUND');
  end if;
  select r.production_order_id into v_revision_op_id
    from stock.production_order_revisions r where r.id=p_revision_id;
  if not found then perform stock._int1_fail('OP_RESERVATION_REVISION_NOT_FOUND'); end if;
  if v_revision_op_id is distinct from p_op_id then
    perform stock._int1_fail('OP_RESERVATION_SCOPE_MISMATCH');
  end if;
  if not exists(select 1 from stock.production_order_revision_changes c
    where c.revision_id=p_revision_id and c.change_sequence=p_op_change_sequence) then
    perform stock._int1_fail('OP_RESERVATION_CHANGE_SEQUENCE_NOT_FOUND');
  end if;
  select r.calculation_run_id,r.run_status into v_run_id,v_run_status
    from stock.production_order_calculation_runs r
   where r.production_order_id=p_op_id and r.revision_id=p_revision_id
     and r.change_sequence=p_op_change_sequence;
  if not found or v_run_status is distinct from 'published' then
    perform stock._int1_fail('OP_RESERVATION_RUN_NOT_PUBLISHED');
  end if;

  v_op2:=stock.list_op_stock_needs(p_revision_id,p_op_change_sequence);
  if v_op2 is null or v_op2->>'run_status' is distinct from 'published'
     or (v_op2->>'calculation_run_id')::uuid is distinct from v_run_id then
    perform stock._int1_fail('OP_RESERVATION_RUN_NOT_PUBLISHED');
  end if;

  if p_scope_contribution_snapshot_ids is null then
    select coalesce(array_agg((n->>'contribution_snapshot_id')::uuid),array[]::uuid[])
      into v_ids from jsonb_array_elements(coalesce(v_op2->'needs','[]'::jsonb)) n;
  else
    if cardinality(p_scope_contribution_snapshot_ids)=0
       or cardinality(p_scope_contribution_snapshot_ids) <>
          (select count(distinct x) from unnest(p_scope_contribution_snapshot_ids) x) then
      perform stock._int1_fail('OP_RESERVATION_SCOPE_MISMATCH');
    end if;
    select coalesce(array_agg(s.contribution_snapshot_id order by s.contribution_snapshot_id),array[]::uuid[])
      into v_ids
      from stock.production_order_contribution_snapshots s
     where s.contribution_snapshot_id=any(p_scope_contribution_snapshot_ids)
       and s.calculation_run_id=v_run_id;
    if cardinality(v_ids)<>cardinality(p_scope_contribution_snapshot_ids) then
      perform stock._int1_fail('OP_RESERVATION_SCOPE_MISMATCH');
    end if;
  end if;

  foreach v_id in array v_ids loop
    select s.production_order_line_id,s.usage_key into v_identity
      from stock.production_order_contribution_snapshots s
     where s.contribution_snapshot_id=v_id and s.calculation_run_id=v_run_id;
    if not found then perform stock._int1_fail('OP_RESERVATION_SCOPE_MISMATCH'); end if;
    v_needs:=v_needs||jsonb_build_array(stock._int1_resolve_published_op_stock_need(
      p_op_id,p_revision_id,p_op_change_sequence,v_identity.production_order_line_id,v_identity.usage_key));
  end loop;

  return jsonb_build_object(
    'production_order_id',p_op_id,
    'revision_id',p_revision_id,
    'op_change_sequence',p_op_change_sequence,
    'published_run_id',v_run_id,
    'needs',v_needs
  );
end $$;

create function stock._int1_resolve_op_stock_need(
  p_op_id uuid,
  p_revision_id uuid,
  p_op_change_sequence bigint,
  p_production_order_line_id uuid,
  p_usage_key text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,stock
as $$
declare v_result jsonb;
begin
  v_result:=stock._int1_list_published_op_stock_needs(
    p_op_id,p_revision_id,p_op_change_sequence,null);
  return stock._int1_resolve_published_op_stock_need(
    p_op_id,p_revision_id,p_op_change_sequence,p_production_order_line_id,p_usage_key);
end $$;

revoke all on function stock._int1_resolve_published_op_stock_need(uuid,uuid,bigint,uuid,text)
  from public,anon,authenticated;
revoke all on function stock._int1_list_published_op_stock_needs(uuid,uuid,bigint,uuid[])
  from public,anon,authenticated;
revoke all on function stock._int1_resolve_op_stock_need(uuid,uuid,bigint,uuid,text)
  from public,anon,authenticated;

comment on function stock._int1_resolve_published_op_stock_need(uuid,uuid,bigint,uuid,text) is
  'Private INT-1 boundary validator. Resolves through OP-2 then verifies every identity and returns only immutable snapshot values.';
comment on function stock._int1_list_published_op_stock_needs(uuid,uuid,bigint,uuid[]) is
  'Private INT-1 OP-2 reader. Uses list_op_stock_needs for selection, optional snapshot-ID scope, and final per-snapshot validation.';
comment on function stock._int1_resolve_op_stock_need(uuid,uuid,bigint,uuid,text) is
  'Private targeted INT-1 wrapper for one canonical production-order usage.';
