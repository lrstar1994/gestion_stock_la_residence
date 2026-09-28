import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const importHelper = await readFile(new URL('src/lib/recipeImport.ts', root), 'utf8')
const importMigration = await readFile(new URL('supabase/migrations/202609210004_recipe_import_aliases.sql', root), 'utf8')
const currentCostMigration = await readFile(new URL('supabase/migrations/202609210006_recipe_current_subrecipe_costs.sql', root), 'utf8')
const api = await readFile(new URL('src/api/modules/recipes.api.ts', root), 'utf8')
const form = await readFile(new URL('src/pages/recipes/RecipeFormPage.tsx', root), 'utf8')
const detail = await readFile(new URL('src/pages/recipes/RecipeDetail.tsx', root), 'utf8')
const exports = await readFile(new URL('src/lib/recipeExports.ts', root), 'utf8')

test('official Excel template has no retained sale price column and imports drafts only', () => {
  assert.match(importHelper, /RECIPE_IMPORT_SHEETS = \['FICHES', 'INGRÉDIENTS', 'DÉROULÉ', 'AIDE'\]/)
  assert.doesNotMatch(importHelper, /PV retenu TTC/i)

  const importBody = importMigration.match(/create or replace function stock\.import_recipe_draft[\s\S]*?end;\s*\$\$;/i)?.[0] ?? ''
  assert.match(importBody, /retained_sale_price_ttc[\s\S]*?null, 'draft'/i)
  assert.doesNotMatch(importBody, /p_recipe\s*->>\s*'retained_sale_price_ttc'/i)
  assert.doesNotMatch(importBody, /p_recipe\s*->>\s*'final_price'/i)
})

test('current subrecipe costs stay dynamic while final validation freezes one coherent child cost', () => {
  assert.match(currentCostMigration, /create or replace function stock\.current_recipe_material_cost\(/i)
  assert.match(currentCostMigration, /v_line\.quantity_stored \* \(v_child_cost \/ v_child\.yield_quantity\)/i)
  assert.match(currentCostMigration, /v_child\.status is distinct from 'validee'/i)
  assert.match(currentCostMigration, /cross join lateral[\s\S]*current_recipe_material_cost\(child\.id\) as total_cost/i)
  assert.match(currentCostMigration, /subrecipe_cost_snapshot = current_cost\.total_cost \/ nullif\(child\.yield_quantity, 0\)/i)
  assert.doesNotMatch(currentCostMigration, /v_recipe\.status is distinct from 'validee'/i)
})

test('new recipe versions copy a distinct dressing asset and the UI/export use TTC labels', () => {
  const versionBody = api.match(/async function createRecipeVersion[\s\S]*?return data as string/)?.[0] ?? ''
  assert.match(versionBody, /dressing_photo_path: null/)
  assert.match(api, /cloneRecipeDressingPhoto\(current\.dressing_photo_path, versionId\)/)
  assert.match(api, /\.copy\(sourcePath, targetPath\)/)
  for (const source of [form, detail, exports]) {
    assert.match(source, /Coût matière TTC/)
    assert.doesNotMatch(source, /Coût matière HT/i)
  }
  assert.match(form, /PV théorique TTC\/personne/)
  assert.match(detail, /PV théorique TTC\/personne/)
})
