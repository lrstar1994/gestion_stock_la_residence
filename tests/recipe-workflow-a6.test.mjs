import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const migration = await readFile(new URL('supabase/migrations/202609210005_recipe_workflow_validation_and_versioning.sql', root), 'utf8')
const chefPinMigration = await readFile(new URL('supabase/migrations_hold/202609250002_recipe_chef_review_pin.sql', root), 'utf8')
const api = await readFile(new URL('src/api/modules/recipes.api.ts', root), 'utf8')
const lib = await readFile(new URL('src/lib/recipes.ts', root), 'utf8')
const detail = await readFile(new URL('src/pages/recipes/RecipeDetail.tsx', root), 'utf8')
const validationPage = await readFile(new URL('src/pages/recipes/RecipesToValidatePage.tsx', root), 'utf8')
const form = await readFile(new URL('src/pages/recipes/RecipeFormPage.tsx', root), 'utf8')

test('A6 reuses existing recipe status enum and maps corrections through workflow_status', () => {
  assert.doesNotMatch(migration, /alter type stock\.recipe_status/i)
  assert.match(migration, /status='brouillon',workflow_status='needs_correction'/)
})

test('submission is a server RPC and checks readiness before moving to submitted', () => {
  assert.match(api, /rpc\('submit_recipe_for_validation'/)
  assert.match(migration, /v_cost := stock\.assert_recipe_ready\(p_recipe_id\)/)
  assert.match(migration, /status='en_attente', workflow_status='submitted'/)
})

test('readiness covers identity, yield, ingredients, NET, procedure, prices and subrecipes', () => {
  for (const key of ['name', 'yield', 'ingredients', 'article_links', 'net_yields', 'procedure', 'prices', 'subrecipes', 'total_cost']) assert.match(lib, new RegExp(`key: '${key}'`))
})

test('missing NORMAL and non-normalizable NORMAL are distinct blockers without fallback', () => {
  assert.match(migration, /Prix NORMAL manquant/)
  assert.match(migration, /Prix NORMAL existant mais coût normalisé incomplet/)
  assert.doesNotMatch(migration, /coalesce\(p\.normalized_unit_price|last_purchase_price|estimated_price/i)
})

test('photo remains informative and nonblocking', () => {
  assert.match(lib, /key: 'dressing_photo'[\s\S]*ok: true/)
})

test('Chef review requires the active chef_cuisine profile and the additive Chef PIN RPC', () => {
  assert.match(migration, /v_role <> 'chef_cuisine'/)
  assert.match(chefPinMigration, /stock\.assert_sensitive_action/)
  assert.match(chefPinMigration, /p_pin text/)
})

test('Chef approval and mandatory correction reason are audited', () => {
  assert.match(migration, /'chef_validated'/)
  assert.match(migration, /Le motif de correction est obligatoire/)
  assert.match(migration, /'chef_returned'/)
})

test('Direction cannot finalize before Chef approval', () => {
  assert.match(migration, /workflow_status <> 'chef_validated'/)
  assert.match(migration, /La validation Chef est obligatoire avant la Direction/)
})

test('Direction review uses existing personal PIN sensitive action', () => {
  assert.match(migration, /assert_sensitive_action\('recipes\.final_validate',p_pin/)
  assert.match(detail, /SensitiveActionModal/)
  assert.match(detail, /getMyPinStatus/)
})

test('Direction correction requires a reason and returns to editable correction workflow', () => {
  assert.match(migration, /direction_returned/)
  assert.match(migration, /status='brouillon',workflow_status='needs_correction'/)
})

test('PORTIONS theoretical TTC uses cost times four plus 2000 per person', () => {
  assert.match(lib, /totalMaterialCost \* 4 \+ 2000 \* Math\.max\(0, peopleOrPortions\)/)
  assert.match(migration, /v_cost\*4\+2000\*v_recipe\.portions/)
})

test('RENDEMENT_PRODUIT exposes cost per yield and no invented theoretical sale price', () => {
  assert.match(lib, /yieldMode === 'rendement_produit'\) return null/)
  assert.match(migration, /else 0 end/)
  assert.match(detail, /Règle métier à définir/)
})

test('retained TTC price is Direction-only and persisted with author/date snapshot', () => {
  assert.doesNotMatch(form, /Prix TTC retenu \(optionnel\)/)
  assert.match(migration, /retained_sale_price_ttc=p_retained_price/)
  assert.match(migration, /direction_validated_by=v_actor,direction_validated_at=now\(\)/)
})

test('final validation snapshots latest NORMAL line prices and recipe totals', () => {
  assert.match(migration, /normalized_price_snapshot=p\.normalized_unit_price/)
  assert.match(migration, /validated_material_cost=v_cost/)
  assert.match(migration, /validated_snapshot_at=now\(\)/)
})

test('current and validated costs are shown separately', () => {
  assert.match(detail, /Coût matière TTC total actuel/)
  assert.match(detail, /Coût matière TTC total à la validation/)
})

test('submitted, validated and archived recipes are immutable through direct table writes', () => {
  assert.match(migration, /old\.status in \('en_attente','validee','archived'\)/)
  assert.match(migration, /validated_recipe_ingredient_mutation_guard/)
  assert.match(migration, /validated_recipe_step_mutation_guard/)
})

test('workflow transitions and validation history cannot be forged directly by authenticated', () => {
  assert.match(migration, /Les transitions de workflow doivent passer par les RPC officielles/)
  assert.match(migration, /revoke insert, update, delete on stock\.recipe_validation_history from authenticated/)
})

test('new version is a draft linked to its root and does not inherit validations', () => {
  const versionBody = api.match(/async function createRecipeVersion[\s\S]*?return data as string/)?.[0] ?? ''
  assert.match(versionBody, /rpc\('create_recipe_version'/)
  assert.doesNotMatch(versionBody, /replaceRecipeIngredients|replaceRecipeSteps|record_recipe_version_created|chef_validated_by|direction_validated_by|retained_sale_price_ttc/)
  assert.match(migration, /create or replace function stock\.create_recipe_version/)
  assert.match(migration, /parent_version_id, created_by, updated_by/)
  assert.match(migration, /null, null,[\s\S]*'brouillon', 'draft'/)
})

test('legacy BF remains readable but cannot be created through UI, API or DB', () => {
  assert.match(lib, /creatableRecipeTypes = recipeTypes\.filter\(\(type\) => type !== 'BF'\)/)
  assert.match(api, /type === 'BF'.*historique/s)
  assert.match(migration, /if new\.type = 'BF' then raise exception/)
})

test('archive uses Direction PIN, is audited and has no unarchive shortcut', () => {
  assert.match(migration, /create or replace function stock\.archive_recipe/)
  assert.match(migration, /'recipe\.archive'/)
  assert.match(migration, /'archived'/)
  assert.doesNotMatch(detail, /Desarchiver|ArchiveRestore/)
})

test('dedicated validation page provides Chef, Direction, correction and recent filters', () => {
  for (const label of ['Attente Chef', 'Attente Direction', 'À corriger', 'Validées récemment']) assert.match(validationPage, new RegExp(label))
  assert.match(validationPage, /À valider par Chef/)
  assert.doesNotMatch(validationPage, /Revoir comme Chef/)
  assert.match(validationPage, /canValidateRecipes/)
})

test('RPC ACL is authenticated-only and functions use hardened search paths', () => {
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog, stock, auth, extensions/i)
  assert.match(migration, /revoke all on function[\s\S]*from public,anon,authenticated/i)
  assert.match(migration, /grant execute on function[\s\S]*to authenticated/i)
})

test('draft editing stays available to existing recipe managers', () => {
  assert.match(api, /if \(current\.status === 'validee'\)/)
  assert.match(api, /current\.status === 'archived' \|\| current\.status === 'en_attente'/)
})

test('server readiness rejects an empty name and invalid final yield', () => {
  assert.match(migration, /Le nom de la fiche est obligatoire/)
  assert.match(migration, /Le nombre de portions est invalide/)
  assert.match(migration, /Le rendement produit est incomplet/)
})

test('resubmission clears obsolete Chef and Direction approvals', () => {
  assert.match(migration, /chef_validated_by=null, chef_validated_at=null, direction_validated_by=null, direction_validated_at=null/)
})

test('Direction review checks the active Direction role in addition to PIN permission', () => {
  assert.match(migration, /if not stock\.is_current_user_direction\(\)/)
})

test('retained price difference rationale is stored with the validated recipe', () => {
  assert.match(migration, /retained_sale_price_reason=nullif\(btrim\(p_reason\),''\)/)
})

test('legacy coefficient and 30 percent rules do not drive A6 theoretical TTC', () => {
  const directionBody = migration.match(/create or replace function stock\.direction_review_recipe[\s\S]*?end; \$\$;/i)?.[0] ?? ''
  assert.doesNotMatch(directionBody, /margin_coefficient|30\s*%|0\.30|\*\s*3\b/)
})

test('price refresh does not create a new recipe version', () => {
  assert.doesNotMatch(api.match(/getLastNormalActualPurchasePrices[\s\S]*?export async function listRecipeTrimForms/)?.[0] ?? '', /createRecipeVersion|parent_version_id/)
})

test('archived recipes are excluded from active subrecipe choices', () => {
  assert.match(form, /recipe\.status === 'validee' && recipe\.yield_mode === 'rendement_produit'/)
})

test('Fiches à valider is a dedicated route-backed page', () => {
  assert.match(validationPage, /export function RecipesToValidatePage/)
  assert.match(validationPage, /listRecipes\(\{ status: 'all'/)
})

test('RecipeDetail exposes all role-specific workflow actions', () => {
  for (const action of ['Soumettre pour validation', 'Valider comme Chef', 'Valider comme Direction', 'Renvoyer à corriger', 'Créer une nouvelle version', 'Archiver']) assert.match(detail, new RegExp(action))
})

test('recipe list exposes current economics and both validations', async () => {
  const list = await readFile(new URL('src/pages/recipes/RecipesList.tsx', root), 'utf8')
  for (const label of ['Coût actuel', 'PV théorique TTC', 'PV retenu TTC', 'Chef', 'Direction']) assert.match(list, new RegExp(label))
})

test('readiness helper itself is not executable by authenticated clients', () => {
  assert.match(migration, /revoke all on function stock\.assert_recipe_ready\(uuid\)[\s\S]*from public,anon,authenticated/)
})

test('workflow RPCs lock the recipe row before transition', () => {
  assert.ok((migration.match(/for update/g) ?? []).length >= 4)
})

test('all required workflow events are in the single validation history', () => {
  for (const event of ['submitted', 'chef_validated', 'chef_returned', 'direction_returned', 'final_validated', 'version_created', 'archived']) assert.match(migration, new RegExp(`'${event}'`))
})

test('A6 creates no OP, planning or Composition object', () => {
  assert.doesNotMatch(migration, /create table[^;]*(operation_order|production_plan|composition)/i)
})

test('A6 creates no stock movement or purchase mutation', () => {
  assert.doesNotMatch(migration, /insert into stock\.(stock_movements|purchase_needs|purchase_orders)/i)
})

test('only NORMAL purchase candidates participate in validation pricing', () => {
  assert.ok((migration.match(/classification\s*=\s*'normal'/g) ?? []).length >= 3)
  assert.doesNotMatch(migration, /classification\s+in\s*\([^)]*(promotional|exceptional)/i)
})

test('line snapshots retain source, date, normalized price and calculated line cost', () => {
  for (const field of ['normalized_price_snapshot', 'price_effective_at_snapshot', 'price_source_type', 'price_source_id', 'economic_snapshot_at']) assert.match(migration, new RegExp(field))
})

test('submission audit retains actor, timestamp on recipe and submitted version', () => {
  assert.match(migration, /submitted_by=v_actor, submitted_at=now\(\)/)
  assert.match(migration, /jsonb_build_object\('version',v_recipe\.version\)/)
})

test('correction returns retain author, timestamp and mandatory reason', () => {
  assert.match(migration, /correction_requested_by=v_actor,correction_requested_at=now\(\),correction_reason=btrim\(p_reason\)/)
})

test('archiving is non-destructive and keeps the recipe row', () => {
  const archiveBody = migration.match(/create or replace function stock\.archive_recipe[\s\S]*?end; \$\$;/i)?.[0] ?? ''
  assert.match(archiveBody, /update stock\.recipes set status='archived'/)
  assert.doesNotMatch(archiveBody, /delete from stock\.recipes/)
})
