import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(new URL('../supabase/migrations/202609170001_close_validated_inventory_with_audit.sql', import.meta.url), 'utf8')
const inventoryApi = await readFile(new URL('../src/api/modules/inventories.api.ts', import.meta.url), 'utf8')
const inventoryDetail = await readFile(new URL('../src/pages/inventories/InventoryDetail.tsx', import.meta.url), 'utf8')
const validations = await readFile(new URL('../src/pages/validations/MyValidationsPage.tsx', import.meta.url), 'utf8')
const validationMigration = await readFile(new URL('../supabase/migrations/20260727233000_patch_14_17_pin_foundation.sql', import.meta.url), 'utf8')

test('final review queue contains Direction validation and final-close states', () => {
  assert.match(inventoryApi, /const statuses: InventoryStatus\[\] = \['en_attente', 'valide', 'corrige', 'corrections_generees'\]/)
  assert.match(inventoryApi, /while \(inventories\.length < total\)/)
  assert.match(validations, /Contrôle final — clôture requise/)
  assert.match(validations, /Vérifier les mouvements générés puis clôturer avec PIN/)
})

test('detail exposes close action only for Direction and the approved final-review statuses', () => {
  assert.match(inventoryDetail, /\['valide', 'corrige', 'corrections_generees'\]\.includes\(inventory\.status\) && canValidateInventory\(profile\?\.role\)/)
  assert.match(inventoryDetail, /Clôturer l’inventaire/)
  assert.match(inventoryApi, /rpc\('close_inventory_with_pin'/)
})

test('close RPC validates existing correction links and never writes stock movements', () => {
  const closeFunction = migration.match(/create or replace function stock\.close_inventory_with_pin\([\s\S]*?\n\$\$;/)?.[0]
  assert.ok(closeFunction, 'close RPC exists')
  assert.match(closeFunction, /for update/i)
  assert.match(closeFunction, /stock\.assert_sensitive_action\([\s\S]*?'inventories\.close'[\s\S]*?'inventory\.close'/)
  assert.match(closeFunction, /stock\.stock_movements/)
  assert.match(closeFunction, /inventory_adjustment_requests[\s\S]*status = 'en_attente'/)
  assert.match(closeFunction, /set status = 'cloture',[\s\S]*?closed_by = v_profile_id,[\s\S]*?closed_at = v_closed_at/)
  assert.doesNotMatch(closeFunction, /(?:insert|update|delete)\s+(?:into\s+)?stock\.stock_movements/i)
  assert.match(closeFunction, /insert into stock\.sensitive_action_audit/i)
})

test('closed inventory and its lines are immutable; direct GUC spoofing cannot finalize inventory', () => {
  assert.match(migration, /current_user in \('authenticated', 'anon'\)[\s\S]*?current_setting\('stock\.sensitive_action_authorized'/)
  assert.match(migration, /old\.status in \('cloture', 'cloture_avec_reserve'\)[\s\S]*?ne peut plus etre modifie/)
  assert.match(migration, /create trigger guard_closed_inventory_item_mutation[\s\S]*?before insert or update or delete on stock\.inventory_items/i)
  assert.match(migration, /create trigger guard_closed_inventory_record_mutation[\s\S]*?before update or delete on stock\.inventories/i)
  assert.match(migration, /create trigger guard_closed_inventory_adjustment_mutation[\s\S]*?before insert or update or delete on stock\.inventory_adjustment_requests/i)
  assert.match(migration, /i\.status in \('cloture', 'cloture_avec_reserve'\)/)
})

test('full status path ends with close rather than another correction step', () => {
  const validationFunction = validationMigration.match(/create or replace function stock\.validate_inventory_with_pin\([\s\S]*?\n\$\$;/)?.[0]
  assert.ok(validationFunction, 'Direction validation RPC exists')
  assert.match(validationFunction, /update stock\.inventories[\s\S]*?set status = 'valide'/)
  assert.match(validationFunction, /insert into stock\.stock_movements/)
  assert.match(validationFunction, /set status = case when v_created > 0 then 'corrections_generees'::stock\.inventory_status else 'valide'::stock\.inventory_status end/)
  assert.match(migration, /v_inventory\.status is null or v_inventory\.status not in \('valide', 'corrige', 'corrections_generees'\)/)
  assert.match(migration, /set status = 'cloture'/)
  assert.match(inventoryDetail, /status === 'cloture'.*Clôturé par/s)
})
