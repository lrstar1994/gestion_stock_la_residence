// No remote endpoint accepted. Creates and stops its own disposable loopback cluster.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = process.env.RES2_PG_BIN || 'C:/Program Files/PostgreSQL/17/bin';
const exe = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
const migration = 'supabase/migrations_hold/202610010001_stock_reservation_operations.sql';
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'res2-local-'));
const data = path.join(tmp, 'data');
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key];
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); });
});
const baseArgs = ['-X', '-h', '127.0.0.1', '-p', String(port), '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-q'];
const command = (name, args, options = {}) => execFileSync(exe(name), args,
  { cwd: root, env, windowsHide: true, encoding: 'utf8', timeout: 60000, ...options });
const sql = (text, user = 'postgres') => command('psql', [...baseArgs, '-U', user], { input: text });
const functionSource = (file, name) => {
  const source = read(file);
  const start = source.indexOf('create or replace function stock.' + name + '(');
  assert(start >= 0, `missing source function ${name}`);
  const end = source.indexOf('$$;', start);
  assert(end >= 0);
  return source.slice(start, end + 3);
};
const sessions = [];
class Session {
  constructor(name, authenticated = true) {
    this.name = name; this.output = ''; this.error = ''; this.serial = 0; this.closed = false;
    this.proc = spawn(exe('psql'), [...baseArgs, '-U', 'postgres'],
      { cwd: root, env: { ...env, PGAPPNAME: name }, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    this.proc.stdout.on('data', chunk => { this.output += chunk; this.check(); });
    this.proc.stderr.on('data', chunk => { this.error += chunk; });
    this.proc.on('error', error => { this.pending?.reject(error); this.pending = null; });
    this.proc.on('exit', code => {
      this.closed = true;
      if (this.pending) { this.pending.reject(new Error(`psql ${name} exit ${code}: ${this.error}`)); this.pending = null; }
    });
    this.proc.stdin.on('error', () => {});
    this.proc.stdin.write("\\set VERBOSITY verbose\nset statement_timeout='15s'; set lock_timeout='10s';\n");
    if (authenticated) this.proc.stdin.write("set role authenticated; set request.jwt.claim.sub='50000000-0000-0000-0000-000000000001';\n");
    sessions.push(this);
  }
  check() {
    if (this.pending && this.output.includes(this.pending.marker)) {
      const p = this.pending; this.pending = null; p.resolve(this.output.slice(p.start, this.output.indexOf(p.marker)));
    }
  }
  run(text) {
    assert(!this.pending && !this.closed, `session unavailable ${this.name}`);
    return new Promise((resolve, reject) => {
      const marker = `RES2_DONE_${++this.serial}`;
      this.pending = { resolve, reject, marker, start: this.output.length };
      this.proc.stdin.write(`${text}\n\\echo ${marker}\n`);
    });
  }
  close() { if (!this.closed) this.proc.stdin.end('rollback;\n\\q\n'); }
}
const article = '30000000-0000-0000-0000-000000000001';
const location = '20000000-0000-0000-0000-000000000001';
const reserve = (req, qty, loc = location) => `select stock.reserve_resource('${req}','article','${article}',${qty},'${loc}',1);`;
let started = false;
let checks = 0;
const pass = name => { checks++; console.log(`PASS ${name}`); };
async function blocked(session) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const waiting = sql(`select count(*) from pg_stat_activity where application_name='${session.name}' and wait_event_type='Lock';`).trim();
    if (waiting === '1') return;
    if (session.closed) throw new Error(session.error);
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error(`session ${session.name} did not wait on a database lock`);
}
async function concurrent(name, qa, qb, { authenticated = true, mismatch = false } = {}) {
  const a = new Session(`res2_${name}_A`, authenticated);
  const b = new Session(`res2_${name}_B`, authenticated);
  try {
    await a.run('begin; ' + qa);
    const resultB = b.run('begin; ' + qb).then(value => ({ value }), error => ({ error }));
    await blocked(b);
    await a.run('commit;');
    const outcome = await resultB;
    if (mismatch) assert.match(outcome.error?.message || '', /RESERVATION_REQUEST_PAYLOAD_MISMATCH/);
    else { if (outcome.error) throw outcome.error; await b.run('commit;'); }
    pass(name + ': two sessions, observed blocking, correct completion');
  } finally { a.close(); b.close(); }
}
try {
  console.log('PostgreSQL:', command('postgres', ['--version']).trim());
  console.log('Local-only cluster:', tmp, 'port:', port);
  console.log('Migration SHA-256:', crypto.createHash('sha256').update(read(migration)).digest('hex'));
  command('initdb', ['-D', data, '-U', 'res2_admin', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--locale=C']);
  fs.appendFileSync(path.join(data, 'postgresql.conf'), `\nlisten_addresses='127.0.0.1'\nport=${port}\n`);
  started = true;
  // Windows postgres inherits pg_ctl handles: use no output pipe that could
  // remain open for the lifetime of the server after pg_ctl has exited.
  command('pg_ctl', ['-D', data, '-l', path.join(tmp, 'server.log'), '-w', 'start'], { stdio: 'ignore' });
  sql(read('tests/res2-local-fixture.sql'), 'res2_admin');
  const pin = read('supabase/migrations/20260727233000_patch_14_17_pin_foundation.sql');
  const viewStart = pin.indexOf('create or replace view stock.stock_location_view as');
  const view = pin.slice(viewStart, pin.indexOf(';', viewStart) + 1);
  assert(viewStart > 0);
  sql(functionSource('supabase/migrations_hold/202609160001_restrict_stock_by_user_location.sql', 'can_access_stock_location') + '\n'
    + functionSource('supabase/migrations_hold/202609180001_stock_articles_all_active_locations.sql', 'article_location_allowed') + '\n'
    + view + '\nalter view stock.stock_location_view set (security_invoker=true);\n'
    + 'revoke all on function stock.article_location_allowed(uuid,uuid) from public,anon,authenticated;\n'
    + 'revoke all on function stock.can_access_stock_location(uuid,boolean) from public,anon;\n'
    + 'grant execute on function stock.can_access_stock_location(uuid,boolean) to authenticated;');
  sql('begin;\n' + read('supabase/migrations_hold/202609290002_stock_reservation_foundation.sql') + '\n' + read(migration) + '\ncommit;');
  console.log('pgcrypto:', sql("select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_extension e join pg_namespace n on n.oid=e.extnamespace join pg_proc p on p.pronamespace=n.oid where e.extname='pgcrypto' and p.proname='digest';").trim());
  const transactional = command('psql', [...baseArgs, '-U', 'postgres', '-f', path.join(root, 'tests/res2-transactional-validation.sql')]);
  fs.writeFileSync(path.join(tmp, 'transactional.txt'), transactional);
  console.log(transactional.trim());
  assert.match(transactional, /transactional checks PASS/);
  const reqA = crypto.randomUUID();
  await concurrent('same_request_same_payload', reserve(reqA, 1), reserve(reqA, 1));
  assert.equal(sql(`select count(*) from stock.stock_reservation_events where request_id='${reqA}';`).trim(), '1');
  assert.equal(sql(`select count(*) from stock.stock_reservation_segments where reservation_id=(select (result->>'reservation_id')::uuid from stock.stock_reservation_requests where request_id='${reqA}');`).trim(), '1');
  pass('same request: one event, one segment');
  const reqB = crypto.randomUUID();
  await concurrent('same_request_different_payload', reserve(reqB, 1), reserve(reqB, 2), { mismatch: true });
  const c = crypto.randomUUID(), d = crypto.randomUUID();
  await concurrent('different_requests_insufficient_stock', reserve(c, 4), reserve(d, 4));
  const quantities = sql(`select string_agg((result->>'reserved_quantity'),',' order by request_id='${c}' desc) from stock.stock_reservation_requests where request_id in ('${c}','${d}');`).trim();
  assert.equal(quantities, '4.0000,0.0000');
  assert.equal(sql(`select sum(reserved_quantity) from stock.stock_reservations;`).trim(), '6.0000');
  pass('insufficient stock: serialized 4 + 0, total 6, no over-reservation');
  // New lock rows with two different resources and reversed input: insertion ordering tested too.
  const keys = [
    {resource_type:'article',resource_id:'60000000-0000-0000-0000-000000000001',location_id:location},
    {resource_type:'article',resource_id:'60000000-0000-0000-0000-000000000002',location_id:'20000000-0000-0000-0000-000000000002'}
  ];
  await concurrent('reversed_multi_resource_locks',
    `select stock._res2_lock_resources('${JSON.stringify(keys)}'::jsonb);`,
    `select stock._res2_lock_resources('${JSON.stringify([...keys].reverse())}'::jsonb);`, { authenticated: false });
  pass('no deadlock, deterministic absent-row insertion and lock acquisition');
  console.log(`${checks} concurrency checks PASS`);
  console.log('Artifacts:', tmp);
} finally {
  for (const session of sessions) session.close();
  if (started) command('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
}
