import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const a1 = await readFile(new URL('supabase/migrations/202609200001_create_purchase_price_qualification_contract.sql', root), 'utf8')
const a2 = await readFile(new URL('supabase/migrations/202609210001_recipe_workflow_foundation.sql', root), 'utf8')
const a3 = await readFile(new URL('supabase/migrations/202609210002_recipe_subrecipes_and_snapshots.sql', root), 'utf8')
const a4 = await readFile(new URL('supabase/migrations/202609210003_recipe_procedure_and_dressing_photo.sql', root), 'utf8')
const a5 = await readFile(new URL('supabase/migrations/202609210004_recipe_import_aliases.sql', root), 'utf8')
const a6 = await readFile(new URL('supabase/migrations/202609210005_recipe_workflow_validation_and_versioning.sql', root), 'utf8')
const api = await readFile(new URL('src/api/modules/recipes.api.ts', root), 'utf8')
const importHelper = await readFile(new URL('src/lib/recipeImport.ts', root), 'utf8')

test('Direction receives only the existing final recipe-validation permission', () => {
  assert.match(a6, /values \('direction'::stock\.user_role, 'recipes\.final_validate'\)\s+on conflict \(role, permission\) do nothing/i)
  assert.doesNotMatch(a6, /\('chef_cuisine'::stock\.user_role, 'recipes\.final_validate'\)/i)
})

test('recipe editors use the established active recipe-manager predicate', () => {
  assert.match(a2, /recipe_trim_forms_manage[\s\S]*stock\.can_current_user_manage_recipes\(\)/i)
  assert.match(a2, /recipe_steps_manage[\s\S]*stock\.can_current_user_manage_recipes\(\)/i)
  assert.doesNotMatch(a2, /recipes\.manage/)
})

test('imports cannot create an official retained sale price', () => {
  const importBody = a5.match(/create or replace function stock\.import_recipe_draft[\s\S]*?end;\s*\$\$;/i)?.[0] ?? ''
  assert.match(importBody, /0, 0, 0, 0,\s*3, 'brouillon'/i)
  assert.match(importBody, /null, 'draft'/i)
  assert.doesNotMatch(importBody, /p_recipe\s*->>\s*'retained_sale_price_ttc'/i)
  assert.doesNotMatch(api, /retained_sale_price_ttc: recipeRow\.retainedSalePriceTtc/)
  assert.doesNotMatch(importHelper, /PV retenu TTC facultatif/)
})

test('article and subrecipe lines are mutually exclusive and readiness checks usable child data', () => {
  assert.match(a3, /line_kind = 'article' and article_id is not null and subrecipe_id is null/i)
  assert.match(a3, /line_kind = 'subrecipe' and subrecipe_id is not null and article_id is null/i)
  assert.match(a6, /i\.unit_stored is distinct from child\.yield_unit_id/i)
  assert.match(a6, /coalesce\(i\.quantity_stored, 0\) <= 0/i)
  assert.match(a6, /with recursive dependency/i)
})

test('version creation is one authenticated RPC transaction with no inherited validation or retained price', () => {
  const body = a6.match(/create or replace function stock\.create_recipe_version[\s\S]*?end;\s*\$\$;/i)?.[0] ?? ''
  assert.match(body, /security definer[\s\S]*set search_path = pg_catalog, stock, auth, extensions/i)
  assert.match(body, /insert into stock\.recipes/i)
  assert.match(body, /insert into stock\.recipe_ingredients/i)
  assert.match(body, /insert into stock\.recipe_steps/i)
  assert.match(body, /'version_created'/i)
  assert.match(body, /null, null,[\s\S]*'brouillon', 'draft'/i)
  assert.match(api, /rpc\('create_recipe_version'/i)
  assert.doesNotMatch(api.match(/async function createRecipeVersion[\s\S]*?return data as string/)?.[0] ?? '', /replaceRecipeIngredients|replaceRecipeSteps|record_recipe_version_created/)
})

test('private recipe assets require an active profile for reading', () => {
  assert.match(a4, /Recipe assets authenticated read[\s\S]*p\.user_id = auth\.uid\(\)[\s\S]*p\.status = 'active'/i)
  assert.match(a4, /values \('recipe-assets', 'recipe-assets', false/i)
})

test('normal-price read RPCs require an active profile without changing their signatures', () => {
  for (const name of ['get_last_normal_actual_purchase_price', 'get_last_normal_actual_purchase_prices']) {
    const body = a1.match(new RegExp(`create or replace function stock\\.${name}[\\s\\S]*?end;\\s*\\$\\$;`, 'i'))?.[0] ?? ''
    assert.match(body, /stock\.current_profile_id\(\) is null/i)
    assert.match(body, /Profil actif requis pour consulter les prix Achats/i)
  }
  assert.match(a1, /get_last_normal_actual_purchase_price\(p_article_id uuid\)/i)
  assert.match(a1, /get_last_normal_actual_purchase_prices\(p_article_ids uuid\[\]\)/i)
})

test('final validation snapshots the exact unit cost used by each subrecipe line', () => {
  assert.match(a6, /set subrecipe_cost_snapshot = child\.total_cost \/ nullif\(child\.yield_quantity, 0\)/i)
  assert.match(a6, /total_cost = i\.quantity_stored \* \(child\.total_cost \/ nullif\(child\.yield_quantity, 0\)\)/i)
})
