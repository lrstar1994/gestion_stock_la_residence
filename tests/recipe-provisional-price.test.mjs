import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/202609230002_recipe_provisional_ingredient_prices.sql', 'utf8')
const form = fs.readFileSync('src/pages/recipes/RecipeFormPage.tsx', 'utf8')
const detail = fs.readFileSync('src/pages/recipes/RecipeDetail.tsx', 'utf8')

test('prix provisoire: persistence append-only and controlled write', () => {
  assert.match(migration, /create table if not exists stock\.recipe_ingredient_provisional_prices/)
  assert.match(migration, /amount_ttc numeric\(14,2\) not null check \(amount_ttc >= 0\)/)
  assert.match(migration, /normalized_amount_ttc numeric\(14,4\)/)
  assert.match(migration, /normalized_unit_id uuid/)
  assert.match(migration, /conversion_factor_to_stock numeric/)
  assert.match(migration, /record_recipe_ingredient_provisional_price\(/)
  assert.match(migration, /stock\.can_current_user_manage_recipes\(\)/)
  assert.match(migration, /classification = 'normal'/)
})

test('prix NORMAL reste prioritaire et provisional est visible comme travail', () => {
  assert.match(form, /Object\.prototype\.hasOwnProperty\.call\(officialPrices, ingredient\.article_id\)/)
  assert.match(form, /Prix provisoire utilisé/)
  assert.match(detail, /Prix provisoire de travail — non qualifié Achats/)
  assert.match(detail, /official\?\.normalized_unit_price \?\? \(official == null/)
})

test('Chef peut travailler avec provisional et le workflow conserve les contrôles structurels', () => {
  assert.match(migration, /assert_recipe_ready_for_draft/)
  assert.match(migration, /chef_review_recipe[\s\S]*assert_recipe_ready_for_draft/)
  assert.match(migration, /workflow_status='submitted'/)
})

test('prix provisoire normalisé : coût impossible sans conversion et sous-recettes conservées', () => {
  assert.match(migration, /p_normalized_amount_ttc/)
  assert.match(migration, /p_conversion_factor_to_stock/)
  assert.match(migration, /normalized_amount_ttc is null then return null/i)
  assert.match(migration, /current_recipe_material_cost\(v_ingredient\.subrecipe_id\)/)
  assert.match(migration, /normalized_amount_ttc is not null/)
})

test('la saisie locale convertit le prix source vers l’unité stock', () => {
  assert.match(form, /getUnitConversionFactor\(sourceUnit, stockUnit\)/)
  assert.match(form, /const normalizedAmount = amount \/ conversionFactor/)
  assert.match(form, /recordRecipeIngredientProvisionalPrice\(id, articleId, amount, unitId, normalizedAmount, stockUnit\.id, conversionFactor/)
})

test('le coût utilise la quantité stockée, conserve les sous-recettes et remplace le provisoire par NORMAL', () => {
  assert.match(migration, /v_ingredient\.quantity_stored \* v_normal\.normalized_unit_price/)
  assert.match(migration, /v_ingredient\.quantity_stored \* v_provisional\.normalized_amount_ttc/)
  assert.match(migration, /current_recipe_material_cost\(v_ingredient\.subrecipe_id\)/)
  assert.match(migration, /classification\s*=\s*'normal' and c\.normalized_unit_price is not null/)
  assert.match(migration, /uses_provisional_price.*normalized_amount_ttc is not null/)
})
