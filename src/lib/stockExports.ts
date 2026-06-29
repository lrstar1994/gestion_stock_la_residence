import * as XLSX from 'xlsx'
import { movementTypeLabels, priceSourceLabels } from './stock'
import type { PriceHistoryRow, StockMovement, StockRow } from './stock'

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

export function exportStockToExcel(rows: StockRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
    Article: row.articles?.name,
    Famille: row.articles?.families?.name,
    Quantite: Number(row.total_quantity ?? 0),
    Unite: row.articles?.units?.abbreviation,
    'Stock minimum': row.articles?.min_stock,
    'Dernier prix': Number(row.last_price ?? 0),
    'Prix moyen': Number(row.average_price ?? 0),
    Localisations: row.locations?.map((location) => `${location.location_name}: ${location.quantity}`).join(' | '),
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock')
  XLSX.writeFile(workbook, `stock-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportMovementsToCsv(movements: StockMovement[]) {
  const rows = movements.map((movement) => ({
    Reference: movement.movement_reference,
    Date: movement.movement_date,
    Type: movementTypeLabels[movement.movement_type],
    Article: movement.articles?.name,
    Quantite: Number(movement.quantity ?? 0),
    Unite: movement.units?.abbreviation,
    Origine: movement.from_location?.name ?? '',
    Destination: movement.to_location?.name ?? '',
    'Cout unitaire': Number(movement.unit_cost ?? 0),
    'Cout total': Number(movement.total_cost ?? 0),
    Utilisateur: movement.creator?.full_name,
    Observation: movement.comment ?? '',
  }))
  const headers = Object.keys(rows[0] ?? { Reference: '', Date: '', Type: '', Article: '', Quantite: '', Unite: '', Origine: '', Destination: '', 'Cout unitaire': '', 'Cout total': '', Utilisateur: '', Observation: '' })
  const csv = [headers.map(csvEscape).join(';'), ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `journal-stock-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportMovementsToExcel(movements: StockMovement[]) {
  const worksheet = XLSX.utils.json_to_sheet(movements.map((movement) => ({
    Reference: movement.movement_reference,
    Date: movement.movement_date,
    Type: movementTypeLabels[movement.movement_type],
    Article: movement.articles?.name,
    Quantite: Number(movement.quantity ?? 0),
    Unite: movement.units?.abbreviation,
    Origine: movement.from_location?.name ?? '',
    Destination: movement.to_location?.name ?? '',
    'Source prix': priceSourceLabels[movement.price_source],
    'Cout unitaire': Number(movement.unit_cost ?? 0),
    'Cout total': Number(movement.total_cost ?? 0),
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Journal')
  XLSX.writeFile(workbook, `journal-stock-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportPriceHistoryToCsv(rows: PriceHistoryRow[]) {
  const data = rows.map((row) => ({
    Date: row.movement_date,
    Reference: row.movement_reference,
    Quantite: Number(row.quantity ?? 0),
    Prix: Number(row.unit_cost ?? 0),
    Source: priceSourceLabels[row.price_source],
    Lien: row.reference_type ?? '',
  }))
  const headers = Object.keys(data[0] ?? { Date: '', Reference: '', Quantite: '', Prix: '', Source: '', Lien: '' })
  const csv = [headers.map(csvEscape).join(';'), ...data.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `historique-prix-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}
