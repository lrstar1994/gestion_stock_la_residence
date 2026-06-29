import * as XLSX from 'xlsx'
import {
  salesChannelLabels,
  salesPointLabels,
  salesStatusLabels,
  serviceModeLabels,
} from './sales'
import type { Sale, SaleStatsRow } from './sales'

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

export function exportSalesToExcel(rows: Sale[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map((sale) => ({
    Reference: sale.reference,
    Date: new Date(sale.sale_date).toLocaleString('fr-FR'),
    Canal: salesChannelLabels[sale.channel],
    Service: serviceModeLabels[sale.service_mode],
    'Point de vente': salesPointLabels[sale.sales_point],
    Client: sale.client_name ?? '',
    Articles: sale.sale_items?.length ?? 0,
    Total: Number(sale.total_after_discount ?? 0),
    Statut: salesStatusLabels[sale.status],
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventes')
  XLSX.writeFile(workbook, `ventes-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportSalesToCsv(rows: Sale[]) {
  const data = rows.map((sale) => ({
    Reference: sale.reference,
    Date: new Date(sale.sale_date).toLocaleString('fr-FR'),
    Canal: salesChannelLabels[sale.channel],
    Service: serviceModeLabels[sale.service_mode],
    Point: salesPointLabels[sale.sales_point],
    Client: sale.client_name ?? '',
    Total: Number(sale.total_after_discount ?? 0),
    Statut: salesStatusLabels[sale.status],
  }))
  const headers = Object.keys(data[0] ?? { Reference: '', Date: '', Canal: '', Service: '', Point: '', Client: '', Total: '', Statut: '' })
  const csv = [headers.map(csvEscape).join(';'), ...data.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `ventes-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportSalesStatsToExcel(rows: SaleStatsRow[], name = 'statistiques-ventes') {
  const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
    Libelle: row.label,
    Quantite: row.quantity,
    "Chiffre d'affaires": row.revenue,
    'Prix moyen': row.averagePrice,
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Statistiques')
  XLSX.writeFile(workbook, `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
