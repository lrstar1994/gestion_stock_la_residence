import * as XLSX from 'xlsx'
import { inventoryStatusLabels, inventoryTypeLabels } from './inventories'
import type { InitialInventoryRow, Inventory } from './inventories'

export function exportInventoriesToExcel(rows: Inventory[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map((inventory) => ({
    Reference: inventory.reference,
    Date: inventory.inventory_date,
    Localisation: inventory.locations?.name,
    Type: inventoryTypeLabels[inventory.type],
    Articles: inventory.inventory_items?.length ?? 0,
    'Ecart total': Number(inventory.total_difference ?? 0),
    'Ecart valeur': Number(inventory.total_value_difference ?? 0),
    Statut: inventoryStatusLabels[inventory.status],
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventaires')
  XLSX.writeFile(workbook, `inventaires-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportInventoryDetailToExcel(inventory: Inventory) {
  const worksheet = XLSX.utils.json_to_sheet((inventory.inventory_items ?? []).map((item) => ({
    Article: item.articles?.name,
    Theorique: Number(item.theoretical_quantity ?? 0),
    Compte: Number(item.counted_quantity ?? 0),
    Ecart: Number(item.difference ?? 0),
    Unite: item.units?.abbreviation,
    Prix: Number(item.unit_price ?? 0),
    'Ecart valeur': Number(item.value_difference ?? 0),
    Motif: item.reason ?? '',
    Mouvement: item.stock_movements?.movement_reference ?? '',
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, inventory.reference)
  XLSX.writeFile(workbook, `${inventory.reference}.xlsx`)
}

export function exportInventoryDifferencesToExcel(inventory: Inventory, significantOnly = false) {
  const rows = (inventory.inventory_items ?? []).filter((item) => {
    const difference = Math.abs(Number(item.difference ?? 0))
    if (difference === 0) return false
    if (!significantOnly) return true
    const theoretical = Math.abs(Number(item.theoretical_quantity ?? 0))
    return theoretical === 0 || (difference / theoretical) * 100 > 5
  })
  const worksheet = XLSX.utils.json_to_sheet(rows.map((item) => ({
    Article: item.articles?.name,
    Theorique: Number(item.theoretical_quantity ?? 0),
    Compte: Number(item.counted_quantity ?? 0),
    Ecart: Number(item.difference ?? 0),
    Unite: item.units?.abbreviation,
    Prix: Number(item.unit_price ?? 0),
    'Ecart valeur': Number(item.value_difference ?? 0),
    Motif: item.reason ?? '',
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, significantOnly ? 'Ecarts significatifs' : 'Ecarts')
  XLSX.writeFile(workbook, `${inventory.reference}-ecarts${significantOnly ? '-significatifs' : ''}.xlsx`)
}

export function exportInitialInventoryToExcel(rows: InitialInventoryRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
    Article: row.article_name,
    Localisation: row.location_name,
    Unite: row.unit_name,
    Statut: row.status,
    'Dernier inventaire': row.last_inventory_date ?? '',
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Initial')
  XLSX.writeFile(workbook, `inventaire-initial-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
