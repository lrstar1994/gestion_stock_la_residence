import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const validations = await readFile(new URL('src/pages/validations/MyValidationsPage.tsx', root), 'utf8')
const recipeList = await readFile(new URL('src/pages/recipes/RecipesList.tsx', root), 'utf8')
const toValidate = await readFile(new URL('src/pages/recipes/RecipesToValidatePage.tsx', root), 'utf8')
const detail = await readFile(new URL('src/pages/recipes/RecipeDetail.tsx', root), 'utf8')
const lib = await readFile(new URL('src/lib/recipes.ts', root), 'utf8')

test('Direction validations include only Chef-approved recipes awaiting Direction', () => {
  assert.match(validations, /recipe\.status === 'en_attente' && recipe\.workflow_status === 'chef_validated' && !recipe\.direction_validated_at/)
  assert.match(validations, /to: `\/recipes\/\$\{recipe\.id\}`/)
  assert.match(validations, /type: 'Fiche technique'/)
})

test('recipe lists expose workflow and cost statuses separately', () => {
  assert.match(recipeList, /getRecipeWorkflowLabel\(recipe\)/)
  assert.match(recipeList, /getRecipeCostStatusLabel\(recipe\.cost_status\)/)
  assert.match(toValidate, /getRecipeWorkflowLabel\(recipe\)/)
})

test('recipe detail exposes validated and locked state', () => {
  assert.match(detail, /Version validée par la Direction et verrouillée/)
  assert.match(detail, /label="Verrouillage"/)
  assert.match(detail, /getRecipeCostStatusLabel\(recipe\.cost_status\)/)
})

test('workflow labels cover the official métier states', () => {
  for (const label of ['Validée par Direction', 'À valider par Chef', 'À valider par Direction', 'À corriger']) {
    assert.match(lib, new RegExp(label))
  }
})
