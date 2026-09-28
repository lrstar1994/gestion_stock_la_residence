import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const helperSource = await readFile(new URL('../src/lib/articleSearch.ts', import.meta.url), 'utf8')
const helperJs = ts.transpile(helperSource, { module: ts.ModuleKind.ESNext })
const helperUrl = `data:text/javascript;base64,${Buffer.from(helperJs).toString('base64')}`
const { searchArticles } = await import(helperUrl)
const component = await readFile(new URL('../src/components/articles/ArticleSearchSelect.tsx', import.meta.url), 'utf8')
const transferPage = await readFile(new URL('../src/pages/stock/StockTransferSinglePage.tsx', import.meta.url), 'utf8')
const allArticleApi = await readFile(new URL('../src/api/modules/catalog.api.ts', import.meta.url), 'utf8')
const articleForm = await readFile(new URL('../src/pages/articles/ArticleFormPage.tsx', import.meta.url), 'utf8')
const stockApi = await readFile(new URL('../src/api/modules/stock.api.ts', import.meta.url), 'utf8')
const draftMigration = await readFile(new URL('../supabase/migrations/202609180002_stock_transfer_drafts_runtime.sql', import.meta.url), 'utf8')

const article = (id, name, family, subFamily = null) => ({
  id, name, normalized_key: name.toLowerCase(), family_id: family,
  families: { name: family }, sub_family: subFamily,
})

test('search recognizes the reported article names and accent-insensitive terms', () => {
  const rows = [
    article('fl', 'FARINE LAFARINA 50 KG', 'ÉPICERIE'),
    article('vh', 'viande hachée', 'BOUCHERIE'),
    article('cr', 'Crème entière', 'LAITERIE', 'Crèmes'),
  ]
  assert.deepEqual(searchArticles(rows, 'farine').map((row) => row.id), ['fl'])
  assert.deepEqual(searchArticles(rows, 'viande').map((row) => row.id), ['vh'])
  assert.deepEqual(searchArticles(rows, 'creme').map((row) => row.id), ['cr'])
  assert.deepEqual(searchArticles(rows, 'lait').map((row) => row.id), ['cr'])
})

test('transfer autocomplete renders selectable live matches and waits for a full search before offering creation', () => {
  assert.match(component, /role="listbox"/)
  assert.match(component, /onClick=\{\(\) => \{ onChange\(article\.id\)/)
  assert.match(component, /allowCreateAfterNoMatch/)
  assert.match(transferPage, /listAllArticles\(\{ status: 'active' \}\)/)
  assert.match(transferPage, /allowCreateAfterNoMatch/)
  assert.match(allArticleApi, /export async function listAllArticles[\s\S]*?for \(let page = 1; ; page \+= 1\)[\s\S]*?articles\.length >= result\.total/)
})

test('article edit loads minimal reference lists with named errors and blocks the form after a failed load', () => {
  assert.match(articleForm, /listArticleEditorFamilies\(isEdit\)/)
  assert.match(articleForm, /listArticleEditorSubCategories\(isEdit\)/)
  assert.match(articleForm, /listArticleEditorUnits\(isEdit\)/)
  assert.match(articleForm, /loadNamedReference\('Fiche article'/)
  assert.match(articleForm, /if \(loadError\)/)
  assert.match(articleForm, /family_id: article\.family_id[\s\S]*?unit_id: article\.unit_id/)
  assert.match(allArticleApi, /from\('families'\)\.select\('id, name, is_active'\)/)
  assert.match(allArticleApi, /from\('sub_categories'\)\.select\('id, family_id, name, is_active'\)/)
  assert.match(allArticleApi, /from\('units'\)\.select\('id, name, abbreviation, is_active'\)/)
})

test('draft server schema, read access, owner and Direction visibility are supplied by the active migration', () => {
  assert.match(draftMigration, /create table if not exists stock\.stock_transfer_batches/i)
  assert.match(draftMigration, /create table if not exists stock\.stock_transfer_batch_items/i)
  assert.match(draftMigration, /p\.id = p_owner_profile_id or p\.role in \('direction', 'controleur'\)/i)
  assert.match(draftMigration, /grant select on stock\.stock_transfer_batches, stock\.stock_transfer_batch_items to authenticated/i)
  assert.match(draftMigration, /create or replace function stock\.save_stock_transfer_draft/i)
  assert.match(draftMigration, /create or replace function stock\.delete_stock_transfer_draft/i)
  assert.match(draftMigration, /create or replace function stock\.finalize_stock_transfer/i)
  assert.match(draftMigration, /insert into stock\.stock_movements/i)
  const saveFunction = draftMigration.match(/create or replace function stock\.save_stock_transfer_draft[\s\S]*?\n\$\$;/i)?.[0]
  assert.ok(saveFunction)
  assert.doesNotMatch(saveFunction, /insert into stock\.stock_movements/i)
  assert.match(stockApi, /from\('stock_transfer_batches'\)[\s\S]*?\.eq\('status', 'draft'\)/)
  assert.match(stockApi, /RPC stock\.save_stock_transfer_draft/)
})
