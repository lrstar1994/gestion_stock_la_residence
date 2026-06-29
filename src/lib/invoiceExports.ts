import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import type { Invoice } from './invoices'
import { invoiceStatusLabels, paymentModeLabels } from './invoices'

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

export function exportInvoicesToExcel(invoices: Invoice[]) {
  const worksheet = XLSX.utils.json_to_sheet(invoices.map((invoice) => ({
    Reference: invoice.reference,
    Facture: invoice.invoice_number,
    Fournisseur: invoice.suppliers?.name,
    Date: invoice.invoice_date,
    Echeance: invoice.due_date,
    TTC: Number(invoice.amount_ttc ?? 0),
    Paye: Number(invoice.amount_paid ?? 0),
    Solde: Number(invoice.amount_remaining ?? 0),
    Statut: invoiceStatusLabels[invoice.status],
    Paiement: invoice.payment_mode ? paymentModeLabels[invoice.payment_mode] : '',
  })))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Factures')
  XLSX.writeFile(workbook, `factures-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportInvoicesToCsv(invoices: Invoice[]) {
  const rows = invoices.map((invoice) => ({
    Reference: invoice.reference,
    Facture: invoice.invoice_number,
    Fournisseur: invoice.suppliers?.name,
    Date: invoice.invoice_date,
    Echeance: invoice.due_date,
    TTC: Number(invoice.amount_ttc ?? 0),
    Solde: Number(invoice.amount_remaining ?? 0),
    Statut: invoiceStatusLabels[invoice.status],
  }))
  const headers = Object.keys(rows[0] ?? { Reference: '', Facture: '', Fournisseur: '', Date: '', Echeance: '', TTC: '', Solde: '', Statut: '' })
  const csv = [headers.map(csvEscape).join(';'), ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `factures-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportInvoiceToPdf(invoice: Invoice) {
  const doc = new jsPDF()
  let y = 18
  doc.setFontSize(18)
  doc.text(`Facture ${invoice.reference}`, 14, y)
  y += 12
  doc.setFontSize(10)
  doc.text(`Fournisseur : ${invoice.suppliers?.name ?? '-'}`, 14, y)
  y += 7
  doc.text(`Numero facture : ${invoice.invoice_number}`, 14, y)
  y += 7
  doc.text(`Date facture : ${invoice.invoice_date}`, 14, y)
  y += 7
  doc.text(`Date echeance : ${invoice.due_date}`, 14, y)
  y += 10
  doc.text(`Montant HT : ${Number(invoice.amount_ht).toLocaleString('fr-FR')} Ar`, 14, y)
  y += 7
  doc.text(`TVA : ${Number(invoice.amount_tva).toLocaleString('fr-FR')} Ar`, 14, y)
  y += 7
  doc.setFontSize(12)
  doc.text(`Montant TTC : ${Number(invoice.amount_ttc).toLocaleString('fr-FR')} Ar`, 14, y)
  y += 7
  doc.text(`Solde restant : ${Number(invoice.amount_remaining).toLocaleString('fr-FR')} Ar`, 14, y)
  y += 12
  doc.setFontSize(11)
  doc.text('Articles', 14, y)
  y += 8
  doc.setFontSize(9)
  for (const item of invoice.invoice_items ?? []) {
    if (y > 275) {
      doc.addPage()
      y = 18
    }
    doc.text(`${item.articles?.name ?? '-'} - ${Number(item.quantity).toLocaleString('fr-FR')} ${item.units?.abbreviation ?? ''}`, 14, y)
    doc.text(`${Number(item.total ?? 0).toLocaleString('fr-FR')} Ar`, 160, y)
    y += 7
  }
  doc.save(`${invoice.reference}.pdf`)
}
