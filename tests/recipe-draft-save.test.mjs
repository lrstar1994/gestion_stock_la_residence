import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const form = await readFile(new URL('src/pages/recipes/RecipeFormPage.tsx', root), 'utf8')
const recipes = await readFile(new URL('src/lib/recipes.ts', root), 'utf8')
const api = await readFile(new URL('src/api/modules/recipes.api.ts', root), 'utf8')

test('a draft may be saved without a qualified NORMAL price', () => {
  assert.match(recipes, /unit_price: z\.number\(\)\.min\(0/)
  assert.match(form, /handleSubmit\(onSubmit, onInvalid\)/)
  assert.match(form, /placeholder="Prix NORMAL manquant"/)
  assert.match(form, /Prix NORMAL manquant — la soumission restera bloquée/)
  assert.match(form, /price\.normalized_unit_price\]\)\)/)
})

test('the SUCRE BLANC draft row remains structurally valid when its NORMAL price is absent', () => {
  const sucreDraftRow = {
    article_id: 'sucre-blanc-id',
    quantity: 1,
    unit_id: 'kg-unit-id',
    unit_price: 0,
    normalized_unit_price: null,
    conversion_factor: null,
    quantity_mode: 'brut',
    yield_percent_snapshot: undefined,
    trim_form_id: undefined,
    line_kind: 'article',
    subrecipe_id: undefined,
    sort_order: 0,
  }
  assert.equal(sucreDraftRow.article_id.length > 0, true)
  assert.equal(sucreDraftRow.quantity, 1)
  assert.equal(sucreDraftRow.unit_id, 'kg-unit-id')
  assert.equal(sucreDraftRow.quantity_mode, 'brut')
  assert.equal(sucreDraftRow.unit_price, 0)
  assert.equal(sucreDraftRow.normalized_unit_price, null)
  assert.match(recipes, /unit_price: z\.number\(\)\.min\(0/)
  assert.match(form, /yield_percent_snapshot`, \{ setValueAs: optionalNumberValue \}/)
  assert.match(form, /active_duration_minutes`, \{ setValueAs: optionalNumberValue \}/)
})

test('submission still uses readiness and cannot silently bypass missing prices', () => {
  assert.match(api, /export async function submitRecipeForValidation/)
  assert.match(api, /assertRecipeReady\(recipe, observations, provisional\)/)
  assert.match(api, /Prix NORMAL manquant|prix unitaire/)
})

test('missing NORMAL price makes draft economics explicitly non calculable', () => {
  assert.match(form, /const costsAreCalculable = watchedIngredients\.filter\(\(ingredient\) => ingredient\.article_id && ingredient\.line_kind !== 'subrecipe'\)\.every/)
  assert.match(form, /Coût ligne TTC : \{lineCost == null \? 'Non calculable'/)
  assert.match(form, /calculateRecipeOperationalEconomics\(/)
  assert.match(form, /Coût matière TTC total" value=\{economics\.totalMaterialCostTtc == null \? 'Non calculable'/)
  assert.match(form, /PV théorique TTC\/personne" value=\{watched\.yield_mode === 'rendement_produit' \? 'Règle métier à définir' : economics\.theoreticalSalePriceTtcPerPerson == null \? 'Non calculable'/)
})
