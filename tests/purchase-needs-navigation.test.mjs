import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/pages/purchase-needs/PurchaseNeedsList.tsx', import.meta.url), 'utf8')
const apiSource = await readFile(new URL('../src/api/modules/purchaseNeeds.api.ts', import.meta.url), 'utf8')
const validation = await readFile(new URL('../src/pages/validations/MyValidationsPage.tsx', import.meta.url), 'utf8')
const tasks = await readFile(new URL('../src/api/modules/tasks.api.ts', import.meta.url), 'utf8')
const form = await readFile(new URL('../src/pages/purchase-needs/PurchaseNeedFormPage.tsx', import.meta.url), 'utf8')

test('Purchase needs use the intended-use foreign-key relationship explicitly', () => {
  assert.match(apiSource, /purchase_intended_uses!purchase_needs_intended_use_id_fkey\(id, code, label\)/)
})

test('Open targets the existing focused purchase-need route', () => {
  assert.match(source, /to=\{`\/purchase-needs\?focus=\$\{need\.id\}`\}/)
})

test('a focused need is loaded by its ID, highlighted, and scrolled into view', () => {
  assert.match(source, /if \(focusId\) return \{ id: focusId, status: 'all' as const, page: 1, pageSize: 1 \}/)
  assert.match(source, /needRowRefs\.current\.get\(focusId\)/)
  assert.match(source, /row\.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/)
  assert.match(source, /Besoin ciblé/)
})

test('purchase need rows show the full justification and business context', () => {
  assert.match(source, /whitespace-pre-wrap break-words text-sm font-medium text-slate-800/) 
  assert.match(source, /need\.justification\?\.trim\(\) \|\| 'Justification non renseignée'/)
  assert.match(source, /Utilisation : \{getPurchaseNeedIntendedUseLabel\(need\)\}/)
})

test('Direction validation cards show identity, date, origin, intended use and amount', () => {
  assert.match(validation, /Date de demande :/)
  assert.match(validation, /businessOriginLabels\[need\.business_origin\]/)
  assert.match(validation, /getPurchaseNeedIntendedUseLabel\(need\)/)
  assert.match(validation, /need\.justification\?\.trim\(\)/)
  assert.match(validation, /estimated_payable_amount/)
  assert.match(validation, /purchase-need-validation-\$\{need\.id\}/)
})

test('Direction tasks link to the exact decision in Mes validations without duplicate task IDs', () => {
  assert.match(tasks, /listPurchaseNeedsGlobal\(\{ status: 'a_faire'/)
  assert.match(tasks, /purchase-need-decision-\$\{need\.id\}/)
  assert.match(tasks, /\/validations\/my\?focus=\$\{need\.id\}/)
})

test('the creation form preserves the requester justification verbatim', () => {
  assert.match(form, /Justification du besoin/) 
  assert.match(form, /Pour mariage du 12\/08/)
})
