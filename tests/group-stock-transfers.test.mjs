import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations_hold/202609180002_stock_transfer_drafts_runtime.sql', import.meta.url), 'utf8')
const handoverMigration = await readFile(new URL('../supabase/migrations/202609180004_stock_transfer_handover_receipt.sql', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/api/modules/stock.api.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../src/pages/stock/StockTransferPage.tsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('draft RPCs are owner-bound and never create stock movements', () => {
  const save = migration.match(/create or replace function stock\.save_stock_transfer_draft\([\s\S]*?\n\$\$;/)?.[0]
  const remove = migration.match(/create or replace function stock\.delete_stock_transfer_draft\([\s\S]*?\n\$\$;/)?.[0]
  assert.ok(save)
  assert.ok(remove)
  assert.match(save, /v_owner <> v_profile_id and v_role <> 'direction'/)
  assert.match(save, /delete from stock\.stock_transfer_batch_items[\s\S]*?insert into stock\.stock_transfer_batch_items/i)
  assert.doesNotMatch(save, /insert into stock\.stock_movements/i)
  assert.doesNotMatch(remove, /stock_movements/i)
  assert.match(migration, /create policy stock_transfer_batches_read_authorized[\s\S]*?stock\.can_read_stock_transfer_batch\(created_by\)/)
  assert.match(migration, /p\.id = p_owner_profile_id or p\.role in \('direction', 'controleur'\)/)
})

test('finalization validates the complete batch and available stock before atomic movement inserts', () => {
  const finalize = migration.match(/create or replace function stock\.finalize_stock_transfer\([\s\S]*?\n\$\$;/)?.[0]
  assert.ok(finalize)
  assert.match(finalize, /from stock\.stock_transfer_batches where id = p_transfer_id for update/i)
  assert.match(finalize, /unique|article_id is null[\s\S]*?quantity is null[\s\S]*?unit_id is null/i)
  assert.match(finalize, /perform pg_advisory_xact_lock/)
  assert.match(finalize, /if v_line\.quantity > v_available then[\s\S]*?raise exception 'Stock insuffisant/i)
  const stockCheck = finalize.indexOf("raise exception 'Stock insuffisant")
  const firstMovement = finalize.toLowerCase().indexOf('insert into stock.stock_movements')
  assert.ok(stockCheck >= 0 && firstMovement > stockCheck, 'all stock sufficiency checks precede movement writes')
  assert.match(finalize, /v_reference := 'TR-'[\s\S]*?movement_reference[\s\S]*?v_reference \|\| '-L'/)
  assert.match(finalize, /reference_type, reference_id[\s\S]*?'stock_transfer_batch', p_transfer_id/)
  assert.match(finalize, /status = case when v_pending_direction then 'pending_direction' else 'validated' end/)
})

test('grouped API uses guarded RPCs rather than direct movement writes', () => {
  assert.match(api, /rpc\('save_stock_transfer_draft'/)
  assert.match(api, /rpc\('delete_stock_transfer_draft'/)
  assert.match(api, /rpc\('finalize_stock_transfer'/)
  const groupedApiStart = api.indexOf('export async function listStockTransferDrafts')
  const groupedApiEnd = api.indexOf('export async function listMovements', groupedApiStart)
  const groupedApi = api.slice(groupedApiStart, groupedApiEnd)
  assert.doesNotMatch(groupedApi, /from\('stock_movements'\)\.insert/)
})

test('UI supports grouped lines, duplicate prevention, autosave, resumption and keeps unit transfer route', () => {
  assert.match(page, /setTimeout\(\(\) => \{[\s\S]*?saveStockTransferDraft/)
  assert.match(page, /window\.localStorage\.setItem\(storageKey/)
  assert.match(page, /resumeDraft/)
  assert.match(page, /deleteStockTransferDraft/)
  assert.match(page, /lines\.some\(\(line\) => line\.article_id === selectedArticle\.id\)/)
  assert.match(page, /getStockQuantity\(articleId, values\.from_location_id\)/)
  assert.match(app, /path="\/stock\/transfer\/single" element=\{<StockTransferSinglePage \/>\}/)
})

test('physical transfer migration preserves transit quantities and appends PIN-audited events', () => {
  assert.match(handoverMigration, /is_stock_transit boolean not null default false/)
  assert.match(handoverMigration, /create unique index if not exists locations_one_stock_transit_idx/)
  assert.match(handoverMigration, /remaining_to_dispatch/)
  assert.match(handoverMigration, /in_transit_quantity/)
  assert.match(handoverMigration, /create table if not exists stock\.stock_transfer_handoffs/)
  assert.match(handoverMigration, /create table if not exists stock\.stock_transfer_receipts/)
  assert.match(handoverMigration, /create table if not exists stock\.stock_transfer_discrepancies/)
  assert.match(handoverMigration, /stock\.assert_sensitive_action\('stock\.transfers\.dispatch'/)
  assert.match(handoverMigration, /stock\.assert_sensitive_action\('stock\.transfers\.receive'/)
  assert.match(handoverMigration, /h\.dispatched_by = v_actor/)
  assert.match(handoverMigration, /r\.received_by = v_actor/)
  assert.match(handoverMigration, /two profils distincts|deux profils distincts/i)
  assert.match(handoverMigration, /revoke all on function stock\.finalize_stock_transfer\(uuid, text\) from public, anon, authenticated/i)
  assert.match(handoverMigration, /stock\.transfers\.dispatch', p_pin, 'stock\.transfer\.dispatch'/)
  assert.match(handoverMigration, /stock\.transfers\.receive', p_pin, 'stock\.transfer\.receive'/)
  assert.match(handoverMigration, /v_profile = v_discrepancy\.recipient_confirmed_by/)
  assert.match(handoverMigration, /if v_batch\.status not in \('in_transit', 'partially_received'\)[\s\S]*?Un écart définitif attend sa seconde confirmation PIN/)
  assert.doesNotMatch(handoverMigration, /pin\s+text\s+not null[\s\S]{0,500}create table/i)
  assert.match(handoverMigration, /v_final_status := stock\.refresh_stock_transfer_workflow_status\(v_batch\.id\)/)
  assert.match(handoverMigration, /v_status := 'closed'/)
  assert.match(handoverMigration, /set closed_by=coalesce\(closed_by, stock\.current_profile_id\(\)\)/)
})

test('receipt access requires the active destination assignment and a different dispatcher', () => {
  const receive = handoverMigration.match(/create or replace function stock\.receive_stock_transfer\([\s\S]*?\n\$\$;/)?.[0]
  assert.ok(receive)
  assert.match(receive, /stock\.has_permission\('stock\.transfers\.receive'\)/)
  assert.match(receive, /from stock\.profile_location_access pla[\s\S]*?pla\.profile_id = v_profile[\s\S]*?pla\.location_id = v_batch\.to_location_id[\s\S]*?pla\.active = true/)
  assert.match(receive, /l\.is_active = true[\s\S]*?not l\.is_stock_transit/)
  assert.match(receive, /v_handoff\.dispatched_by = v_profile/)
})

test('preparation, dispatch and receipt accept at most three decimals', () => {
  const prepare = handoverMigration.match(/create or replace function stock\.prepare_stock_transfer\([\s\S]*?\n\$\$;/)?.[0]
  const dispatch = handoverMigration.match(/create or replace function stock\.dispatch_stock_transfer\([\s\S]*?\n\$\$;/)?.[0]
  const receive = handoverMigration.match(/create or replace function stock\.receive_stock_transfer\([\s\S]*?\n\$\$;/)?.[0]
  assert.ok(prepare && dispatch && receive)
  assert.match(prepare, /i\.quantity <> round\(i\.quantity, 3\)/)
  assert.match(dispatch, /v_item\.quantity <> round\(v_item\.quantity, 3\)/)
  assert.match(receive, /v_item\.quantity <> round\(v_item\.quantity, 3\)/)
  assert.doesNotMatch(prepare, /round\(i\.quantity, 2\)/)
  assert.doesNotMatch(dispatch, /round\(v_item\.quantity, 2\)/)
  assert.doesNotMatch(receive, /round\(v_item\.quantity, 2\)/)
})

test('request identifiers and receipt line uniqueness make duplicate sends idempotent', () => {
  assert.match(handoverMigration, /request_id uuid not null unique/)
  assert.match(handoverMigration, /create unique index if not exists stock_transfer_receipt_items_receipt_handoff_item_idx/)
  assert.match(handoverMigration, /Identifiant de remise déjà utilisé avec des données différentes/)
  assert.match(handoverMigration, /Identifiant de réception déjà utilisé avec des données différentes/)
})

test('transit movement flows preserve establishment totals and transit is excluded from normal locations', () => {
  assert.match(handoverMigration, /stock\.stock_transfer_transit_view[\s\S]*?in_transit_quantity/)
  assert.match(handoverMigration, /not is_stock_transit and \(/)
  assert.match(handoverMigration, /v_batch\.from_location_id, v_transit/)
  assert.match(handoverMigration, /v_transit, v_batch\.to_location_id/)
})

test('legacy pending_direction batches block migration before finalize RPC is revoked', () => {
  assert.match(handoverMigration, /if exists \([\s\S]*?from stock\.stock_transfer_batches where status = 'pending_direction'[\s\S]*?raise exception[\s\S]*?end if;[\s\S]*?\$\$;/)
  assert.match(handoverMigration, /revoke all on function stock\.finalize_stock_transfer\(uuid, text\) from public, anon, authenticated/i)
  assert.match(handoverMigration, /create unique index if not exists stock_transfer_receipt_items_receipt_handoff_item_idx[\s\S]*?\(receipt_id, handoff_item_id\)/)
})

test('normal transfer conserves total stock while a PIN-confirmed loss decreases physical stock', () => {
  const dispatch = handoverMigration.match(/create or replace function stock\.dispatch_stock_transfer\([\s\S]*?\n\$\$;/)?.[0]
  const receive = handoverMigration.match(/create or replace function stock\.receive_stock_transfer\([\s\S]*?\n\$\$;/)?.[0]
  const loss = handoverMigration.match(/create or replace function stock\.confirm_stock_transfer_discrepancy\([\s\S]*?\n\$\$;/)?.[0]
  assert.ok(dispatch && receive && loss)
  assert.match(dispatch, /v_batch\.from_location_id, v_transit/)
  assert.match(receive, /v_transit, v_batch\.to_location_id/)
  assert.match(loss, /'perte', v_transit, null/)
  assert.match(loss, /stock\.assert_sensitive_action\('stock\.transfers\.dispatch'/)
  assert.match(receive, /stock\.assert_sensitive_action\('stock\.transfers\.receive'/)
  assert.match(loss, /Les deux confirmations doivent provenir de profils distincts/)
})

test('legacy direct movement RPC is blocked from authenticated new transfer use', () => {
  const guard = handoverMigration.match(/create or replace function stock\.enforce_stock_movement_location_access\(\)[\s\S]*?\n\$\$;/)?.[0]
  assert.ok(guard)
  assert.match(guard, /new\.movement_type = 'transfert'[\s\S]*?raise exception/i)
  assert.doesNotMatch(guard, /reference_type is distinct from 'stock_transfer_batch'/)
  assert.match(handoverMigration, /revoke all on function stock\.finalize_stock_transfer\(uuid, text\) from public, anon, authenticated/i)
  const immutable = handoverMigration.match(/create or replace function stock\.prevent_transfer_movement_mutation\(\)[\s\S]*?\n\$\$;/)?.[0]
  assert.ok(immutable)
  assert.match(immutable, /old\.reference_type in \('stock_transfer_handoff', 'stock_transfer_receipt', 'stock_transfer_discrepancy'\)/)
  assert.match(immutable, /tg_op = 'UPDATE' and new\.reference_type in \('stock_transfer_handoff', 'stock_transfer_receipt', 'stock_transfer_discrepancy'\)/)
  assert.match(handoverMigration, /revoke all on stock\.stock_transfer_handoffs[\s\S]*?from public, anon, authenticated/i)
  assert.match(handoverMigration, /revoke all on stock\.stock_transfer_transit_view from public, anon, authenticated/i)
  assert.match(api, /export async function createTransfer[\s\S]*?saveStockTransferDraft[\s\S]*?prepareStockTransfer/)
  assert.doesNotMatch(api, /export async function createTransfer[\s\S]*?insert into stock\.stock_movements/i)
})

test('single transfer UI now prepares a physical transfer without PIN or direct stock write', async () => {
  const singlePage = await readFile(new URL('../src/pages/stock/StockTransferSinglePage.tsx', import.meta.url), 'utf8')
  assert.match(singlePage, /Transfert unitaire préparé/)
  assert.match(singlePage, /Préparer le transfert/)
  assert.doesNotMatch(singlePage, /SensitiveActionModal|getMyPinStatus|pinOpen|pinDefined/)
})
