import * as XLSX from 'xlsx'
import { cashPurchaseSourceLabels, cashPurchaseStatusLabels } from './cashPurchases'
import type { CashPurchase } from './cashPurchases'

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function rows(purchases: CashPurchase[]) {
  return purchases.map((purchase) => ({
    Reference: purchase.reference,
    Date: purchase.request_date,
    Acheteur: purchase.buyer?.full_name || '',
    Caisse: cashPurchaseSourceLabels[purchase.cash_source],
    Motif: purchase.reason,
    'Montant demande': Number(purchase.amount_requested ?? 0),
    'Montant remis': Number(purchase.amount_given ?? 0),
    'Total achete': Number(purchase.total_purchased ?? 0),
    Ecart: Number(purchase.difference ?? 0),
    Statut: cashPurchaseStatusLabels[purchase.status],
  }))
}

export function exportCashPurchasesToCsv(purchases: CashPurchase[]) {
  const data = rows(purchases)
  const headers = Object.keys(data[0] ?? { Reference: '', Date: '', Acheteur: '', Caisse: '', Motif: '', 'Montant demande': '', 'Montant remis': '', 'Total achete': '', Ecart: '', Statut: '' })
  const csv = [headers.map(csvEscape).join(';'), ...data.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `achats-especes-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportCashPurchasesToExcel(purchases: CashPurchase[]) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows(purchases))
  worksheet['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Achats especes')
  XLSX.writeFile(workbook, `achats-especes-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
