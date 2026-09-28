import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const migration = await readFile(new URL('supabase/migrations/202609200001_create_purchase_price_qualification_contract.sql', root), 'utf8')
const api = await readFile(new URL('src/api/modules/purchasePrices.api.ts', root), 'utf8')

test('A: qualification is separate from source price and unique per source line', () => {
  assert.match(migration, /create table if not exists stock\.purchase_price_qualifications/i)
  assert.match(migration, /unique \(source_type, source_line_id\)/i)
  assert.match(migration, /classification text not null check \(classification in \('normal', 'promotional', 'exceptional'\)\)/i)
  assert.match(migration, /purchase_price_qualification_history/i)
})

test('B/C: only final actual lines are candidates and last RPC filters NORMAL', () => {
  assert.match(migration, /cp\.controlled_at is not null[\s\S]*cp\.status::text in \('retour_partiel', 'retour_complet', 'cloture'\)/i)
  assert.match(migration, /r\.validated_at is not null[\s\S]*r\.status::text in \('validee', 'validee_avec_anomalies', 'entree_stock'\)/i)
  assert.match(migration, /i\.validated_at is not null[\s\S]*i\.status::text in \('validee', 'a_payer', 'partiellement_paye', 'payee', 'cloturee'\)/i)
  assert.match(migration, /get_last_normal_actual_purchase_price[\s\S]*classification = 'normal'/i)
  assert.match(migration, /get_last_normal_actual_purchase_prices[\s\S]*distinct on \(c\.article_id\)/i)
})

test('E: a qualified but non-final source remains inadmissible', () => {
  assert.match(migration, /cp\.controlled_at is not null/i)
  assert.match(migration, /r\.validated_at is not null/i)
  assert.match(migration, /i\.validated_at is not null/i)
})

test('D/E: non-normal qualification requires a reason and no source backfill occurs', () => {
  assert.match(migration, /classification <> 'normal' and v_reason is null/i)
  assert.match(migration, /revoke all on stock\.purchase_price_qualifications from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function stock\.qualify_purchase_price\(text, uuid, text, text\) to authenticated/i)
  assert.doesNotMatch(migration, /update\s+stock\.(cash_purchase_items|reception_items|invoice_items)/i)
})

test('F/G1/G2/G3: unit conversion is explicit and never defaults NULL to one', () => {
  assert.match(migration, /normalized_unit_price/i)
  assert.match(migration, /normalized_unit_id/i)
  assert.match(migration, /conversion_factor/i)
  assert.match(migration, /cpi\.conversion_factor is not null and cpi\.conversion_factor > 0/i)
  assert.match(migration, /ri\.conversion_factor is not null and ri\.conversion_factor > 0/i)
  assert.match(migration, /cpi\.unit_id = coalesce\(cpi\.stock_unit_id, a\.unit_id\).*then 1::numeric/is)
  assert.doesNotMatch(migration, /coalesce\(cpi\.conversion_factor, 1\)/i)
})

test('G/J: stored normalized material cost is reused without double conversion', () => {
  assert.match(migration, /when ri\.effective_material_unit_cost is not null\s+then ri\.effective_material_unit_cost/is)
  assert.match(migration, /ri\.invoice_tax_mode::text as tax_treatment/i)
  assert.match(migration, /ii\.invoice_tax_mode::text as tax_treatment/i)
})

test('H/I: batch lookup and SECURITY DEFINER/search path contract are present', () => {
  assert.match(migration, /create or replace function stock\.get_last_normal_actual_purchase_prices\(p_article_ids uuid\[\]\)/i)
  assert.match(migration, /distinct on \(c\.article_id\)/i)
  assert.match(migration, /where c\.article_id = any\(p_article_ids\)/i)
  assert.match(migration, /c\.classification = 'normal'/i)
  assert.doesNotMatch(migration, /c\.normalized_unit_price is not null/i)
  assert.match(migration, /security definer\s+set search_path = pg_catalog, stock, auth, extensions/i)
  assert.match(migration, /revoke all on function stock\.get_last_normal_actual_purchase_prices\(uuid\[\]\) from public, anon, authenticated/i)
})

test('I: qualification history is not backfilled implicitly', () => {
  assert.match(migration, /left join stock\.purchase_price_qualifications/i)
  assert.match(migration, /q\.classification/i)
  assert.doesNotMatch(migration, /update\s+stock\.(cash_purchase_items|reception_items|invoice_items)/i)
})

test('frontend consumes only the official RPC contract', () => {
  assert.match(api, /rpc\('get_last_normal_actual_purchase_price'/i)
  assert.match(api, /rpc\('get_last_normal_actual_purchase_prices'/i)
  assert.match(api, /rpc\('qualify_purchase_price'/i)
})
