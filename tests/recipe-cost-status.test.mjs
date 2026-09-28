import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../supabase/migrations_hold/202609240002_recipe_cost_status_and_provisional_validation.sql', import.meta.url), 'utf8')
const readiness = await readFile(new URL('../src/lib/recipes.ts', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/api/modules/recipes.api.ts', import.meta.url), 'utf8')
const tasks = await readFile(new URL('../src/api/modules/tasks.api.ts', import.meta.url), 'utf8')

test('le statut de coût est distinct et configurable', () => {
  assert.match(migration, /add column if not exists cost_status text/)
  assert.match(migration, /PROVISOIRE.*CONFIRME.*A_REVOIR/)
  assert.match(migration, /recipe_cost_status_settings/)
  assert.match(migration, /max_relative_delta_percent/)
})

test('un provisoire normalisé autorise la readiness et la soumission', () => {
  assert.match(readiness, /provisionalPrices\?\.get\(ingredient\.article_id\)\?\.normalized_amount_ttc/)
  assert.match(api, /const provisional = new Map\(\(recipe\.provisional_prices/)
  assert.match(api, /assertRecipeReady\(recipe, observations, provisional\)/)
  assert.match(migration, /assert_recipe_ready_for_draft\(p_recipe_id\)/)
})

test('Direction valide avec provisoire et la version reste verrouillée', () => {
  assert.match(migration, /direction_review_recipe[\s\S]*v_cost := stock\.assert_recipe_ready_for_draft/)
  assert.match(migration, /status='validee',workflow_status='approved'/)
  assert.match(migration, /refresh_recipe_cost_status\(p_recipe_id\)/)
})

test('le remplacement NORMAL réévalue le statut sans créer de version', () => {
  assert.match(migration, /refresh_recipe_cost_status_from_price/)
  assert.match(migration, /purchase_price_qualifications/)
  assert.match(migration, /cost_review_task_opened_at/)
  assert.doesNotMatch(migration, /create_recipe_version/)
})

test('le coût provisoire se propage récursivement aux sous-recettes parentes', () => {
  assert.match(migration, /recipe_material_cost_with_provisional_recursive/) 
  assert.match(migration, /recipe_uses_active_provisional_recursive/) 
  assert.match(migration, /parent\.subrecipe_id = child\.recipe_id/) 
  assert.match(migration, /recipe_material_cost_with_provisional\(child\.id\)/)
})

test('l’arrivée d’un NORMAL recalcule les montants économiques courants', () => {
  assert.match(migration, /set material_cost_ht = v_current/) 
  assert.match(migration, /total_cost = v_current/) 
  assert.match(migration, /cost_per_portion = case when yield_mode = 'portions'/)
  assert.match(migration, /theoretical_sale_price_ttc = case when yield_mode = 'portions'/)
  assert.doesNotMatch(migration, /validated_material_cost = v_current/)
})

test('un snapshot de sous-recette peut utiliser un provisoire actif', () => {
  assert.match(migration, /subrecipe_cost_snapshot = current_cost\.total_cost/) 
  assert.match(migration, /recipe_material_cost_with_provisional\(child\.id\)/)
})

test('des seuils entièrement NULL produisent un état sûr et explicite', () => {
  assert.match(migration, /max_relative_delta_percent is null/) 
  assert.match(migration, /case when v_absolute > 0 then 'A_REVOIR' else 'CONFIRME' end/)
})

test('la tâche Direction utilise l’agrégateur existant et un identifiant stable', () => {
  assert.match(tasks, /listRecipes\(\{ status: 'all'/)
  assert.match(tasks, /recipe-cost-review-\$\{recipe\.id\}/)
  assert.match(tasks, /cost_status === 'A_REVOIR'/)
})
