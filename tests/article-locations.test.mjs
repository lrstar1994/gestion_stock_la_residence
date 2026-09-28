import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const helperSource = await readFile(new URL('../src/lib/articleLocations.ts', import.meta.url), 'utf8')
const helperJavaScript = ts.transpile(helperSource, { module: ts.ModuleKind.ESNext })
const helperUrl = `data:text/javascript;base64,${Buffer.from(helperJavaScript).toString('base64')}`
const { getArticleAllowedLocationIds, isArticleAllowedAtLocation } = await import(helperUrl)

const migration = await readFile(new URL('../supabase/migrations_hold/202609180001_stock_articles_all_active_locations.sql', import.meta.url), 'utf8')
const heldTransferMigration = await readFile(new URL('../supabase/migrations_hold/202609180002_stock_transfer_drafts_runtime.sql', import.meta.url), 'utf8')
const handoverMigration = await readFile(new URL('../supabase/migrations/202609180004_stock_transfer_handover_receipt.sql', import.meta.url), 'utf8')
const articleForm = await readFile(new URL('../src/pages/articles/ArticleFormPage.tsx', import.meta.url), 'utf8')
const articleApi = await readFile(new URL('../src/api/modules/catalog.api.ts', import.meta.url), 'utf8')
const stockApi = await readFile(new URL('../src/api/modules/stock.api.ts', import.meta.url), 'utf8')
const manualMovementPage = await readFile(new URL('../src/pages/stock/ManualMovementPage.tsx', import.meta.url), 'utf8')
const stockTransferPage = await readFile(new URL('../src/pages/stock/StockTransferPage.tsx', import.meta.url), 'utf8')
const stockTransferSinglePage = await readFile(new URL('../src/pages/stock/StockTransferSinglePage.tsx', import.meta.url), 'utf8')
const stockOutsApi = await readFile(new URL('../src/api/modules/stockOuts.api.ts', import.meta.url), 'utf8')
const stockOutPage = await readFile(new URL('../src/pages/stock-outs/StockOutFormPage.tsx', import.meta.url), 'utf8')
const inventoryApi = await readFile(new URL('../src/api/modules/inventories.api.ts', import.meta.url), 'utf8')
const saleForm = await readFile(new URL('../src/pages/sales/SaleFormPage.tsx', import.meta.url), 'utf8')
const recipesApi = await readFile(new URL('../src/api/modules/recipes.api.ts', import.meta.url), 'utf8')
const catalogTypes = await readFile(new URL('../src/lib/catalog.ts', import.meta.url), 'utf8')

test('unrestricted active articles are usable in all active locations despite legacy junction rows', () => {
  const allActive = ['main', 'kitchen', 'restaurant']
  assert.deepEqual(getArticleAllowedLocationIds(false, ['main'], allActive), allActive)
  assert.equal(isArticleAllowedAtLocation(false, ['main'], allActive, 'restaurant'), true)
})

test('an explicit restriction allows only selected active locations', () => {
  assert.deepEqual(getArticleAllowedLocationIds(true, ['main', 'inactive', 'main'], ['main', 'kitchen']), ['main'])
  assert.equal(isArticleAllowedAtLocation(true, ['main'], ['main', 'kitchen'], 'kitchen'), false)
})

