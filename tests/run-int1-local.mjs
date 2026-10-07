// Creates and destroys a disposable loopback-only PostgreSQL cluster.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bin=process.env.INT1_PG_BIN||'C:/Program Files/PostgreSQL/17/bin';
const exe=name=>path.join(bin,name+(process.platform==='win32'?'.exe':''));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'int1-local-'));
const data=path.join(tmp,'data');
const env={...process.env}; for(const key of Object.keys(env)) if(key.startsWith('PG')) delete env[key];
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=['-X','-h','127.0.0.1','-p',String(port),'-d','postgres','-v','ON_ERROR_STOP=1','-A','-t','-q'];
const command=(name,args,options={})=>execFileSync(exe(name),args,{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:60000,...options});
const sql=(text,user='postgres')=>command('psql',[...base,'-U',user],{input:text});
const functionSource=(file,name)=>{const source=read(file);const start=source.indexOf('create or replace function stock.'+name+'(');assert(start>=0);const end=source.indexOf('$$;',start);assert(end>=0);return source.slice(start,end+3);};
let started=false;
try {
  console.log('PostgreSQL:',command('postgres',['--version']).trim());
  console.log('Local-only cluster:',tmp,'port:',port);
  command('initdb',['-D',data,'-U','res2_admin','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--locale=C']);
  fs.appendFileSync(path.join(data,'postgresql.conf'),`\nlisten_addresses='127.0.0.1'\nport=${port}\n`);
  command('pg_ctl',['-D',data,'-l',path.join(tmp,'server.log'),'-w','start'],{stdio:'ignore'}); started=true;
  sql(read('tests/res2-local-fixture.sql'),'res2_admin');
  const pin=read('supabase/migrations/20260727233000_patch_14_17_pin_foundation.sql');
  const viewStart=pin.indexOf('create or replace view stock.stock_location_view as');
  const view=pin.slice(viewStart,pin.indexOf(';',viewStart)+1); assert(viewStart>0);
  sql('set role postgres;\n'+functionSource('supabase/migrations_hold/202609160001_restrict_stock_by_user_location.sql','can_access_stock_location')+'\n'
    +functionSource('supabase/migrations_hold/202609180001_stock_articles_all_active_locations.sql','article_location_allowed')+'\n'
    +view+'\nalter view stock.stock_location_view set (security_invoker=true);');
  sql('set role postgres; begin;\n'+read('supabase/migrations_hold/202609290002_stock_reservation_foundation.sql')+'\n'
    +read('supabase/migrations_hold/202610010001_stock_reservation_operations.sql')+'\ncommit;');
  sql('set role postgres;\n'+read('tests/int1-local-fixture.sql'));
  const migration='supabase/migrations_hold/202610020001_op_stock_reservation_integration.sql';
  console.log('INT-1 SHA-256:',crypto.createHash('sha256').update(read(migration)).digest('hex'));
  sql('set role postgres; begin;\n'+read(migration)+'\ncommit;');
  const step1='supabase/migrations_hold/202610050001_int1_op2_schema_alignment.sql';
  console.log('INT-1 step 1 SHA-256:',crypto.createHash('sha256').update(read(step1)).digest('hex'));
  sql('set role postgres; begin;\n'+read(step1)+'\ncommit;');
  const step2='supabase/migrations_hold/202610060001_int1_op2_boundary_helpers.sql';
  console.log('INT-1 step 2 SHA-256:',crypto.createHash('sha256').update(read(step2)).digest('hex'));
  sql('set role postgres; begin;\n'+read(step2)+'\ncommit;');
  const step3a='supabase/migrations_hold/202610070001_int1_transactional_idempotency.sql';
  console.log('INT-1 step 3A SHA-256:',crypto.createHash('sha256').update(read(step3a)).digest('hex'));
  sql('set role postgres; begin;\n'+read(step3a)+'\ncommit;');
  const step3a1='supabase/migrations_hold/202610080001_int1_physical_effect_idempotency.sql';
  console.log('INT-1 step 3A.1 SHA-256:',crypto.createHash('sha256').update(read(step3a1)).digest('hex'));
  sql('set role postgres; begin;\n'+read(step3a1)+'\ncommit;');
  const output=command('psql',[...base,'-U','postgres','-c','set role postgres','-f',path.join(root,'tests/int1-transactional-validation.sql')]);
  console.log(output.trim()); assert.match(output,/ALL_INT1_INTERNAL_TESTS_PASSED/);

  // Real two-session INT-1 fixtures for idempotent replay/concurrent conflicts.
  sql(`set role postgres;
    insert into stock.production_orders values('91000000-0000-0000-0000-000000000001','draft');
    insert into stock.production_order_revisions values('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',1,'draft');`);
  sql(`set role postgres;
    insert into stock.production_order_lines values('93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',1);
    insert into stock.production_order_revision_lines values('93100000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','93200000-0000-0000-0000-000000000001',2,1);
    insert into stock.production_order_revision_changes values('93300000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',1,null);
    insert into stock.production_order_calculation_runs values(
      '94000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000001',1,'published');`);
  sql(`set role postgres;
    insert into stock.recipe_stock_output_mappings values('95000000-0000-0000-0000-000000000001','93200000-0000-0000-0000-000000000001','main','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,true);
    insert into stock.production_order_contributions(contribution_id,calculation_run_id,production_order_id,revision_id,change_sequence,production_order_line_id,production_order_revision_line_id,usage_key,recipe_id,mapping_source_id,resource_type,resource_id,canonical_unit_id,target_quantity,resolution_status,resolution_code)
      values('96000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',1,'93000000-0000-0000-0000-000000000001','93100000-0000-0000-0000-000000000001','main','93200000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000001','article','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',2,'resolved','RESOLVED');
    insert into stock.production_order_contribution_snapshots(contribution_snapshot_id,contribution_id,calculation_run_id,production_order_line_id,production_order_revision_line_id,revision_id,change_sequence,usage_key,recipe_id,mapping_source_id,resource_type,resource_id,canonical_unit_id,target_quantity)
      values('97000000-0000-0000-0000-000000000001','96000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','93100000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',1,'main','93200000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000001','article','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',2);`);
  const call=(id,kind='revision_target_sync')=>`set role postgres; set request.jwt.claim.sub='50000000-0000-0000-0000-000000000001'; set statement_timeout='10s'; set lock_timeout='8s'; select stock._int1_prepare_operation('${id}','91000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',1,'${kind}',null);`;
  const session=(input,name)=>new Promise((resolve,reject)=>{
    const child=spawn(exe('psql'),[...base,'-U','postgres'],{cwd:root,env:{...env,PGAPPNAME:name},windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr=''; child.stdout.on('data',x=>stdout+=x); child.stderr.on('data',x=>stderr+=x);
    child.on('error',reject); child.on('exit',code=>resolve({code,stdout:stdout.trim(),stderr})); child.stdin.end(input);
  });
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const parentA='a3000000-0000-0000-0000-000000000001';
  const first=session(`begin;\n${call(parentA)}\nselect pg_sleep(1);\ncommit;\n\\q\n`,'int1_same_parent_A');
  await delay(150);
  const replay=command('psql',[...base,'-U','postgres'],{input:call(parentA)}).trim();
  const firstResult=await first; assert.equal(firstResult.code,0,firstResult.stderr);
  assert.equal(firstResult.stdout,replay,'same parent and payload return identical stored result under concurrency');
  console.log('PASS concurrency A: same parent/payload converges to one identical stored result');
  let mismatch='';
  try { command('psql',[...base,'-U','postgres'],{input:call(parentA,'revision_approved')}); }
  catch(error){ mismatch=String(error.stderr||error.message); }
  assert.match(mismatch,/OP_RESERVATION_PAYLOAD_MISMATCH/);
  console.log('PASS concurrency B: same parent/different payload is rejected');

  const parentC1='a3000000-0000-0000-0000-000000000003';
  const parentC2='a3000000-0000-0000-0000-000000000004';
  const owner=session(`begin;\n${call(parentC1,'chef_hold')}\nselect pg_sleep(1);\ncommit;\n\\q\n`,'int1_same_key_A');
  await delay(150);
  let conflict='';
  try { command('psql',[...base,'-U','postgres'],{input:call(parentC2,'chef_hold')}); }
  catch(error){ conflict=String(error.stderr||error.message); }
  const ownerResult=await owner; assert.equal(ownerResult.code,0,ownerResult.stderr);
  assert.match(conflict,/OP_RESERVATION_BUSINESS_KEY_CONFLICT/);
  console.log('PASS concurrency C: same business_key/different parent has one winner; no deadlock');
  console.log('END_TO_END_OP_TO_ARTICLE=BLOCKED_BY_BUSINESS_DEPENDENCY');
} finally {
  if(started) command('pg_ctl',['-D',data,'-m','fast','-w','stop']);
}

