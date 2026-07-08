import * as XLSX from 'xlsx'
import { needCalculationSourceLabels, needDestinationLabels, needStatusLabels, needTypeLabels, needUrgencyLabels, requestingServiceLabels } from './purchaseNeeds'
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
    'Type de besoin': needTypeLabels[need.type_de_besoin ?? 'besoin_ponctuel'],
    'Destination prevue': needDestinationLabels[need.destination_prevue ?? 'stock_general'],
    'Source du calcul': needCalculationSourceLabels[need.source_du_calcul ?? 'saisie_manuelle'],
    'Service demandeur': requestingServiceLabels[need.service_demandeur ?? 'cuisine'],
    Urgence: needUrgencyLabels[need.urgency],
    'Prix saisi': Number(need.price_input_amount ?? need.estimated_price ?? 0),
    'Prix saisi HT': need.price_input_is_tax_excluded === false ? 'Non' : 'Oui',
    'TVA %': Number(need.vat_rate ?? 20),
    'Prix retenu HT': Number(need.estimated_price ?? 0),
    'TVA estimee': Number(need.estimated_vat_amount ?? 0),
    'Prix TTC estime': Number(need.estimated_price_ttc ?? 0),
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
  const headers = Object.keys(rows[0] ?? { Article: '', Famille: '', Quantite: '', Unite: '', 'Type de besoin': '', 'Destination prevue': '', 'Source du calcul': '', 'Service demandeur': '', Urgence: '', 'Prix saisi': '', 'Prix saisi HT': '', 'TVA %': '', 'Prix retenu HT': '', 'TVA estimee': '', 'Prix TTC estime': '', Budget: '', 'Cout estime': '', Statut: '', Fournisseur: '', Demandeur: '', 'Date creation': '' })
  const csv = [headers.map(csvEscape).join(';'), ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `besoins-achat-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportPurchaseNeedsGlobalToExcel(needs: PurchaseNeedGlobal[]) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rowsFromNeeds(needs))
  worksheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 26 }, { wch: 30 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Besoins achat')
  XLSX.writeFile(workbook, `besoins-achat-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
