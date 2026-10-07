\set ON_ERROR_STOP on
begin;
set local role postgres;

create temporary table int1_results(name text primary key,passed boolean not null,detail text not null);
create function pg_temp.int1_expect_error(p_sql text,p_expected text) returns boolean
language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return sqlerrm=p_expected;
end $$;

insert into int1_results
select 'table:'||v.name,to_regclass('stock.'||v.name) is not null,
 case when to_regclass('stock.'||v.name) is not null then 'present' else 'missing' end
from (values ('op_reservation_integration_control'),('op_reservation_operations'),
 ('op_reservation_bindings'),('op_reservation_operation_items'),('op_reservation_allocations')) v(name);

insert into int1_results
select 'rls:'||v.name,c.relrowsecurity and c.relforcerowsecurity,
 c.relrowsecurity||'/'||c.relforcerowsecurity
from (values ('op_reservation_integration_control'),('op_reservation_operations'),
 ('op_reservation_bindings'),('op_reservation_operation_items'),('op_reservation_allocations')) v(name)
join pg_class c on c.relname=v.name and c.relnamespace=(select oid from pg_namespace where nspname='stock');

insert into int1_results
select 'acl:'||r.rolname||':'||v.name,
 not has_table_privilege(r.rolname,'stock.'||v.name,'SELECT,INSERT,UPDATE,DELETE'), 'no direct table access'
from (values('anon'),('authenticated')) r(rolname)
cross join (values ('op_reservation_integration_control'),('op_reservation_operations'),
 ('op_reservation_bindings'),('op_reservation_operation_items'),('op_reservation_allocations')) v(name);

insert into int1_results values('activation_disabled',
 (select activation_state='disabled' from stock.op_reservation_integration_control where integration_key='OP_STOCK_RESERVATION'),
 'singleton disabled');
insert into int1_results values('contract:2.0',
 (select contract_version='INT-1/2.0' from stock.op_reservation_integration_control where integration_key='OP_STOCK_RESERVATION'),
 'contract version prepared');
insert into int1_results values('schema:canonical_columns',
 (select count(*)=18 from information_schema.columns
   where table_schema='stock' and (
     (table_name='op_reservation_operations' and column_name in ('published_run_id','canonical_scope','contract_version','status'))
     or (table_name='op_reservation_bindings' and column_name in ('production_order_line_id','contribution_id','contribution_snapshot_id','published_run_id'))
     or (table_name='op_reservation_operation_items' and column_name in ('production_order_line_id','usage_key','contribution_id','contribution_snapshot_id','resource_id','unit_id'))
     or (table_name='op_reservation_allocations' and column_name in ('production_order_line_id','usage_key','contribution_id','contribution_snapshot_id'))
   )), '18 canonical columns');
insert into int1_results values('schema:obsolete_and_physical_columns_absent',
 not exists(select 1 from information_schema.columns where table_schema='stock' and table_name='op_reservation_bindings' and column_name in ('source_kind','source_id'))
 and not exists(select 1 from information_schema.columns where table_schema='stock' and table_name like 'op_reservation_%' and column_name in ('physical_reserved','delivered_quantity','approved_shortage')),
 'legacy source and duplicated physical columns absent');
insert into int1_results values('schema:op2_foreign_keys',
 (select count(*)=10 from pg_constraint where connamespace='stock'::regnamespace and contype='f'
   and conname in (
    'op_reservation_operations_published_run_fk','op_reservation_bindings_order_line_fk',
    'op_reservation_bindings_contribution_fk','op_reservation_bindings_snapshot_fk',
    'op_reservation_bindings_published_run_fk','op_reservation_operation_items_order_line_fk',
    'op_reservation_operation_items_contribution_fk','op_reservation_operation_items_snapshot_fk',
    'op_reservation_allocations_contribution_fk','op_reservation_allocations_snapshot_fk')),
 'OP-2 foreign keys present');
insert into int1_results values('schema:canonical_indexes',
 (select count(*)=7 from pg_indexes where schemaname='stock' and indexname in (
   'op_reservation_bindings_current_line_usage_idx','op_reservation_bindings_contribution_idx',
   'op_reservation_bindings_snapshot_idx','op_reservation_operations_published_run_idx',
   'op_reservation_operation_items_contribution_idx','op_reservation_operation_items_snapshot_idx',
   'op_reservation_allocations_snapshot_idx')), 'canonical indexes present');
