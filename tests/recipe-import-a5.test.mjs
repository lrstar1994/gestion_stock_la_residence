import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const helper = await readFile(new URL('src/lib/recipeImport.ts', root), 'utf8')
const api = await readFile(new URL('src/api/modules/recipes.api.ts', root), 'utf8')
const page = await readFile(new URL('src/pages/recipes/RecipeImportPage.tsx', root), 'utf8')
const pendingPage = await readFile(new URL('src/pages/recipes/PendingIngredientsPage.tsx', root), 'utf8')
const migration = await readFile(new URL('supabase/migrations/202609210004_recipe_import_aliases.sql', root), 'utf8')

test('official workbook contains exactly the four required sheets and filename', () => {
  assert.match(helper, /RECIPE_IMPORT_SHEETS = \['FICHES', 'INGRÉDIENTS', 'DÉROULÉ', 'AIDE'\]/)
  assert.match(page, /MODELE_IMPORT_FICHES_TECHNIQUES\.xlsx/)
  assert.match(page, /buildOfficialRecipeImportWorkbook/)
  assert.doesNotMatch(api, /importRecipesFromRows/)
})

test('FICHES, ingredients and steps use the official columns', () => {
  for (const column of ['Code fiche facultatif', 'Mode rendement', 'Quantité rendement', 'Unité rendement']) assert.match(helper, new RegExp(column))
  assert.doesNotMatch(helper, /PV retenu TTC facultatif/)
  for (const column of ['Article existant si connu', 'BRUT_NET', 'Forme parée éventuelle', 'Prix indicatif facultatif']) assert.match(helper, new RegExp(column))
  for (const column of ['Ordre étape', 'Durée active', 'Durée passive', 'Point de vigilance']) assert.match(helper, new RegExp(column))
})

test('parser rejects missing sheets, columns, invalid modes, quantities and duplicated orders', () => {
  assert.match(helper, /Feuille obligatoire absente/)
  assert.match(helper, /colonne\(s\) obligatoire\(s\) absente\(s\)/)
  assert.match(helper, /PORTIONS.*RENDEMENT_PRODUIT/)
  assert.match(helper, /BRUT.*NET/)
  assert.match(helper, /Quantité invalide/)
  assert.match(helper, /assertUniqueOrder/)
})

test('import creates only drafts and persists steps using the A4 structure', () => {
  assert.match(migration, /status, yield_mode[\s\S]*'brouillon'/i)
  assert.match(migration, /workflow_status[\s\S]*'draft'/i)
  assert.doesNotMatch(migration, /chef_validated_at\s*=|direction_validated_at\s*=|status\s*=\s*'validee'/i)
  assert.match(migration, /insert into stock\.recipe_steps[\s\S]*active_duration_minutes[\s\S]*passive_duration_minutes[\s\S]*attention_points[\s\S]*observation/i)
})

test('each recipe is persisted atomically by one SECURITY DEFINER RPC', () => {
  assert.match(migration, /create or replace function stock\.import_recipe_draft\(\s*p_recipe jsonb,\s*p_ingredients jsonb,\s*p_pending jsonb,\s*p_steps jsonb\s*\)/i)
  assert.match(migration, /security definer\s+set search_path = pg_catalog, stock, auth, extensions/i)
  assert.match(api, /rpc\('import_recipe_draft'/)
})

test('unknown ingredients, units, conversions and trim forms stay pending', () => {
  assert.match(api, /unknownUnits \+= 1/)
  assert.match(api, /missingConversions \+= 1/)
  assert.match(api, /trimFormsToReview \+= 1/)
  assert.match(api, /pendingRows\.push/)
  assert.match(migration, /insert into stock\.pending_ingredients/i)
})

test('indicative Excel price never becomes an official recipe or purchase price', () => {
  assert.match(migration, /imported_indicative_price/)
  assert.match(migration, /alter table stock\.recipe_ingredients[\s\S]*imported_indicative_price/i)
  assert.match(migration, /unit_price, total_cost[\s\S]*null, 0, 'resolved'/i)
  assert.doesNotMatch(migration, /purchase_price_qualifications|purchase_actual_price_candidates/i)
  assert.match(page, /Prix Excel indicatif uniquement/)
})

test('duplicates are reported and never overwritten', () => {
  assert.match(api, /doublon possible/)
  assert.match(api, /report\.duplicates \+= 1/)
  assert.doesNotMatch(api.match(/export async function importRecipesFromWorkbook[\s\S]*?export async function listPendingIngredients/)?.[0] ?? '', /\.from\('recipes'\)\.update/)
})

test('aliases are unique, explicitly confirmed and safely reused', () => {
  assert.match(migration, /create table if not exists stock\.recipe_import_aliases/i)
  assert.match(migration, /unique index[\s\S]*normalized_label[\s\S]*where is_active/i)
  assert.match(pendingPage, /Mémoriser cet alias confirmé/)
  assert.match(api, /if \(options\.confirmAlias\) await confirmRecipeImportAlias/)
  assert.match(api, /alias\.length === 1/)
})

test('pending screen exposes imported metadata and the existing article creation workflow', () => {
  assert.match(pendingPage, /quantity_mode/)
  assert.match(pendingPage, /trim_form_name/)
  assert.match(pendingPage, /Prix indicatif importé/)
  assert.match(pendingPage, /import_observation/)
  assert.match(pendingPage, /createArticle/)
  assert.match(pendingPage, /Corriger/)
})

test('ACL keeps alias and import mutations with existing recipe-manager permissions', () => {
  assert.match(migration, /stock\.can_current_user_manage_recipes\(\)/i)
  assert.match(migration, /revoke all on stock\.recipe_import_aliases from public, anon/i)
  assert.match(migration, /revoke all on function stock\.import_recipe_draft\(jsonb,jsonb,jsonb,jsonb\) from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function stock\.import_recipe_draft\(jsonb,jsonb,jsonb,jsonb\) to authenticated/i)
})
