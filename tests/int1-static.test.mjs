import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration=path.join(root,'supabase/migrations_hold/202610020001_op_stock_reservation_integration.sql');
const alignment=path.join(root,'supabase/migrations_hold/202610050001_int1_op2_schema_alignment.sql');
const boundary=path.join(root,'supabase/migrations_hold/202610060001_int1_op2_boundary_helpers.sql');
const step3a=path.join(root,'supabase/migrations_hold/202610070001_int1_transactional_idempotency.sql');
const step3a1=path.join(root,'supabase/migrations_hold/202610080001_int1_physical_effect_idempotency.sql');
const sql=fs.readFileSync(migration,'utf8');
const code=sql.replace(/--[^\n]*/g,'');
const step1=fs.readFileSync(alignment,'utf8');
const step1Code=step1.replace(/--[^\n]*/g,'');
const step2=fs.readFileSync(boundary,'utf8');
const step2Code=step2.replace(/--[^\n]*/g,'');
const step3=fs.readFileSync(step3a,'utf8');
const step3Code=step3.replace(/--[^\n]*/g,'');
const step3a1Sql=fs.readFileSync(step3a1,'utf8');
const step3a1Code=step3a1Sql.replace(/--[^\n]*/g,'');

test('INT-1 stays additive and in migrations_hold',()=>{
  assert.equal(fs.existsSync(path.join(root,'supabase/migrations/202610020001_op_stock_reservation_integration.sql')),false);
  assert.equal(fs.existsSync(path.join(root,'supabase/migrations/202610050001_int1_op2_schema_alignment.sql')),false);
  assert.equal(fs.existsSync(alignment),true);
  assert.equal(fs.existsSync(path.join(root,'supabase/migrations/202610060001_int1_op2_boundary_helpers.sql')),false);
  assert.equal(fs.existsSync(path.join(root,'supabase/migrations/202610070001_int1_transactional_idempotency.sql')),false);
  assert.equal(fs.existsSync(path.join(root,'supabase/migrations/202610080001_int1_physical_effect_idempotency.sql')),false);
  assert.equal(fs.existsSync(step3a1),true);
  assert.equal((code.match(/create table stock\.op_reservation_/g)||[]).length,5);
  assert.doesNotMatch(step1Code,/alter table stock\.(production_order|stock_reservation)/i);
});

