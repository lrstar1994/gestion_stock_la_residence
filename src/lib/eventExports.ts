import * as XLSX from 'xlsx'
import type { PurchaseNeed } from './events'
import { purchaseNeedStatusLabels } from './events'

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

function rowsFromNeeds(needs: PurchaseNeed[]) {
  return needs.map((need) => ({
    Fournisseur: need.articles?.default_supplier || 'Sans fournisseur',
    Article: need.articles?.name || '',
    Famille: need.articles?.families?.name || '',
    Quantite: Number(need.quantity_needed ?? 0),
    Unite: need.units?.abbreviation || need.units?.name || '',
    'Cout estime': Number(need.estimated_cost ?? 0),
    Statut: purchaseNeedStatusLabels[need.status],
  }))
}

export function exportPurchaseNeedsToCsv(needs: PurchaseNeed[], eventName: string) {
  const rows = rowsFromNeeds(needs)
  const headers = Object.keys(rows[0] ?? { Fournisseur: '', Article: '', Famille: '', Quantite: '', Unite: '', 'Cout estime': '', Statut: '' })
  const csv = [headers.map(csvEscape).join(';'), ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `besoins-achat-${safeFileName(eventName)}.csv`, 'text/csv;charset=utf-8')
}

export function exportPurchaseNeedsToExcel(needs: PurchaseNeed[], eventName: string) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rowsFromNeeds(needs))
  worksheet['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Besoins achat')
  XLSX.writeFile(workbook, `besoins-achat-${safeFileName(eventName)}.xlsx`)
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}
