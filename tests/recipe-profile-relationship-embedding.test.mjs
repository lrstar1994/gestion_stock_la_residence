import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('recipe profile embeds use only declared recipes foreign keys', async () => {
  const api = await readFile('src/api/modules/recipes.api.ts', 'utf8')
  const baseline = await readFile('supabase/migrations/20260727181326_baseline_auth_public_stock.sql', 'utf8')
  const workflow = await readFile('supabase/migrations/202609210005_recipe_workflow_validation_and_versioning.sql', 'utf8')
  const declared = new Set([
    ...[...baseline.matchAll(/CONSTRAINT\s+(recipes_[a-z0-9_]+_fkey)\s+FOREIGN KEY\s*\([^)]*\)\s+REFERENCES\s+stock\.profiles\(id\)/gi)].map((match) => match[1]),
    ...[...workflow.matchAll(/add column if not exists\s+([a-z0-9_]+)\s+uuid\s+references\s+stock\.profiles\(id\)/gi)].map((match) => `recipes_${match[1]}_fkey`),
  ])
  const hints = [...api.matchAll(/profiles!(recipes_[a-z0-9_]+_fkey)\(/g)].map((match) => match[1])
  assert.ok(hints.length > 0)
  for (const hint of hints) assert.ok(declared.has(hint), `Hint non déclaré : ${hint}`)
  assert.doesNotMatch(api, /recipes_(chef_validated_by|direction_validated_by)_fkey/)
})
