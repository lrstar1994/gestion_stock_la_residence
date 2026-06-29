import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { receptionStatusLabels } from './receptions'
import type { Reception } from './receptions'

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

function rows(receptions: Reception[]) {
  return receptions.map((reception) => ({
    Reference: reception.reference,
    Fournisseur: reception.suppliers?.name || '',
    Date: reception.reception_date,
    Facture: reception.invoice_number,
    Commande: reception.purchase_orders?.reference || '',
    Articles: reception.reception_items?.length ?? 0,
    Montant: Number(reception.total_amount ?? 0),
    Statut: receptionStatusLabels[reception.status],
    Receptionnaire: reception.receiver?.full_name || '',
  }))
}

export function exportReceptionsToCsv(receptions: Reception[]) {
  const data = rows(receptions)
  const headers = Object.keys(data[0] ?? { Reference: '', Fournisseur: '', Date: '', Facture: '', Commande: '', Articles: '', Montant: '', Statut: '', Receptionnaire: '' })
  const csv = [headers.map(csvEscape).join(';'), ...data.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `receptions-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportReceptionsToExcel(receptions: Reception[]) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows(receptions))
  worksheet['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Receptions')
  XLSX.writeFile(workbook, `receptions-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportReceptionToPdf(reception: Reception) {
  const doc = new jsPDF()
  let y = 16
  const margin = 14
  doc.setFontSize(16)
  doc.text('La Residence - Reception marchandises', margin, y)
  y += 10
  doc.setFontSize(11)
  doc.text(`Reference : ${reception.reference}`, margin, y)
  y += 7
  doc.text(`Fournisseur : ${reception.suppliers?.name || '-'}`, margin, y)
  y += 7
  doc.text(`Date reception : ${new Date(reception.reception_date).toLocaleDateString('fr-FR')}`, margin, y)
  y += 7
  doc.text(`Facture : ${reception.invoice_number}`, margin, y)
  y += 7
  doc.text(`Statut : ${receptionStatusLabels[reception.status]}`, margin, y)
  y += 10

  doc.setFontSize(10)
  doc.text('Article', margin, y)
  doc.text('Livre', 75, y)
  doc.text('Accepte', 100, y)
  doc.text('Qualite', 126, y)
  doc.text('Prix reel', 154, y)
  doc.text('Total', 180, y)
  y += 4
  doc.line(margin, y, 196, y)
  y += 7

  for (const item of reception.reception_items ?? []) {
    if (y > 270) {
      doc.addPage()
      y = 16
    }
    doc.text(String(item.articles?.name ?? '-').slice(0, 30), margin, y)
    doc.text(`${Number(item.quantity_delivered ?? 0).toLocaleString('fr-FR')} ${item.units?.abbreviation ?? ''}`, 75, y)
    doc.text(`${Number(item.quantity_accepted ?? 0).toLocaleString('fr-FR')}`, 100, y)
    doc.text(item.quality, 126, y)
    doc.text(`${Number(item.unit_price_real ?? 0).toLocaleString('fr-FR')}`, 154, y)
    doc.text(`${(Number(item.quantity_accepted ?? 0) * Number(item.unit_price_real ?? 0)).toLocaleString('fr-FR')}`, 180, y)
    y += 7
  }

  y += 4
  doc.line(margin, y, 196, y)
  y += 8
  doc.setFontSize(12)
  doc.text(`Total : ${Number(reception.total_amount ?? 0).toLocaleString('fr-FR')} Ar`, margin, y)
  doc.save(`reception-${reception.reference}.pdf`)
}