test('article form defaults to all active locations and waits for existing article plus option lists before reset', () => {
  assert.match(articleForm, /locations_restricted: false/)
  assert.match(articleForm, /Toutes les localisations actives/)
  assert.match(articleForm, /Restreindre à certaines localisations/)
  assert.match(articleForm, /type="radio" name="article-location-mode"/)
  assert.match(articleForm, /Promise\.all\(\[[\s\S]*?listArticleEditorFamilies\(isEdit\)[\s\S]*?listArticleEditorUnits\(isEdit\)[\s\S]*?listLocations\('', isEdit\)[\s\S]*?getArticle\(id\)/)
  assert.match(articleForm, /form\.reset\(\{[\s\S]*?family_id: article\.family_id,[\s\S]*?unit_id: article\.unit_id/)
  assert.match(articleForm, /location_ids: article\.locations_restricted \?/)
  assert.doesNotMatch(articleForm, /primary_location_id/)
  assert.doesNotMatch(catalogTypes, /primary_location_id/)
})

test('migration defaults every historic article to unrestricted without changing quantities or movements', () => {
  assert.match(migration, /add column if not exists locations_restricted boolean not null default false/i)
  const migrationSetup = migration.slice(0, migration.indexOf('create or replace function stock.article_location_allowed'))
  assert.doesNotMatch(migrationSetup, /update\s+stock\.articles/i)
  assert.doesNotMatch(migration, /(?:insert|update|delete)\s+(?:into\s+)?stock\.(?:stock_movements|inventories|inventory_items|stock_location_view)/i)
})

test('database trigger rejects movements at locations excluded by an explicit article restriction', () => {
  assert.match(migration, /create or replace function stock\.article_location_allowed/i)
  const triggerFunction = migration.match(/create or replace function stock\.enforce_article_location_restriction\([\s\S]*?\n\$\$;/i)?.[0]
  assert.ok(triggerFunction)
  assert.match(triggerFunction, /new\.from_location_id[\s\S]*?article_location_allowed\(new\.article_id, new\.from_location_id\)/i)
  assert.match(triggerFunction, /new\.to_location_id[\s\S]*?article_location_allowed\(new\.article_id, new\.to_location_id\)/i)
  assert.match(migration, /exists\s*\([\s\S]*?from stock\.locations l[\s\S]*?l\.id = p_location_id and l\.is_active/i)
  assert.match(migration, /before insert or update of article_id, from_location_id, to_location_id[\s\S]*?on stock\.stock_movements/i)
})

test('article restriction and allowed-location links are changed atomically by a catalog-authorized RPC', () => {
  const rpc = migration.match(/create or replace function stock\.set_article_location_restriction\([\s\S]*?\n\$\$;/i)?.[0]
  assert.ok(rpc)
  assert.match(rpc, /stock\.can_current_user_manage_catalog\(\)/)
  assert.match(rpc, /from stock\.articles where id = p_article_id for update/i)
  assert.match(rpc, /delete from stock\.article_locations[\s\S]*?insert into stock\.article_locations[\s\S]*?update stock\.articles set locations_restricted = true/i)
  assert.match(migration, /article_location_restriction_flag_guard[\s\S]*?before insert or update of locations_restricted on stock\.articles/i)
  assert.match(articleApi, /rpc\('set_article_location_restriction'/)
})

test('article creation and explicit location links are atomic and default unrestricted', () => {
  const rpc = migration.match(/create or replace function stock\.create_article_with_location_restriction\([\s\S]*?\n\$\$;/i)?.[0]
  assert.ok(rpc)
  assert.match(rpc, /stock\.can_current_user_manage_catalog\(\)/)
  assert.match(migration, /add column if not exists locations_restricted boolean not null default false/i)
  assert.match(rpc, /v_locations_restricted := v_stockable and coalesce/i)
  assert.match(rpc, /insert into stock\.articles[\s\S]*?if v_locations_restricted then[\s\S]*?insert into stock\.article_locations/i)
  assert.match(migration, /grant execute on function stock\.create_article_with_location_restriction\(jsonb, uuid\[\], uuid\) to authenticated/i)
  assert.match(migration, /revoke all on function stock\.create_article_with_location_restriction\(jsonb, uuid\[\], uuid\) from public, anon/i)
})

test('stock, inventory, direct-sale and recipe location filters use the explicit restriction flag', () => {
  assert.match(stockApi, /getArticleAllowedLocationIds\([\s\S]*?article\.locations_restricted/)
  assert.match(inventoryApi, /getArticleAllowedLocationIds\([\s\S]*?article\.locations_restricted/)
  assert.match(saleForm, /if \(!article\.locations_restricted\) return locations/)
  assert.match(saleForm, /if \(!article\?\.locations_restricted\) continue/)
  assert.match(recipesApi, /articles\(id, name, unit_id, locations_restricted/)
  assert.match(articleApi, /p_locations_restricted: values\.stockable && values\.locations_restricted/)
  assert.match(articleApi, /\.from\('articles'\)[\s\S]*?\.eq\('stockable', true\)[\s\S]*?\.eq\('status', 'active'\)/)
})

test('manual movements, stock-outs and transfers filter or reject articles outside their selected locations', () => {
  assert.match(manualMovementPage, /selectableArticles = useMemo\(\(\) => articles\.filter[\s\S]*?values\.location_id/)
  assert.match(stockApi, /createManualMovement[\s\S]*?isArticleAllowedInLocation\(values\.article_id, values\.location_id\)/)
  assert.match(stockOutPage, /selectableArticlesFor\(item\.location_id\)/)
  assert.match(stockOutsApi, /Promise\.all\(values\.items\.map\(\(item\) => isArticleAllowedAtLocation/)
  assert.match(stockTransferPage, /selectableArticles = useMemo\(\(\) => articles\.filter[\s\S]*?values\.from_location_id/)
  assert.match(stockTransferPage, /allowedIds\.includes\(values\.from_location_id\) && allowedIds\.includes\(values\.to_location_id\)/)
  assert.match(stockTransferSinglePage, /selectableArticles = useMemo\(\(\) => articles\.filter[\s\S]*?values\.from_location_id/)
  assert.match(stockApi, /createTransfer[\s\S]*?saveStockTransferDraft[\s\S]*?prepareStockTransfer/)
  assert.match(handoverMigration, /not stock\.article_location_allowed\(i\.article_id, v_batch\.from_location_id\)[\s\S]*?not stock\.article_location_allowed\(i\.article_id, v_batch\.to_location_id\)/)
  assert.match(heldTransferMigration, /not stock\.article_location_allowed\(i\.article_id, v_transfer\.to_location_id\)/)
})
