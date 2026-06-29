import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import type { Recipe } from './recipes'
import { mainIngredientLabels, recipeStatusLabels, recipeTypeLabels } from './recipes'

function formatMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('fr-FR')} Ar`
}

function formatPercent(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)} %`
}

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
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function recipeToLibraryRow(recipe: Recipe) {
  return {
    Code: recipe.code || '',
    Nom: recipe.name,
    Type: `${recipe.type} - ${recipeTypeLabels[recipe.type]}`,
    'Matiere principale': mainIngredientLabels[recipe.main_ingredient],
    'Cout matiere HT': Number(recipe.total_cost ?? 0),
    'Cout par portion HT': Number(recipe.cost_per_portion ?? 0),
    'Prix vente final HT': Number(recipe.final_price ?? 0),
    'Ratio cout': Number(recipe.cost_ratio ?? 0),
    Marge: Number(recipe.margin_rate ?? 0),
    Statut: recipeStatusLabels[recipe.status],
    Version: `v${recipe.version}`,
    'Date modification': recipe.updated_at ? new Date(recipe.updated_at).toLocaleDateString('fr-FR') : '',
  }
}

export function exportRecipesToCsv(recipes: Recipe[]) {
  const rows = recipes.map(recipeToLibraryRow)
  const headers = Object.keys(rows[0] ?? {
    Code: '',
    Nom: '',
    Type: '',
    'Matiere principale': '',
    'Cout matiere HT': '',
    'Cout par portion HT': '',
    'Prix vente final HT': '',
    'Ratio cout': '',
    Marge: '',
    Statut: '',
    Version: '',
    'Date modification': '',
  })
  const csv = [
    headers.map(csvEscape).join(';'),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';')),
  ].join('\n')

  downloadBlob(`\uFEFF${csv}`, `bibliotheque-fiches-techniques-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportRecipesToExcel(recipes: Recipe[]) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(recipes.map(recipeToLibraryRow))
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 28 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fiches techniques')
  XLSX.writeFile(workbook, `bibliotheque-fiches-techniques-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportRecipeToPdf(recipe: Recipe) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = margin

  const ensureSpace = (height = 10) => {
    if (y + height <= pageHeight - margin) return
    doc.addPage()
    y = margin
  }

  const addText = (text: string, x: number, maxWidth: number, options?: { size?: number; bold?: boolean; color?: [number, number, number]; lineHeight?: number }) => {
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal')
    doc.setFontSize(options?.size ?? 10)
    doc.setTextColor(...(options?.color ?? [15, 23, 42]))
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, x, y)
    y += lines.length * (options?.lineHeight ?? 5)
  }

  doc.setFillColor(30, 58, 138)
  doc.rect(0, 0, pageWidth, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('LA RESIDENCE - FICHE TECHNIQUE', margin, 11)

  y = 28
  addText(recipe.name, margin, pageWidth - margin * 2, { size: 20, bold: true, color: [16, 40, 95], lineHeight: 8 })
  addText(`${recipe.code || 'Code attribue a la validation'} - Version ${recipe.version}`, margin, pageWidth - margin * 2, { size: 10, color: [71, 85, 105] })

  y += 3
  doc.setDrawColor(212, 175, 55)
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  const infoBoxes = [
    ['Type', `${recipe.type} - ${recipeTypeLabels[recipe.type]}`],
    ['Matiere', mainIngredientLabels[recipe.main_ingredient]],
    ['Portions', String(recipe.portions)],
    ['Statut', recipeStatusLabels[recipe.status]],
    ['Cout total HT', formatMoney(recipe.total_cost)],
    ['Cout / portion', formatMoney(recipe.cost_per_portion)],
    ['Prix final HT', formatMoney(recipe.final_price)],
    ['Ratio cout', formatPercent(recipe.cost_ratio)],
  ]

  const boxWidth = (pageWidth - margin * 2 - 9) / 4
  infoBoxes.forEach(([label, value], index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    const x = margin + col * (boxWidth + 3)
    const boxY = y + row * 22
    doc.setDrawColor(219, 227, 239)
    doc.roundedRect(x, boxY, boxWidth, 17, 1.5, 1.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), x + 3, boxY + 5)
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)
    doc.text(doc.splitTextToSize(value, boxWidth - 6), x + 3, boxY + 11)
  })
  y += 50

  if (recipe.description) {
    addSectionTitle(doc, 'Description', margin, y)
    y += 8
    addText(recipe.description, margin, pageWidth - margin * 2)
    y += 4
  }

  ensureSpace(24)
  addSectionTitle(doc, 'Ingredients', margin, y)
  y += 8

  const columns = [
    { label: 'Article', x: margin, width: 58 },
    { label: 'Quantite', x: margin + 60, width: 48 },
    { label: 'Prix unitaire HT', x: margin + 110, width: 32 },
    { label: 'Cout HT', x: margin + 144, width: 38 },
  ]

  const drawHeader = () => {
    doc.setFillColor(241, 245, 249)
    doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    columns.forEach((column) => doc.text(column.label.toUpperCase(), column.x + 1, y))
    y += 6
  }

  drawHeader()

  const ingredients = recipe.recipe_ingredients ?? []
  if (ingredients.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Aucun ingredient.', margin, y)
    y += 7
  }

  ingredients.forEach((ingredient) => {
    const displayQuantity = Number(ingredient.quantity_display ?? ingredient.quantity).toLocaleString('fr-FR')
    const displayUnit = ingredient.display_unit?.abbreviation || ingredient.units?.abbreviation || ingredient.unit_name || ''
    const storedQuantity = Number(ingredient.quantity_stored ?? ingredient.quantity).toLocaleString('fr-FR')
    const storedUnit = ingredient.stored_unit?.abbreviation || ingredient.articles?.units?.abbreviation || ''
    const cells = [
      ingredient.articles?.name || ingredient.imported_name || '',
      `${displayQuantity} ${displayUnit} (${storedQuantity} ${storedUnit})`,
      formatMoney(ingredient.unit_price),
      formatMoney(ingredient.total_cost),
    ]
    const lines = cells.map((cell, index) => doc.splitTextToSize(cell, columns[index].width - 2))
    const rowHeight = Math.max(8, ...lines.map((line) => line.length * 4 + 3))
    ensureSpace(rowHeight + 3)
    if (y === margin) drawHeader()

    doc.setDrawColor(226, 232, 240)
    doc.line(margin, y - 4, pageWidth - margin, y - 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)
    lines.forEach((line, index) => doc.text(line, columns[index].x + 1, y))
    y += rowHeight
  })

  y += 4
  ensureSpace(20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text("Tous les prix indiques sont hors TVA. Le prix unitaire est exprime dans l'unite de stock de l'article.", margin, y)
  y += 8

  if (recipe.status === 'validee') {
    ensureSpace(16)
    doc.setDrawColor(22, 163, 74)
    doc.setLineWidth(1)
    doc.line(margin, y - 4, margin, y + 8)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`Fiche validee par ${recipe.validator?.full_name ?? 'la Direction'} le ${recipe.validated_at ? new Date(recipe.validated_at).toLocaleDateString('fr-FR') : '-'}.`, margin + 4, y)
  }

  doc.save(`fiche-technique-${safeFileName(recipe.name)}.pdf`)
}

function addSectionTitle(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(16, 40, 95)
  doc.text(title, x, y)
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}
