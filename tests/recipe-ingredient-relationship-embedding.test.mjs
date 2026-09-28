import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const files = [
  'src/api/modules/recipes.api.ts',
  'src/api/modules/events.api.ts',
  'src/api/modules/stock.api.ts',
]

test('all recipe ingredient embeds select the composition FK explicitly', async () => {
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /recipe_ingredients\((?!\?)/)
    assert.match(source, /recipe_ingredients!recipe_ingredients_recipe_id_fkey\(/)
  }
})

test('the two recipe foreign keys retain distinct meanings', async () => {
  const migration = await readFile('supabase/migrations/202609210001_recipe_workflow_foundation.sql', 'utf8')
  const baseline = await readFile('supabase/migrations/20260727181326_baseline_auth_public_stock.sql', 'utf8')
  assert.match(baseline, /recipe_ingredients_recipe_id_fkey foreign key \(recipe_id\) references stock\.recipes\(id\)/i)
  assert.match(migration, /recipe_ingredients_subrecipe_id_fkey foreign key \(subrecipe_id\) references stock\.recipes\(id\)/i)
})