test('step 3A journals canonical idempotent requests without physical or ACHATS writes',()=>{
  assert.match(step3Code,/create function stock\._int1_prepare_operation\(/);
  assert.match(step3Code,/p_op_reservation_operation_id uuid/);
  assert.match(step3Code,/stock\._int1_list_published_op_stock_needs\(/);
  assert.match(step3Code,/encode\(sha256\(convert_to\(v_payload::text,'UTF8'\)\),'hex'\)/);
  assert.match(step3Code,/OP_RESERVATION_PAYLOAD_MISMATCH/);
  assert.match(step3Code,/pg_advisory_xact_lock[\s\S]*INT-1\/parent[\s\S]*pg_advisory_xact_lock[\s\S]*INT-1\/business/);
  assert.match(step3Code,/INT-1\/2\.0/);
  for(const kind of ['revision_target_sync','revision_approved','revision_rejected','revision_withdrawn','chef_hold','chef_release','op_cancellation_requested','op_cancelled']) {
    assert.ok(step3Code.includes(`'${kind}'`));
  }
  assert.match(step3Code,/action_kind='prepared'/);
  assert.match(step3Code,/physical_effect','none/);
  assert.match(step3Code,/revoke all on function stock\._int1_prepare_operation[\s\S]*from public,anon,authenticated/);
  assert.match(step3Code,/status','completed'/);
  assert.doesNotMatch(step3Code,/reserve_resource|change_reservation_target|release_reservation|get_reservation_state|purchase_needs|stock_movements|delivered_quantity/);
  assert.doesNotMatch(step3Code,/status in \('started'/);
});

test('step 3A.1 separates prepared-item identity from each physical request identity',()=>{
  assert.match(step3a1Code,/add column prepared_item_id uuid/);
  assert.match(step3a1Code,/add column prepared_parent_item_id uuid/);
  assert.match(step3a1Code,/alter column child_request_id drop not null/);
  assert.match(step3a1Code,/set prepared_item_id=child_request_id, child_request_id=null/);
  assert.match(step3a1Code,/op_reservation_operation_items_identity_split_check/);
  assert.match(step3a1Code,/create function stock\._int1_prepared_item_id\(/);
  assert.match(step3a1Code,/create function stock\._int1_physical_effect_request_id\(/);
  assert.match(step3a1Code,/INT-1\/3A\.1\/RES-2-PHYSICAL-EFFECT/);
  for(const effect of ['reserve_resource','change_reservation_target','release_reservation']) {
    assert.ok(step3a1Code.includes(`'${effect}'`),`missing physical effect namespace: ${effect}`);
  }
  assert.match(step3a1Code,/sha256\(convert_to\(v_identity,'UTF8'\)\)/);
  assert.match(step3a1Code,/p_effect_coordinates - 'resource_type' - 'resource_id' - 'location_id'/);
  assert.match(step3a1Code,/p_effect_coordinates - 'reservation_id' - 'location_id' - 'change_sequence'/);
  assert.match(step3a1Code,/p_effect_coordinates - 'reservation_id' - 'segment_id'/);
  assert.match(step3a1Code,/prepared_item_id.*child_request_id is null/s);
  assert.match(step3a1Code,/prepared_parent_item_id.*v_effect_kind/s);
  assert.match(step3a1Code,/drop function stock\._int1_child_request_id\(/);
  assert.doesNotMatch(step3a1Code,/\b(gen_random_uuid|random)\s*\(/i);
  assert.doesNotMatch(step3a1Code,/\b(perform|select)\s+stock\.(reserve_resource|change_reservation_target|release_reservation|get_reservation_state)\s*\(/i);
  assert.doesNotMatch(step3a1Code,/purchase_needs|stock_movements/);
});

test('activation is structurally disabled and no automatic hook exists',()=>{
  assert.match(code,/activation_state='disabled'/);
  assert.match(code,/OP_RESERVATION_INTEGRATION_DISABLED/);
  assert.doesNotMatch(code,/create trigger[\s\S]{0,120}on stock\.production_order/i);
  assert.doesNotMatch(code,/grant execute on function stock\.apply_op_reservation_operation/i);
});

test('no forbidden intermodule write is introduced',()=>{
  assert.doesNotMatch(step1Code,/\b(insert into|update|delete from)\s+stock\.(purchase_needs|stock_movements|sales|stock_outs|production_orders|production_order_revisions|production_order_lines|stock_reservations|stock_reservation_segments)/i);
  assert.doesNotMatch(step1Code,/recipe_ingredients/);
});

test('OP-2 identities replace generic source identity',()=>{
  assert.match(step1Code,/drop column source_kind/);
  assert.match(step1Code,/drop column source_id/);
  for(const column of ['production_order_line_id','contribution_id','contribution_snapshot_id','published_run_id']) {
    assert.match(step1Code,new RegExp(`add column ${column} uuid not null`));
  }
  assert.match(step1Code,/op_reservation_bindings_current_line_usage_idx/);
  assert.match(step1Code,/unique \(production_order_line_id,usage_key,contribution_id\)/);
  assert.match(step1Code,/OP_RESERVATION_BINDING_IDENTITY_IMMUTABLE/);
  assert.match(step1Code,/OP_RESERVATION_BINDING_HISTORY_IMMUTABLE/);
});

test('idempotence structures are prepared while bulk stays disabled',()=>{
  assert.match(step1Code,/canonical_scope jsonb not null/);
  assert.match(step1Code,/contract_version text not null/);
  assert.match(step1Code,/status text not null/);
  assert.match(step1Code,/create function stock\._int1_business_key\(\s*p_op_id uuid,[\s\S]*p_canonical_scope jsonb/);
  assert.match(step1Code,/INT-1\/2\.0\|op=/);
  assert.match(step1Code,/create function stock\._int1_child_request_id\(\s*p_operation_id uuid,\s*p_production_order_line_id uuid/);
  assert.match(code,/create function stock\.apply_op_reservation_operation/);
  assert.match(code,/OP_RESERVATION_INTEGRATION_DISABLED/);
  assert.doesNotMatch(step1Code,/grant execute on function stock\.apply_op_reservation_operation/i);
});

test('allocations remain analytical without duplicated physical state',()=>{
  assert.match(code,/category in \('approved','pending_increase','chef_hold'\)/);
  assert.doesNotMatch(step1Code,/category[^;]*mixed/i);
  assert.doesNotMatch(step1Code,/add column (physical_reserved|delivered_quantity|approved_shortage)/i);
  assert.match(step1,/mixed and approved shortage are derived/);
  assert.match(step1,/physical reservation remains exclusively RES-2/);
});

test('security is preserved and article-only remains enforced',()=>{
  assert.match(step1Code,/enable row level security/);
  assert.match(step1Code,/force row level security/);
  assert.match(step1Code,/revoke all on table stock\.%I from public,anon,authenticated/);
  assert.match(code,/resource_type='article'/);
  assert.doesNotMatch(step1Code,/resource_type\s*=\s*'recipe'/i);
});

test('OP-2 boundary helpers are private, snapshot-based and non-physical',()=>{
  assert.match(step2Code,/create function stock\._int1_resolve_published_op_stock_need/);
  assert.match(step2Code,/create function stock\._int1_list_published_op_stock_needs/);
  assert.match(step2Code,/create function stock\._int1_resolve_op_stock_need/);
  assert.match(step2Code,/stock\.resolve_op_stock_need\(/);
  assert.match(step2Code,/stock\.list_op_stock_needs\(/);
  for(const signature of [
    'stock._int1_resolve_published_op_stock_need(uuid,uuid,bigint,uuid,text)',
    'stock._int1_list_published_op_stock_needs(uuid,uuid,bigint,uuid[])',
    'stock._int1_resolve_op_stock_need(uuid,uuid,bigint,uuid,text)'
  ]) {
    const name=signature.slice('stock.'.length,signature.indexOf('('));
    assert.ok(step2Code.includes(name));
    assert.ok(step2Code.includes(`revoke all on function ${signature}`));
  }
  assert.match(step2Code,/security definer[\s\S]*set search_path=pg_catalog,stock/);
  assert.match(step2Code,/run_status is distinct from 'published'/);
  assert.match(step2Code,/mapping_conversion_factor/);
  assert.doesNotMatch(step2Code,/stock\._res2_(actor|lock_resources)|reserve_resource|change_reservation_target|release_reservation|get_reservation_state/);
  assert.doesNotMatch(step2Code,/purchase_needs|stock_reservation_locks/);
});