insert into int1_results values('schema:analytical_categories_only',
 (select pg_get_constraintdef(oid) like '%approved%pending_increase%chef_hold%'
      and pg_get_constraintdef(oid) not like '%mixed%'
    from pg_constraint
   where conrelid='stock.op_reservation_allocations'::regclass
     and conname='op_reservation_allocations_category_check'),
 'approved/pending_increase/chef_hold only');
insert into int1_results values('bulk_no_authenticated_execute',
 not has_function_privilege('authenticated','stock.apply_op_reservation_operation(uuid,uuid,uuid,bigint,text,jsonb)','EXECUTE'),
 'authenticated has no execute');
insert into int1_results values('bulk_no_anon_execute',
 not has_function_privilege('anon','stock.apply_op_reservation_operation(uuid,uuid,uuid,bigint,text,jsonb)','EXECUTE'),
 'anon has no execute');
insert into int1_results values('physical_id:schema_split_and_constraint',
 (select count(*)=3 from information_schema.columns
   where table_schema='stock' and table_name='op_reservation_operation_items'
     and column_name in ('prepared_item_id','prepared_parent_item_id','child_request_id'))
 and (select is_nullable='YES' from information_schema.columns where table_schema='stock'
   and table_name='op_reservation_operation_items' and column_name='child_request_id')
 and exists(select 1 from pg_constraint where conrelid='stock.op_reservation_operation_items'::regclass
   and conname='op_reservation_operation_items_identity_split_check'),
 'prepared identity, physical parent pointer and nullable physical request column are distinct');
insert into int1_results values('child_helper_no_authenticated_execute',
 not has_function_privilege('authenticated','stock._int1_prepared_item_id(uuid,uuid,text,uuid,uuid,uuid)','EXECUTE')
 and not has_function_privilege('authenticated','stock._int1_physical_effect_request_id(uuid,uuid,text,jsonb)','EXECUTE'),
 'authenticated has no execute on prepared/effect identity helpers');

insert into stock.production_orders values('81000000-0000-0000-0000-000000000001','draft');
insert into stock.production_order_lines values('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001',1);
insert into stock.production_order_revisions values('83000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001',1,'draft');
insert into stock.production_order_revision_lines values(
 '82100000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',
 '82000000-0000-0000-0000-000000000001','82200000-0000-0000-0000-000000000001',15,1);
insert into stock.production_order_lines values(
 '82000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000001',2);
insert into stock.production_order_revision_lines values(
 '82100000-0000-0000-0000-000000000002','83000000-0000-0000-0000-000000000001',
 '82000000-0000-0000-0000-000000000002','82200000-0000-0000-0000-000000000001',1,1);
