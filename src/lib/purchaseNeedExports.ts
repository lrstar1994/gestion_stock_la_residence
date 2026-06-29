import * as XLSX from 'xlsx'
import { needOriginLabels, needStatusLabels, needUrgencyLabels } from './purchaseNeeds'
import type { PurchaseNeedGlobal } from './purchaseNeeds'

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

function rowsFromNeeds(needs: PurchaseNeedGlobal[]) {
  return needs.map((need) => ({
    Article: need.articles?.name || '',
    Famille: need.articles?.families?.name || '',
    Quantite: Number(need.quantity ?? need.quantity_needed ?? 0),
    Unite: need.units?.abbreviation || need.units?.name || '',
    Origine: needOriginLabels[need.origin],
    Urgence: needUrgencyLabels[need.urgency],
    'Prix estimatif': Number(need.estimated_price ?? 0),
    Budget: Number(need.budget ?? 0),
    'Cout estime': Number(need.estimated_cost ?? 0),
    Statut: needStatusLabels[need.status],
    Fournisseur: need.suppliers?.name || need.articles?.default_supplier || '',
    Demandeur: need.requester?.full_name || '',
    'Date creation': need.created_at ? new Date(need.created_at).toLocaleDateString('fr-FR') : '',
  }))
}

export function exportPurchaseNeedsGlobalToCsv(needs: PurchaseNeedGlobal[]) {
  const rows = rowsFromNeeds(needs)
  const headers = Object.keys(rows[0] ?? { Article: '', Famille: '', Quantite: '', Unite: '', Origine: '', Urgence: '', 'Prix estimatif': '', Budget: '', 'Cout estime': '', Statut: '', Fournisseur: '', Demandeur: '', 'Date creation': '' })
  const csv = [headers.map(csvEscape).join(';'), ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `besoins-achat-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportPurchaseNeedsGlobalToExcel(needs: PurchaseNeedGlobal[]) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rowsFromNeeds(needs))
  worksheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Besoins achat')
  XLSX.writeFile(workbook, `besoins-achat-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
