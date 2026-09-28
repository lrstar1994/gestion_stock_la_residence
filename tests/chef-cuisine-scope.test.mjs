import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const tasks = await readFile(new URL('../src/api/modules/tasks.api.ts', import.meta.url), 'utf8')
const validationPage = await readFile(new URL('../src/pages/recipes/RecipesToValidatePage.tsx', import.meta.url), 'utf8')
const detail = await readFile(new URL('../src/pages/recipes/RecipeDetail.tsx', import.meta.url), 'utf8')
const chefPinMigration = await readFile(new URL('../supabase/migrations_hold/202609250002_recipe_chef_review_pin.sql', import.meta.url), 'utf8')

test('Chef cuisine tasks are scoped to purchase/reception work', () => {
  assert.match(tasks, /role === 'chef_cuisine'\s*\?\s*tasks\.filter\(\(task\) => task\.category === 'achats' \|\| task\.category === 'receptions'\)/)
  assert.doesNotMatch(tasks, /if \(\['direction', 'chef_cuisine', 'fiche_technique'\]\)/)
})

test('Chef validation uses the métier label consistently', () => {
  assert.match(validationPage, /workflow_status === 'submitted'\) return 'À valider par Chef'/)
  assert.doesNotMatch(validationPage, /Revoir comme Chef/)
  assert.match(detail, /workflowActionLabel = recipe\.workflow_status === 'submitted'\s*\?\s*'À valider par Chef'/)
  assert.match(detail, /recipe\.workflow_status === 'submitted' \? 'À valider par Chef'/)
  assert.match(detail, />Valider comme Chef<\/button>/)
})

test('Chef validation requires a personal PIN in UI and RPC', () => {
  assert.match(detail, /setSensitiveAction\('chef_validate'\)/)
  assert.match(detail, /setSensitiveAction\('chef_return'\)/)
  assert.match(detail, /permissionLabel=\{sensitiveAction === 'chef_validate' \|\| sensitiveAction === 'chef_return' \? 'recipes\.chef_review'/)
  assert.match(chefPinMigration, /assert_sensitive_action\(/)
  assert.match(chefPinMigration, /p\.role = 'chef_cuisine'::stock\.user_role/)
  assert.match(chefPinMigration, /p\.status = 'active'::stock\.user_status/)
  assert.match(chefPinMigration, /p_pin text/)
  assert.match(chefPinMigration, /revoke all on function stock\.chef_review_recipe\(uuid, boolean, text\)/)
  assert.match(chefPinMigration, /grant execute on function stock\.chef_review_recipe\(uuid, boolean, text, text\)/)
})
