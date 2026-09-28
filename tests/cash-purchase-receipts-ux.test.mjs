import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const detail = await readFile(new URL('../src/pages/cash-purchases/CashPurchaseDetail.tsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/api/modules/cashPurchases.api.ts', import.meta.url), 'utf8')

test('one global editable supplier-paid amount is shared with final PIN control and receipt totals', () => {
  const inputs = detail.match(/<NumericEntry[^>]*value=\{amountPaidSupplier\}[^>]*\/>/g) ?? []
  assert.equal(inputs.length, 1)
  assert.match(detail, /Justificatifs de l'achat[\s\S]*?NumericEntry value=\{amountPaidSupplier\}/)
  assert.match(detail, /amount_paid_supplier: amountPaidSupplier/)
  assert.match(detail, /Number\(amountPaidSupplier \?\? 0\) - totalReceiptAmount/)
  assert.match(detail, /Number\(amountPaidSupplier \?\? 0\)\.toLocaleString\('fr-FR'\)/)
})

test('supplier-paid amount remains a frontend draft until PIN control succeeds', () => {
  const saveReturn = api.match(/export async function saveCashPurchaseReturn\([\s\S]*?\n\}/)?.[0]
  assert.ok(saveReturn)
  assert.doesNotMatch(saveReturn, /amount_paid_supplier/)
  assert.match(detail, /saveCashPurchaseReturn\(purchase\.id, items, changeReturned, profile\?\.id, overrunReason, overrunPayer\)/)
  assert.match(detail, /const payload = \{[\s\S]*?amount_paid_supplier: amountPaidSupplier/)
  assert.match(detail, /receiveAndControlCashPurchase\(purchase\.id, payload, pin\)/)
  assert.match(detail, /await load\(\{ preserveAmountPaidSupplier: true \}\)/)
})

test('receipt mutations refresh persisted receipts without overwriting the unsaved control draft', () => {
  assert.match(detail, /if \(!options\.preserveControlDraft\) \{[\s\S]*?setItems\(loaded\.cash_purchase_items \?\? \[\]\)[\s\S]*?setChangeReturned\([\s\S]*?setAmountReturnedToController\(/)
  assert.match(detail, /if \(!options\.preserveControlDraft && !options\.preserveAmountPaidSupplier\) \{[\s\S]*?setAmountPaidSupplier\(/)

  const addReceipt = detail.match(/const addJustificatif = async \(\) => \{[\s\S]*?\n  \}/)?.[0]
  const cancelReceipt = detail.match(/const cancelReceipt = async \(receiptId: string\) => \{[\s\S]*?\n  \}/)?.[0]
  assert.ok(addReceipt)
  assert.ok(cancelReceipt)
  assert.match(addReceipt, /await load\(\{ preserveControlDraft: true \}\)/)
  assert.match(cancelReceipt, /await load\(\{ preserveControlDraft: true \}\)/)
})

test('new image and PDF files have an in-page preview modal without losing the form', () => {
  assert.match(detail, /URL\.createObjectURL\(receiptFile\)/)
  assert.match(detail, /URL\.revokeObjectURL\(objectUrl\)/)
  assert.match(detail, /Image prête à enregistrer/)
  assert.match(detail, /PDF prêt à enregistrer/)
  assert.match(detail, /role="dialog" aria-modal="true"/)
  assert.match(detail, /<iframe title=\{`PDF/)
  assert.match(detail, /onClick=\{\(\) => setActiveReceiptPreview\(null\)\}/)
  assert.match(detail, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/)
})

test('saved receipt preview re-signs through the existing private Storage bucket and never links the stored URL directly', () => {
  assert.match(detail, /openSavedReceiptPreview\(receipt\)/)
  assert.match(detail, /N° fournisseur : \{receipt\.supplier_document_number/)
  assert.match(detail, /Ligne\(s\) couverte\(s\)/)
  assert.match(detail, />Aperçu<\/button>/)
  assert.match(detail, />Annuler<\/button>/)
  assert.doesNotMatch(detail, /href=\{receipt\.file_url\}/)
  assert.match(api, /getCashPurchaseReceiptPreviewUrl\(fileUrl: string\)/)
  assert.match(api, /createSignedUrl\(objectPath, 60 \* 5\)/)
  assert.match(api, /cash-purchase-receipts/)
})
