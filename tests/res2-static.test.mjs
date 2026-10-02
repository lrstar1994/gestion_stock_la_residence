import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const name='202610010001_stock_reservation_operations.sql';
const sql=fs.readFileSync(path.join(root,'supabase/migrations_hold',name),'utf8');
const code=sql.replace(/--[^\n]*/g,'');
test('migration stays in hold; RES-1 copies identical',()=>{
 assert.equal(fs.existsSync(path.join(root,'supabase/migrations',name)),false);
 assert.deepEqual(fs.readFileSync(path.join(root,'supabase/migrations/202609290002_stock_reservation_foundation.sql')),
 fs.readFileSync(path.join(root,'supabase/migrations_hold/202609290002_stock_reservation_foundation.sql')));
});
test('only allowed RES-1 schema change; no physical/module/history writes',()=>{
 assert.equal((code.match(/alter table/gi)||[]).length,1);
 assert.match(code,/alter table stock\.stock_reservations\s+add column last_target_change_sequence bigint not null default 0;/);
 assert.doesNotMatch(code,/\b(create table|create trigger|create policy|alter role|create role|drop |truncate |delete from )/i);
 for(const m of code.matchAll(/\b(?:insert into|update)\s+stock\.([a-z_]+)/gi)) {
   assert(['stock_reservations','stock_reservation_segments','stock_reservation_requests',
     'stock_reservation_events','stock_reservation_locks'].includes(m[1]),m[1]);
 }
 assert.doesNotMatch(code,/supabase_migrations|stock_movements|purchase_needs|production_orders/);
});
test('four public RPCs; eleven internal helpers; no speculative public entrypoint',()=>{
 const functions=[...code.matchAll(/create function stock\.([a-z_0-9]+)\(/gi)].map(m=>m[1]);
 assert.deepEqual(functions.filter(n=>!n.startsWith('_res2_')),
 ['reserve_resource','change_reservation_target','release_reservation','get_reservation_state']);
 assert.equal(functions.filter(n=>n.startsWith('_res2_')).length,11);
 assert.equal((code.match(/security definer/gi)||[]).length,4);
 assert.equal((code.match(/grant execute on function/gi)||[]).length,4);
 assert.match(code,/revoke all on function %s from public,anon,authenticated/);
});
test('business locks exclusively use RES-1; lock request precedes actor and payload',()=>{
 assert.equal((code.match(/pg_advisory_xact_lock/g)||[]).length,1);
 for(const name of ['reserve_resource','change_reservation_target','release_reservation']) {
   const body=code.slice(code.indexOf('create function stock.'+name+'(')).split('end $$;')[0];
   assert(body.indexOf('_res2_lock_request')<body.indexOf('_res2_actor'));
   assert(body.indexOf('_res2_lock_request')<body.indexOf('_res2_request('));
   assert(body.indexOf('if v_result is not null then return v_result;')<body.indexOf('insert into stock.'));
   assert.match(body,/insert into stock\.stock_reservation_requests[\s\S]*return v_result;\s*$/);
 }
 assert.match(code,/order by k\.resource_type,k\.resource_id,k\.location_id/);
});
test('canonical payload and existing dependencies reused',()=>{
 assert.match(code,/'contract','RES-2\/2\.0','operation',p_operation/);
 assert.match(code,/'actor_profile_id',p_actor,'auth_user_id',auth\.uid\(\)/);
 assert.match(code,/pg_extension/); assert.match(code,/'sha256'/);
 assert.doesNotMatch(code,/jsonb_strip_nulls|\bmd5\(/);
 assert.match(code,/stock\.article_location_allowed\(p_article_id,p_location_id\)/);
 assert.match(code,/stock\.can_access_stock_location\(p_location_id,true\)/);
 assert.match(code,/from stock\.stock_location_view/);
});
