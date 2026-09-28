import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const form = await readFile(new URL('../src/pages/recipes/RecipeFormPage.tsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/api/modules/recipes.api.ts', import.meta.url), 'utf8')

test('the FT form does not preload a 1000-row article selector', () => {
  assert.doesNotMatch(form, /listArticles\(\{ status: 'active', pageSize: 1000, usableInRecipes: true \}\)/)
  assert.match(form, /placeholder="Rechercher un article"/)
  assert.doesNotMatch(form, /Saisissez au moins 3 caractères\./)
})

test('the FT form persists meaningful drafts and routes them to their existing edit screen', () => {
  assert.match(form, /isRecipeDraftMeaningful\(watched\.name\)/)
  assert.match(form, /await createRecipe\(parsed\.data, profile\?\.id\)/)
  assert.match(form, /navigate\(`\/recipes\/\$\{recipeId\}\/edit`, \{ replace: true \}\)/)
})

test('article search retains the existing active and usable-in-recipes eligibility rule without a price filter', () => {
  assert.match(api, /listArticles\(\{ status: 'active', usableInRecipes: true, search, page: 1, pageSize: limit \}\)/)
  assert.doesNotMatch(api, /getLastNormalActualPurchasePrices\(search/)
})

test('selected ingredient closes the suggestions until the user clears or searches again', () => {
  assert.match(form, /const \[isOpen, setIsOpen\] = useState\(false\)/)
  assert.match(form, /if \(selectedArticleId && query === selectedArticleName\)/)
  assert.match(form, /setResults\(\[\]\); setIsOpen\(false\)/)
  assert.match(form, /onBlur=\{\(\) => \{ window\.setTimeout\(\(\) => setIsOpen\(false\), 100\) \}\}/)
  assert.match(form, /setQuery\(''\); setResults\(\[\]\); setIsOpen\(true\); onClear\(\)/)
})
