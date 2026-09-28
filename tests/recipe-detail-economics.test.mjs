import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const detail = await readFile(new URL('src/pages/recipes/RecipeDetail.tsx', root), 'utf8')

test('RecipeDetail gates all economics on complete official NORMAL costs', () => {
  assert.match(detail, /const hasIncompleteOfficialCost = articleIngredients\.some/)
  assert.match(detail, /calculateRecipeOperationalEconomics\(\s*hasIncompleteOfficialCost \? null : currentMaterialCost/s)
  assert.match(detail, /Coût matière TTC\/personne" value=\{economics\.costPerPortion == null \? 'Non calculable'/)
  assert.match(detail, /PV théorique TTC\/personne" value=\{recipe\.yield_mode === 'rendement_produit' \? 'Règle métier à définir' : economics\.theoreticalSalePriceTtcPerPerson == null \? 'Non calculable'/)
  assert.match(detail, /PV théorique TTC" value=\{recipe\.yield_mode === 'rendement_produit' \? 'Règle métier à définir' : economics\.theoreticalSalePriceTtcTotal == null \? 'Non calculable'/)
})

test('RecipeDetail distinguishes an absent NORMAL price from a true zero price', () => {
  assert.match(detail, /prices\.filter\(\(item\) => item\.normalized_unit_price != null\)/)
  assert.match(detail, /Object\.prototype\.hasOwnProperty\.call\(currentCosts, ingredient\.article_id\)/)
  assert.match(detail, /Prix NORMAL manquant/)
  assert.match(detail, /const hasFrozenCost = ingredient\.normalized_price_snapshot != null/)
  assert.doesNotMatch(detail, /const hasFrozenCost = ingredient\.normalized_price_snapshot != null \|\| ingredient\.economic_snapshot_at != null/)
})