insert into stock.production_order_revision_changes values(
 '82300000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,null);
insert into stock.production_order_calculation_runs(calculation_run_id,production_order_id,revision_id,change_sequence,run_status,result_status) values(
 '82400000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001',
 '83000000-0000-0000-0000-000000000001',1,'published','resolved');
insert into stock.recipe_stock_output_mappings values(
 '82700000-0000-0000-0000-000000000001','82200000-0000-0000-0000-000000000001','main',
 '30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000001',1,false);
insert into stock.production_order_contributions(
 contribution_id,calculation_run_id,production_order_id,revision_id,change_sequence,
 production_order_line_id,production_order_revision_line_id,usage_key,recipe_id,mapping_source_id,
 resource_type,resource_id,canonical_unit_id,target_quantity,resolution_status,resolution_code) values(
 '82500000-0000-0000-0000-000000000001','82400000-0000-0000-0000-000000000001',
 '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
 '82000000-0000-0000-0000-000000000001','82100000-0000-0000-0000-000000000001','main',
 '82200000-0000-0000-0000-000000000001','82700000-0000-0000-0000-000000000001',
 'article','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',15,'resolved','RESOLVED');
insert into stock.production_order_contributions(
 contribution_id,calculation_run_id,production_order_id,revision_id,change_sequence,
 production_order_line_id,production_order_revision_line_id,usage_key,recipe_id,mapping_source_id,
 resource_type,resource_id,canonical_unit_id,target_quantity,resolution_status,resolution_code) values(
 '82500000-0000-0000-0000-000000000002','82400000-0000-0000-0000-000000000001',
 '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
 '82000000-0000-0000-0000-000000000002','82100000-0000-0000-0000-000000000002','main',
 '82200000-0000-0000-0000-000000000001','82700000-0000-0000-0000-000000000001',
 'article','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'resolved','RESOLVED');
insert into stock.production_order_contribution_snapshots(
 contribution_snapshot_id,contribution_id,calculation_run_id,production_order_line_id,
 production_order_revision_line_id,revision_id,change_sequence,usage_key,recipe_id,mapping_source_id,
 resource_type,resource_id,canonical_unit_id,target_quantity,source_fingerprint) values(
 '82600000-0000-0000-0000-000000000001','82500000-0000-0000-0000-000000000001',
 '82400000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001',
 '82100000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,'main',
 '82200000-0000-0000-0000-000000000001','82700000-0000-0000-0000-000000000001',
 'article','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',15,repeat('a',64));

insert into int1_results values('boundary:single_published_snapshot',
 (stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')->>'contribution_snapshot_id')='82600000-0000-0000-0000-000000000001',
 'canonical snapshot resolved');
insert into int1_results values('boundary:canonical_fields',
 (select (n->>'published_run_id')='82400000-0000-0000-0000-000000000001'
     and (n->>'resource_id')='30000000-0000-0000-0000-000000000001'
     and (n->>'canonical_unit_id')='10000000-0000-0000-0000-000000000001'
     and (n->>'target_quantity')::numeric=15
     and (n->>'mapping_source_id')='82700000-0000-0000-0000-000000000001'
   from jsonb_array_elements(stock._int1_list_published_op_stock_needs(
     '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1)->'needs') n),
 'all canonical values returned from OP-2 snapshot');
insert into int1_results values('boundary:valid_scope',
 jsonb_array_length(stock._int1_list_published_op_stock_needs(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   array['82600000-0000-0000-0000-000000000001']::uuid[])->'needs')=1,'one selected snapshot');
insert into int1_results values('boundary:foreign_scope_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_list_published_op_stock_needs(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   array['99900000-0000-0000-0000-000000000001']::uuid[])$q$,'OP_RESERVATION_SCOPE_MISMATCH'),
 'foreign snapshot id rejected');
insert into int1_results values('boundary:wrong_op_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '99900000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_OP_NOT_FOUND'), 'unknown OP rejected');
insert into int1_results values('boundary:wrong_revision_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','99900000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_REVISION_NOT_FOUND'), 'unknown revision rejected');
insert into int1_results values('boundary:wrong_sequence_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',2,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_CHANGE_SEQUENCE_NOT_FOUND'), 'unrecorded sequence rejected');
insert into int1_results values('boundary:snapshot_absent_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','absent')$q$,'OP_RESERVATION_SNAPSHOT_NOT_FOUND'), 'missing snapshot rejected');
insert into int1_results values('boundary:wrong_line_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '99900000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_SNAPSHOT_NOT_FOUND'), 'foreign line rejected');
insert into int1_results values('boundary:wrong_usage_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','other')$q$,'OP_RESERVATION_SNAPSHOT_NOT_FOUND'), 'foreign usage rejected');
update stock.production_order_contribution_snapshots set production_order_line_id='82000000-0000-0000-0000-000000000002'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:snapshot_line_mismatch_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_list_published_op_stock_needs(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   array['82600000-0000-0000-0000-000000000001']::uuid[])$q$,'OP_RESERVATION_SNAPSHOT_MISMATCH'),
 'snapshot line does not match OP-2 revision line');
update stock.production_order_contribution_snapshots set production_order_line_id='82000000-0000-0000-0000-000000000001'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set usage_key='other-usage'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:snapshot_usage_mismatch_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_list_published_op_stock_needs(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   array['82600000-0000-0000-0000-000000000001']::uuid[])$q$,'OP_RESERVATION_SNAPSHOT_MISMATCH'),
 'snapshot usage does not match contribution');
update stock.production_order_contribution_snapshots set usage_key='main'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set contribution_id='82500000-0000-0000-0000-000000000002'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:other_contribution_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_list_published_op_stock_needs(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   array['82600000-0000-0000-0000-000000000001']::uuid[])$q$,'OP_RESERVATION_SNAPSHOT_MISMATCH'),
 'snapshot cannot be rebound to another contribution');
update stock.production_order_contribution_snapshots set contribution_id='82500000-0000-0000-0000-000000000001'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:historical_mapping_allowed',
 (select not is_current from stock.recipe_stock_output_mappings
   where mapping_source_id='82700000-0000-0000-0000-000000000001')
 and (stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')->>'resource_id')='30000000-0000-0000-0000-000000000001',
 'retired mapping remains valid for immutable historical snapshot');
insert into int1_results values('boundary:helpers_not_app_callable',
 not has_function_privilege('authenticated','stock._int1_list_published_op_stock_needs(uuid,uuid,bigint,uuid[])','EXECUTE')
 and not has_function_privilege('anon','stock._int1_resolve_op_stock_need(uuid,uuid,bigint,uuid,text)','EXECUTE'),
 'internal helpers revoked');

