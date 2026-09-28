import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync(
  'supabase/migrations_hold/202609260001_recipe_version_provisional_price_carryover.sql',
  'utf8',
)

test('la migration conserve la traçabilité du prix provisoire d’origine', () => {
  assert.match(migration, /copied_from_recipe_id uuid references stock\.recipes\(id\)/i)
  assert.match(migration, /copied_from_price_id uuid references stock\.recipe_ingredient_provisional_prices\(id\)/i)
  assert.match(migration, /p\.observed_at, p\.entered_by/i)
  assert.match(migration, /p\.source, p\.observation, v_parent\.id, p\.id/i)
})

test('la reprise est limitée aux articles et unités compatibles sans fallback NORMAL', () => {
  assert.match(migration, /new_i\.unit_id = old_i\.unit_id/i)
  assert.match(migration, /and exists \(\s*select 1\s*from jsonb_to_recordset/i)
  assert.doesNotMatch(migration, /join lateral[\s\S]*limit 1/i)
  assert.match(migration, /pp\.normalized_unit_id = \(\s*select a\.unit_id/i)
  assert.match(migration, /coalesce\(pp\.conversion_factor_to_stock, 0\) > 0/i)
  assert.match(migration, /not exists \(\s*select 1\s*from stock\.purchase_actual_price_candidates normal_price/i)
  assert.match(migration, /pp\.normalized_amount_ttc is not null/i)
  assert.match(migration, /perform stock\.refresh_recipe_cost_status\(v_recipe_id\)/i)
  assert.match(migration, /v_current := stock\.recipe_material_cost_with_provisional\(v_recipe_id\)/i)
  assert.match(migration, /theoretical_sale_price_ttc = case when yield_mode = 'portions'/i)
})

function copiedArticles(parentLines, nextLines, provisionalArticles) {
  return provisionalArticles.filter((articleId) => parentLines.some((line) =>
    line.articleId === articleId && nextLines.some((next) => next.articleId === articleId && next.unitId === line.unitId),
  ))
}

test('les lignes dupliquées sont évaluées par paire article/unité, quel que soit leur ordre', () => {
  const parent = [
    { articleId: 'A', unitId: 'KG' },
    { articleId: 'A', unitId: 'L' },
  ]
  const reversed = [
    { articleId: 'A', unitId: 'L' },
    { articleId: 'A', unitId: 'KG' },
  ]
  assert.deepEqual(copiedArticles(parent, reversed, ['A']), ['A'])
  assert.deepEqual(copiedArticles(parent, [{ articleId: 'A', unitId: 'PCS' }], ['A']), [])
  assert.deepEqual(copiedArticles(parent, [{ articleId: 'A', unitId: 'KG' }, { articleId: 'A', unitId: 'KG' }], ['A']), ['A'])
})

test('le versionnement reste une RPC transactionnelle et ne réécrit pas le parent', () => {
  assert.match(migration, /create or replace function stock\.create_recipe_version/i)
  assert.match(migration, /select \* into v_parent from stock\.recipes where id = p_parent_recipe_id for update/i)
  assert.match(migration, /insert into stock\.recipes\(/i)
  assert.match(migration, /status, workflow_status, version/i)
  assert.match(migration, /'brouillon', 'draft', v_version/i)
  assert.doesNotMatch(migration, /update stock\.recipes\s+set[\s\S]*where id = p_parent_recipe_id/i)
})

test('les droits du RPC restent limités à authenticated', () => {
  assert.match(migration, /revoke all on function stock\.create_recipe_version\(uuid, jsonb, jsonb, jsonb\)\s+from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function stock\.create_recipe_version\(uuid, jsonb, jsonb, jsonb\)\s+to authenticated/i)
})
