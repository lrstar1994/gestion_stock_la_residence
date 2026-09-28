import assert from 'node:assert/strict'
import test from 'node:test'
import { canSearchRecipeArticles, filterRecipeArticleSearchResults, isRecipeDraftMeaningful, normalizeRecipeArticleSearch, shouldReplaceInitialNumericValue } from '../src/lib/recipeFormUx.ts'

test('an untouched initial quantity is selected for replacement, while a persisted value is preserved', () => {
  assert.equal(shouldReplaceInitialNumericValue('1', 1, false), true)
  assert.equal(shouldReplaceInitialNumericValue('0.25', 1, false), false)
  assert.equal(shouldReplaceInitialNumericValue('1', 1, true), false)
})

test('a draft starts only after a meaningful recipe name, never merely when the page opens', () => {
  assert.equal(isRecipeDraftMeaningful(''), false)
  assert.equal(isRecipeDraftMeaningful('   '), false)
  assert.equal(isRecipeDraftMeaningful('Gâteau test'), true)
})

test('recipe article search is available immediately and normalizes accents', () => {
  assert.equal(canSearchRecipeArticles(''), true)
  assert.equal(canSearchRecipeArticles('f'), true)
  assert.equal(canSearchRecipeArticles('fa'), true)
  assert.equal(canSearchRecipeArticles('far'), true)
  assert.equal(normalizeRecipeArticleSearch('FARINÉ'), 'farine')
  assert.deepEqual(filterRecipeArticleSearchResults([{ name: 'FARINE LAFARINA 50 KG' }, { name: 'SUCRE BLANC' }], 'far').map((article) => article.name), ['FARINE LAFARINA 50 KG'])
  assert.deepEqual(filterRecipeArticleSearchResults([{ name: 'SUCRE BLANC' }, { name: 'SUCRE ROUX' }], 'suc').map((article) => article.name), ['SUCRE BLANC', 'SUCRE ROUX'])
})
