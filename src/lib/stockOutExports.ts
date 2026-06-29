import * as XLSX from 'xlsx'
import { consumptionTypeLabels, stockOutDestinationLabels } from './stockOuts'
import type { ConsumptionAnalysisRow, StockOut } from './stockOuts'

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

export function exportStockOutsToExcel(rows: StockOut[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
    Reference: row.reference,
    Date: row.out_date,
    Article: row.articles?.name,
    Famille: row.articles?.families?.name,
    Quantite: Number(row.quantity ?? 0),
    Unite: row.units?.abbreviation,
    Localisation: row.locations?.name,
    Destination: stockOutDestinationLabels[row.destination],
    Motif: row.reason,
    Utilisateur: row.creator?.full_name,
    Statut: row.status,
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sorties')
  XLSX.writeFile(workbook, `sorties-stock-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportConsumptionAnalysisToExcel(rows: ConsumptionAnalysisRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
    Article: row.article_name,
    Famille: row.family_name,
    Destination: stockOutDestinationLabels[row.destination],
    Quantite: row.quantity,
    Theorique: row.theoretical_quantity,
    Ecart: row.difference,
    Cout: row.cost,
    Type: consumptionTypeLabels[row.consumption_type],
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Analyse')
  XLSX.writeFile(workbook, `analyse-consommation-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportStockOutsToCsv(rows: StockOut[]) {
  const data = rows.map((row) => ({
    Reference: row.reference,
    Date: row.out_date,
    Article: row.articles?.name,
    Quantite: Number(row.quantity ?? 0),
    Unite: row.units?.abbreviation,
    Destination: stockOutDestinationLabels[row.destination],
    Motif: row.reason,
  }))
  const headers = Object.keys(data[0] ?? { Reference: '', Date: '', Article: '', Quantite: '', Unite: '', Destination: '', Motif: '' })
  const csv = [headers.map(csvEscape).join(';'), ...data.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `sorties-stock-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}