update stock.production_order_calculation_runs set run_status='building'
 where calculation_run_id='82400000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:unpublished_run_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_RUN_NOT_PUBLISHED'), 'building run rejected');
update stock.production_order_calculation_runs set run_status='published'
 where calculation_run_id='82400000-0000-0000-0000-000000000001';

update stock.production_order_contributions set resolution_status='invalid'
 where contribution_id='82500000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:invalid_contribution_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_SNAPSHOT_UNRESOLVED'), 'invalid contribution rejected');
update stock.production_order_contributions set resolution_status='resolved'
 where contribution_id='82500000-0000-0000-0000-000000000001';
update stock.production_order_contributions set resolution_status='unresolved'
 where contribution_id='82500000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:unresolved_contribution_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_SNAPSHOT_UNRESOLVED'), 'unresolved contribution rejected');
update stock.production_order_contributions set resolution_status='resolved'
 where contribution_id='82500000-0000-0000-0000-000000000001';

update stock.production_order_contributions set resource_type='recipe'
 where contribution_id='82500000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set resource_type='recipe'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:recipe_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_RESOURCE_TYPE_UNSUPPORTED'), 'recipe refused');
update stock.production_order_contributions set resource_type='article'
 where contribution_id='82500000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set resource_type='article'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';

update stock.production_order_contributions set resource_id=null
 where contribution_id='82500000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set resource_id=null
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:missing_resource_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_SNAPSHOT_UNRESOLVED'), 'null resource refused');
update stock.production_order_contributions set resource_id='30000000-0000-0000-0000-000000000001'
 where contribution_id='82500000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set resource_id='30000000-0000-0000-0000-000000000001'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';

update stock.production_order_contributions set target_quantity=null
 where contribution_id='82500000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set target_quantity=null
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:unresolved_quantity_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_SNAPSHOT_UNRESOLVED'), 'null target refused');
update stock.production_order_contributions set target_quantity=15
 where contribution_id='82500000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set target_quantity=15
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';

insert into stock.units values('10000000-0000-0000-0000-000000000002','other unit');
update stock.recipe_stock_output_mappings set canonical_unit_id='10000000-0000-0000-0000-000000000002'
 where mapping_source_id='82700000-0000-0000-0000-000000000001';
update stock.production_order_contributions set canonical_unit_id='10000000-0000-0000-0000-000000000002'
 where contribution_id='82500000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set canonical_unit_id='10000000-0000-0000-0000-000000000002'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:canonical_unit_mismatch_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_CANONICAL_UNIT_MISMATCH'), 'article unit mismatch refused');
update stock.recipe_stock_output_mappings set canonical_unit_id='10000000-0000-0000-0000-000000000001'
 where mapping_source_id='82700000-0000-0000-0000-000000000001';
update stock.production_order_contributions set canonical_unit_id='10000000-0000-0000-0000-000000000001'
 where contribution_id='82500000-0000-0000-0000-000000000001';
update stock.production_order_contribution_snapshots set canonical_unit_id='10000000-0000-0000-0000-000000000001'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';

update stock.production_order_contribution_snapshots set mapping_source_id=null
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into int1_results values('boundary:mapping_mismatch_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_resolve_op_stock_need(
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   '82000000-0000-0000-0000-000000000001','main')$q$,'OP_RESERVATION_SNAPSHOT_MISMATCH'), 'snapshot mapping mismatch refused');
update stock.production_order_contribution_snapshots set mapping_source_id='82700000-0000-0000-0000-000000000001'
 where contribution_snapshot_id='82600000-0000-0000-0000-000000000001';
insert into stock.stock_reservations(id,op_id,revision_id,resource_type,resource_id,unit_id,target_quantity,reserved_quantity,last_target_change_sequence)
values('84000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',
 'article','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',10,10,2);
