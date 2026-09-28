import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateRecipeTheoreticalSalePriceTtc, calculateRecipeTheoreticalSalePriceTtcPerPerson, recipeSchema } from '../src/lib/recipes.ts'

const sucreBlancDraft = {
  name: 'Brouillon SUCRE BLANC',
  type: 'PL' as const,
  sub_type: '',
  main_ingredient: 'MIX' as const,
  portions: 10,
  description: '',
  tags: [],
  margin_coefficient: 3,
  final_price: 0,
  status: 'brouillon' as const,
  ingredients: [{
    article_id: 'sucre-blanc-id',
    quantity: 1,
    unit_id: 'kg-unit-id',
    unit_price: 0,
    conversion_factor: null,
    quantity_mode: 'brut' as const,
    yield_percent_snapshot: undefined,
    trim_form_id: undefined,
    line_kind: 'article' as const,
    subrecipe_id: undefined,
    sort_order: 0,
  }],
  yield_mode: 'portions' as const,
  yield_quantity: 1,
  yield_unit_id: '',
  retained_sale_price_ttc: undefined,
  retained_sale_price_reason: '',
  dressing_photo_alt: '',
  steps: [],
}

test('the exact SUCRE BLANC draft UI payload passes the real Zod schema', () => {
  assert.equal(recipeSchema.safeParse(sucreBlancDraft).success, true)
})

test('NaN is rejected at the complete ingredient field path', () => {
  const result = recipeSchema.safeParse({
    ...sucreBlancDraft,
    ingredients: [{ ...sucreBlancDraft.ingredients[0], yield_percent_snapshot: Number.NaN }],
  })
  assert.equal(result.success, false)
  if (!result.success) assert.deepEqual(result.error.issues[0].path, ['ingredients', 0, 'yield_percent_snapshot'])
})

test('a real zero cost remains distinct from a missing NORMAL price', () => {
  assert.equal(calculateRecipeTheoreticalSalePriceTtc(0, 'portions', 10), 20000)
  assert.equal(calculateRecipeTheoreticalSalePriceTtcPerPerson(0, 'portions', 10), 2000)
})

test('the PORTIONS formula remains unchanged when an official cost is calculable', () => {
  assert.equal(calculateRecipeTheoreticalSalePriceTtc(1000, 'portions', 10), 24000)
  assert.equal(calculateRecipeTheoreticalSalePriceTtcPerPerson(1000, 'portions', 10), 2400)
})
