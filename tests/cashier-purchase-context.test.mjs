import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const detail = await readFile(new URL('../src/pages/cash-purchases/CashPurchaseDetail.tsx', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../src/pages/dashboard/DashboardCaisse.tsx', import.meta.url), 'utf8')
const tasks = await readFile(new URL('../src/api/modules/tasks.api.ts', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/api/modules/cashPurchases.api.ts', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations_hold/202609250003_cash_purchase_buyer_directory_atomic.sql', import.meta.url), 'utf8')
const tasksPage = await readFile(new URL('../src/pages/tasks/MyTasksPage.tsx', import.meta.url), 'utf8')

test('cash handover identifies the buyer selected by Caisse and requires it before PIN', () => {
  assert.match(detail, /Acheteur \/ personne recevant effectivement l’argent/)
  assert.match(detail, /Acheteur à désigner/)
  assert.match(detail, /if \(!handoverBuyerId\)/)
  assert.match(detail, /createCashPurchaseBuyer/)
  assert.match(detail, /directory:\$\{directoryId\}/)
  assert.match(api, /p_buyer_profile_id: buyer\.profileId/)
  assert.match(api, /p_buyer_directory_id: buyer\.directoryId/)
})

test('cash tasks and dashboard retain the purchase context and full justification', () => {
  assert.match(tasks, /Montant autorisé par la Direction/)
  assert.match(tasks, /need\.justification/)
  assert.match(tasks, /getPurchaseNeedIntendedUseLabel\(need\)/)
  assert.match(dashboard, /Acheteur non affecté/)
  assert.match(dashboard, /whitespace-pre-wrap break-words/)
  assert.doesNotMatch(dashboard, /Bénéficiaire non renseigné/)
  assert.match(tasks, /Justification :/)
  assert.match(tasks, /Service demandeur :/)
  assert.match(tasks, /Montant autorisé par la Direction/)
})

test('cash task filters stay limited to all, purchases and cash', () => {
  assert.match(tasksPage, /profile\?\.role === 'caisse'[\s\S]*\['all', 'achats', 'caisse'\]/)
  assert.match(tasksPage, /visibleCategoryOrder\.map/)
  assert.match(tasksPage, /whitespace-pre-wrap break-words text-sm text-slate-600/)
})

test('chef cuisine task filters stay limited to all, purchases and receptions', () => {
  assert.match(tasksPage, /profile\?\.role === 'chef_cuisine'/)
  assert.match(tasksPage, /\['all', 'achats', 'receptions'\]/)
  assert.match(tasks, /role === 'chef_cuisine'/)
  assert.match(tasks, /task\.category === 'achats' \|\| task\.category === 'receptions'/)
})

test('the existing disbursement RPC remains the financial confirmation boundary', () => {
  assert.match(api, /rpc\('disburse_cash_purchase'/)
  assert.match(api, /p_amount: amountGiven/)
  assert.match(api, /p_buyer_profile_id: buyer\.profileId/)
  assert.match(api, /p_pin: pin/)
})

test('held migration makes buyer, PIN and financial movement one locked transaction', () => {
  assert.match(migration, /disburse_cash_purchase\(p_cash_purchase_id uuid, p_amount numeric, p_buyer_profile_id uuid, p_buyer_directory_id uuid, p_pin text\)/s)
  assert.match(migration, /cash_purchase_buyer_directory/)
  assert.match(migration, /create_cash_purchase_buyer/)
  assert.match(migration, /assert_sensitive_action\(/)
  assert.match(migration, /p\.role = 'acheteur'/)
  assert.match(migration, /for update/)
  assert.match(migration, /set buyer_id = p_buyer_profile_id, buyer_directory_id = p_buyer_directory_id,[\s\S]*amount_given = p_amount/)
  assert.match(migration, /counterparty_profile_id, counterparty_buyer_directory_id/)
  assert.match(migration, /v_purchase\.buyer_id is distinct from p_buyer_profile_id/)
  assert.match(migration, /counterparty_buyer_directory_id is distinct from p_buyer_directory_id/)
  assert.match(migration, /direction is distinct from 'out'/)
  assert.match(migration, /currency is distinct from 'MGA'/)
  assert.match(migration, /payment_mode is distinct from 'especes'/)
  assert.match(migration, /confirmed_by is distinct from v_purchase\.given_by/)
  assert.match(migration, /revoke all on function stock\.disburse_cash_purchase\(uuid, numeric, text\)/)
})

test('directory buyers are reusable and archived without deleting history', () => {
  assert.match(migration, /is_active boolean not null default true/)
  assert.match(migration, /archive_cash_purchase_buyer/)
  assert.match(migration, /update stock\.cash_purchase_buyer_directory set is_active = false/)
  assert.doesNotMatch(migration, /delete from stock\.cash_purchase_buyer_directory/)
  assert.match(migration, /if \(p_buyer_profile_id is null\) = \(p_buyer_directory_id is null\)/)
  assert.match(migration, /for update/)
})

test('buyer directory has no direct client table access and buyer references are exclusive', () => {
  assert.match(migration, /alter table stock\.cash_purchase_buyer_directory enable row level security/)
  assert.match(migration, /revoke all on table stock\.cash_purchase_buyer_directory from public, anon, authenticated/)
  assert.match(migration, /cash_purchases_buyer_exclusive_check/)
  assert.match(migration, /check \(buyer_id is null or buyer_directory_id is null\)/)
  assert.doesNotMatch(migration, /buyer_id is not null or buyer_directory_id is not null/)
})