insert into stock.stock_reservation_segments(id,reservation_id,location_id,protected_quantity)
values('85000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',10);
insert into stock.op_reservation_bindings(id,production_order_line_id,usage_key,contribution_id,contribution_snapshot_id,published_run_id,op_id,reservation_id,resource_type,resource_id,unit_id,current_revision_id,current_op_change_sequence,current_reservation_change_sequence)
values('86000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','main',
 '82500000-0000-0000-0000-000000000001','82600000-0000-0000-0000-000000000001','82400000-0000-0000-0000-000000000001',
 '81000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000001','article','30000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,2);
insert into stock.op_reservation_operations(id,business_key,payload_hash,op_id,revision_id,op_change_sequence,operation_kind,actor_profile_id,result,published_run_id,canonical_scope)
values('87000000-0000-0000-0000-000000000001',stock._int1_business_key('81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,'revision_target_sync','{"contribution_snapshot_ids":["82600000-0000-0000-0000-000000000001"]}'),'hash-1',
 '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,'revision_target_sync','40000000-0000-0000-0000-000000000001','{}',
 '82400000-0000-0000-0000-000000000001','{"contribution_snapshot_ids":["82600000-0000-0000-0000-000000000001"]}');
insert into stock.op_reservation_operation_items(id,operation_id,binding_id,action_kind,revision_id,op_change_sequence,reservation_change_sequence,target_quantity,result,production_order_line_id,usage_key,contribution_id,contribution_snapshot_id,resource_id,unit_id)
values('88000000-0000-0000-0000-000000000001','87000000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000001',
 'no_change','83000000-0000-0000-0000-000000000001',1,null,15,
 '{"reservation_id":"84000000-0000-0000-0000-000000000001"}',
 '82000000-0000-0000-0000-000000000001','main','82500000-0000-0000-0000-000000000001',
 '82600000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into stock.op_reservation_allocations(id,binding_id,reservation_id,operation_item_id,revision_id,op_change_sequence,category,status,quantity,production_order_line_id,usage_key,contribution_id,contribution_snapshot_id)
values
 ('89000000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000001','88000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,'approved','active',10,'82000000-0000-0000-0000-000000000001','main','82500000-0000-0000-0000-000000000001','82600000-0000-0000-0000-000000000001'),
 ('89000000-0000-0000-0000-000000000002','86000000-0000-0000-0000-000000000001','84000000-0000-0000-0000-000000000001','88000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,'pending_increase','awaiting_chef_decision',5,'82000000-0000-0000-0000-000000000001','main','82500000-0000-0000-0000-000000000001','82600000-0000-0000-0000-000000000001');

insert into int1_results values('allocation:pending_is_analytical',
 (select category='pending_increase' and status='awaiting_chef_decision' and quantity=5 from stock.op_reservation_allocations where id='89000000-0000-0000-0000-000000000002'),'pending increase=5 analytical');
insert into int1_results values('physical:pending_no_reservation',
 (select reserved_quantity=10 and shortage_quantity=0 from stock.stock_reservations where id='84000000-0000-0000-0000-000000000001'),'RES-2 remains reserved=10');

update stock.op_reservation_allocations set category='chef_hold',status='active'
where id='89000000-0000-0000-0000-000000000002';
insert into int1_results values('allocation:chef_hold_reclassification',
 (select category='chef_hold' and status='active' and quantity=5 from stock.op_reservation_allocations where id='89000000-0000-0000-0000-000000000002'),'analytical only');
insert into int1_results values('physical:hold_no_double_reservation',
 (select reserved_quantity=10 from stock.stock_reservations where id='84000000-0000-0000-0000-000000000001'),'reserved unchanged');

do $$ begin
  insert into stock.op_reservation_bindings(production_order_line_id,usage_key,contribution_id,contribution_snapshot_id,published_run_id,op_id,reservation_id,resource_type,resource_id,unit_id,current_revision_id,current_op_change_sequence,current_reservation_change_sequence)
  select production_order_line_id,usage_key,contribution_id,contribution_snapshot_id,published_run_id,op_id,reservation_id,resource_type,resource_id,unit_id,current_revision_id,current_op_change_sequence,current_reservation_change_sequence
  from stock.op_reservation_bindings where id='86000000-0000-0000-0000-000000000001';
  raise exception 'expected unique violation missing';
exception when unique_violation then null; end $$;
insert into int1_results values('binding:one_current_source_usage',true,'23505 observed');

do $$ begin
  update stock.op_reservation_operations set payload_hash='changed' where id='87000000-0000-0000-0000-000000000001';
  raise exception 'expected append-only rejection missing';
exception when raise_exception then
  if sqlerrm<>'OP_RESERVATION_APPEND_ONLY' then raise; end if;
end $$;
insert into int1_results values('operations:append_only',true,'expected stable error');

insert into int1_results values('prepared_item:identity_deterministic',
 stock._int1_prepared_item_id('87000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','main','82500000-0000-0000-0000-000000000001','82600000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001')=
 stock._int1_prepared_item_id('87000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','main','82500000-0000-0000-0000-000000000001','82600000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),'same canonical prepared-item inputs return same UUID');

-- Step 3A journal tests use a second immutable OP-2 snapshot to prove set
-- normalization and payload binding to the resolved snapshot identities.
insert into stock.production_order_contribution_snapshots(
 contribution_snapshot_id,contribution_id,calculation_run_id,production_order_line_id,
 production_order_revision_line_id,revision_id,change_sequence,usage_key,recipe_id,mapping_source_id,
 resource_type,resource_id,canonical_unit_id,target_quantity)
values('82600000-0000-0000-0000-000000000002','82500000-0000-0000-0000-000000000002',
 '82400000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002',
 '82100000-0000-0000-0000-000000000002','83000000-0000-0000-0000-000000000001',1,'main',
 '82200000-0000-0000-0000-000000000001','82700000-0000-0000-0000-000000000001',
 'article','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1);

set local request.jwt.claim.sub='50000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','50000000-0000-0000-0000-000000000001',true);
insert into int1_results values('idempotency:scope_order_and_replay',
 (select stock._int1_prepare_operation(
    'a7000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',1,'revision_target_sync',
    array['82600000-0000-0000-0000-000000000001','82600000-0000-0000-0000-000000000002']::uuid[])
   =stock._int1_prepare_operation(
    'a7000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',1,'revision_target_sync',
    array['82600000-0000-0000-0000-000000000002','82600000-0000-0000-0000-000000000001']::uuid[])),
 'same parent/payload returns byte-equivalent jsonb despite caller ordering');
insert into int1_results values('idempotency:payload_mismatch',
 pg_temp.int1_expect_error($q$select stock._int1_prepare_operation(
  'a7000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',1,'revision_approved',
  array['82600000-0000-0000-0000-000000000001']::uuid[])$q$,'OP_RESERVATION_PAYLOAD_MISMATCH'),
 'same parent with changed canonical payload rejected');
insert into int1_results values('idempotency:invalid_scope',
 pg_temp.int1_expect_error($q$select stock._int1_prepare_operation(
  'a7000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',1,'revision_target_sync',array[]::uuid[])$q$,
  'OP_RESERVATION_SCOPE_MISMATCH'),'empty selected scope rejected');
insert into int1_results values('idempotency:resolved_snapshots_hashed',
 (select payload_hash=encode(sha256(convert_to(jsonb_build_object(
   'contract_version','INT-1/2.0','actor_profile_id','40000000-0000-0000-0000-000000000001',
   'actor_user_id','50000000-0000-0000-0000-000000000001',
   'op_id','81000000-0000-0000-0000-000000000001',
   'revision_id','83000000-0000-0000-0000-000000000001','op_change_sequence',1,
   'operation_kind','revision_target_sync','canonical_scope',canonical_scope,
   'published_run_id',published_run_id,
   'resolved_snapshots',(select jsonb_agg(jsonb_build_object(
     'contribution_snapshot_id',s.contribution_snapshot_id,'contribution_id',s.contribution_id,
     'production_order_line_id',s.production_order_line_id,'usage_key',s.usage_key,
     'resource_id',s.resource_id,'canonical_unit_id',s.canonical_unit_id,'target_quantity',s.target_quantity)
     order by s.production_order_line_id,s.usage_key,s.contribution_id,s.contribution_snapshot_id)
     from stock.production_order_contribution_snapshots s where s.calculation_run_id=published_run_id)
   )::text,'UTF8')),'hex')
  from stock.op_reservation_operations where id='a7000000-0000-0000-0000-000000000001'),
 'server hash contains resolved snapshot values');
insert into int1_results values('idempotency:prepared_items_no_binding',
 (select count(*)=2 and bool_and(binding_id is null and reservation_change_sequence is null
   and action_kind='prepared' and result=jsonb_build_object('status','prepared','physical_effect','none'))
   from stock.op_reservation_operation_items where operation_id='a7000000-0000-0000-0000-000000000001'),
 'prepared append-only items have no reservation/binding');
insert into int1_results values('idempotency:parent_completed_no_started',
 (select status='completed' and result->>'effect'='prepared_only'
   from stock.op_reservation_operations where id='a7000000-0000-0000-0000-000000000001'),
 'atomic insert writes completed parent only');
insert into int1_results values('idempotency:children_deterministic',
 (select count(*)=2 and count(distinct prepared_item_id)=2
   and bool_and(prepared_item_id=stock._int1_prepared_item_id(operation_id,production_order_line_id,
     usage_key,contribution_id,contribution_snapshot_id,resource_id)
     and child_request_id is null and prepared_parent_item_id is null)
   from stock.op_reservation_operation_items where operation_id='a7000000-0000-0000-0000-000000000001'),
 'prepared IDs are deterministic and separate from physical request IDs');
do $$
declare
  v_prepared uuid;
  v_reserve uuid;
  v_reserve_retry uuid;
  v_reserve_other_location uuid;
  v_change uuid;
  v_change_retry uuid;
  v_release uuid;
  v_release_retry uuid;
begin
  select prepared_item_id into v_prepared from stock.op_reservation_operation_items
   where operation_id='a7000000-0000-0000-0000-000000000001'
     and production_order_line_id='82000000-0000-0000-0000-000000000001'
     and usage_key='main' and action_kind='prepared';
  v_reserve:=stock._int1_physical_effect_request_id('a7000000-0000-0000-0000-000000000001',v_prepared,
    'reserve_resource',jsonb_build_object('resource_type','article','resource_id','30000000-0000-0000-0000-000000000001',
      'location_id','20000000-0000-0000-0000-000000000001'));
  v_reserve_retry:=stock._int1_physical_effect_request_id('a7000000-0000-0000-0000-000000000001',v_prepared,
    'reserve_resource',jsonb_build_object('resource_type','article','resource_id','30000000-0000-0000-0000-000000000001',
      'location_id','20000000-0000-0000-0000-000000000001'));
  v_reserve_other_location:=stock._int1_physical_effect_request_id('a7000000-0000-0000-0000-000000000001',v_prepared,
    'reserve_resource',jsonb_build_object('resource_type','article','resource_id','30000000-0000-0000-0000-000000000001',
      'location_id','20000000-0000-0000-0000-000000000002'));
  v_change:=stock._int1_physical_effect_request_id('a7000000-0000-0000-0000-000000000001',v_prepared,
    'change_reservation_target',jsonb_build_object('reservation_id','84000000-0000-0000-0000-000000000001',
      'location_id','20000000-0000-0000-0000-000000000001','change_sequence',2));
  v_change_retry:=stock._int1_physical_effect_request_id('a7000000-0000-0000-0000-000000000001',v_prepared,
    'change_reservation_target',jsonb_build_object('change_sequence',2,
      'location_id','20000000-0000-0000-0000-000000000001','reservation_id','84000000-0000-0000-0000-000000000001'));
  v_release:=stock._int1_physical_effect_request_id('a7000000-0000-0000-0000-000000000001',v_prepared,
    'release_reservation',jsonb_build_object('reservation_id','84000000-0000-0000-0000-000000000001',
      'segment_id','85000000-0000-0000-0000-000000000001'));
  v_release_retry:=stock._int1_physical_effect_request_id('a7000000-0000-0000-0000-000000000001',v_prepared,
    'release_reservation',jsonb_build_object('reservation_id','84000000-0000-0000-0000-000000000001',
      'segment_id','85000000-0000-0000-0000-000000000001'));

  insert into int1_results values('physical_id:reserve_retry_same',v_reserve=v_reserve_retry,'same prepared item/effect/coordinates');
  insert into int1_results values('physical_id:change_retry_same',v_change=v_change_retry,'same logical coordinates despite JSON key order');
  insert into int1_results values('physical_id:release_retry_same',v_release=v_release_retry,'same prepared item/effect/coordinates');
  insert into int1_results values('physical_id:effect_and_coordinate_separation',
    v_reserve<>v_change and v_reserve<>v_release and v_change<>v_release
      and v_reserve<>v_reserve_other_location and v_prepared not in (v_reserve,v_change,v_release),
    'different effect kinds/coordinates yield distinct IDs; prepared identity is unchanged');
  insert into int1_results values('physical_id:prepared_identity_independent',
    v_prepared=stock._int1_prepared_item_id('a7000000-0000-0000-0000-000000000001',
      '82000000-0000-0000-0000-000000000001','main','82500000-0000-0000-0000-000000000001',
      '82600000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
    'prepared identity remains canonical and is not derived from effect kind');
end $$;
insert into int1_results values('physical_id:unsupported_kind_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_physical_effect_request_id(
  'a7000000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000001',
  'not_a_physical_effect','{"reservation_id":"84000000-0000-0000-0000-000000000001"}'::jsonb)$q$,
  'INT1_PHYSICAL_EFFECT_IDENTITY_INVALID'),'only the three approved physical effect kinds are accepted');
insert into int1_results values('physical_id:payload_value_rejected_as_coordinate',
 pg_temp.int1_expect_error($q$select stock._int1_physical_effect_request_id(
  'a7000000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000001',
  'reserve_resource','{"resource_type":"article","resource_id":"30000000-0000-0000-0000-000000000001","location_id":"20000000-0000-0000-0000-000000000001","target_quantity":5}'::jsonb)$q$,
  'INT1_PHYSICAL_EFFECT_IDENTITY_INVALID'),'payload values cannot masquerade as logical coordinates');
create function pg_temp.int1_rollback_prepare() returns boolean language plpgsql as $$
begin
  begin
    perform stock._int1_prepare_operation('a7000000-0000-0000-0000-000000000003',
      '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
      'revision_target_sync',array['82600000-0000-0000-0000-000000000001']::uuid[]);
    raise exception 'INT1_ROLLBACK_SENTINEL';
  exception when raise_exception then
    if sqlerrm<>'INT1_ROLLBACK_SENTINEL' then raise; end if;
  end;
  return not exists(select 1 from stock.op_reservation_operations where id='a7000000-0000-0000-0000-000000000003')
    and not exists(select 1 from stock.op_reservation_operation_items where operation_id='a7000000-0000-0000-0000-000000000003');
end $$;
insert into int1_results values('idempotency:rollback_atomic',
 pg_temp.int1_rollback_prepare(), 'failed transactional work leaves no partial journal');
insert into int1_results values('idempotency:no_physical_or_purchase_effect',
 (select count(*)=1 from stock.stock_reservations where id='84000000-0000-0000-0000-000000000001')
 and not exists(select 1 from stock.purchase_needs), 'journal-only operation leaves RES-2/ACHATS untouched');
insert into int1_results values('idempotency:no_application_execute',
 not has_function_privilege('authenticated','stock._int1_prepare_operation(uuid,uuid,uuid,bigint,text,uuid[])','EXECUTE')
 and not has_function_privilege('anon','stock._int1_prepare_operation(uuid,uuid,uuid,bigint,text,uuid[])','EXECUTE'),
 'private core has no application execute');
insert into int1_results values('idempotency:invalid_kind_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_prepare_operation(
  'a7000000-0000-0000-0000-000000000004','81000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',1,'not_an_operation',null)$q$,
  'OP_RESERVATION_OPERATION_KIND_INVALID'), 'unsupported kind rejected');
insert into stock.production_order_revision_changes values(
 '82300000-0000-0000-0000-000000000002','83000000-0000-0000-0000-000000000001',2,null);
insert into int1_results values('idempotency:replay_before_stale_sequence',
 stock._int1_prepare_operation('a7000000-0000-0000-0000-000000000001',
   '81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',1,
   'revision_target_sync',array['82600000-0000-0000-0000-000000000001',
     '82600000-0000-0000-0000-000000000002']::uuid[])
  =(select result from stock.op_reservation_operations where id='a7000000-0000-0000-0000-000000000001'),
 'exact replay returns stored result even after sequence advances');
insert into int1_results values('idempotency:new_stale_sequence_rejected',
 pg_temp.int1_expect_error($q$select stock._int1_prepare_operation(
  'a7000000-0000-0000-0000-000000000005','81000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',1,'revision_approved',null)$q$,
  'OP_RESERVATION_STALE_CHANGE_SEQUENCE'), 'new operation on older sequence rejected');
do $$ begin
  update stock.op_reservation_operation_items set result='{}'
   where operation_id='a7000000-0000-0000-0000-000000000001';
  raise exception 'expected append-only rejection missing';
exception when raise_exception then
  if sqlerrm<>'OP_RESERVATION_APPEND_ONLY' then raise; end if;
end $$;
insert into int1_results values('idempotency:items_append_only',true,'expected stable error');

do $$ begin
  perform stock.apply_op_reservation_operation('90000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001',2,'revision_rejected','[]');
  raise exception 'disabled bulk unexpectedly succeeded';
exception when raise_exception then
  if sqlerrm<>'OP_RESERVATION_INTEGRATION_DISABLED' then raise; end if;
end $$;
insert into int1_results values('bulk:owner_disabled',true,'expected disabled error');
insert into int1_results values('no_purchase_need_created',(select count(*)=0 from stock.purchase_needs),'zero');

select name,passed,detail from int1_results order by name;
select count(*) total,count(*) filter(where passed) passed,count(*) filter(where not passed) failed,
 case when bool_and(passed) then 'ALL_INT1_INTERNAL_TESTS_PASSED' else 'INT1_INTERNAL_TESTS_FAILED' end verdict
from int1_results;
do $$ begin
  if exists(select 1 from int1_results where not passed) then raise exception 'INT1_INTERNAL_TESTS_FAILED'; end if;
end $$;
rollback;

