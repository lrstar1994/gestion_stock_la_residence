import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { purchaseOrderStatusLabels } from './purchaseOrders'
import type { PurchaseOrder } from './purchaseOrders'

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

function rows(orders: PurchaseOrder[]) {
  return orders.map((order) => ({
    Reference: order.reference,
    Fournisseur: order.suppliers?.name || '',
    'Date commande': order.order_date,
    'Livraison prevue': order.delivery_date,
    'Montant total': Number(order.total_amount ?? 0),
    Statut: purchaseOrderStatusLabels[order.status],
    Acheteur: order.creator?.full_name || '',
  }))
}

export function exportPurchaseOrdersToCsv(orders: PurchaseOrder[]) {
  const data = rows(orders)
  const headers = Object.keys(data[0] ?? { Reference: '', Fournisseur: '', 'Date commande': '', 'Livraison prevue': '', 'Montant total': '', Statut: '', Acheteur: '' })
  const csv = [headers.map(csvEscape).join(';'), ...data.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `commandes-fournisseurs-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportPurchaseOrdersToExcel(orders: PurchaseOrder[]) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows(orders))
  worksheet['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Commandes')
  XLSX.writeFile(workbook, `commandes-fournisseurs-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportPurchaseOrderToPdf(order: PurchaseOrder) {
  buildPurchaseOrderPdf(order).save(`commande-${order.reference}.pdf`)
}

export function createPurchaseOrderPdfFile(order: PurchaseOrder) {
  const doc = buildPurchaseOrderPdf(order)
  const blob = doc.output('blob')
  return new File([blob], `commande-${order.reference}.pdf`, { type: 'application/pdf', lastModified: Date.now() })
}

function buildPurchaseOrderPdf(order: PurchaseOrder) {
  const doc = new jsPDF()
  const margin = 14
  let y = 16

  doc.setFontSize(16)
  doc.text('La Residence - Commande fournisseur', margin, y)
  y += 10
  doc.setFontSize(11)
  doc.text(`Reference : ${order.reference}`, margin, y)
  y += 7
  doc.text(`Fournisseur : ${order.suppliers?.name || '-'}`, margin, y)
  y += 7
  doc.text(`Date commande : ${new Date(order.order_date).toLocaleDateString('fr-FR')}`, margin, y)
  y += 7
  doc.text(`Livraison prevue : ${new Date(order.delivery_date).toLocaleDateString('fr-FR')}`, margin, y)
  y += 7
  doc.text(`Statut : ${purchaseOrderStatusLabels[order.status]}`, margin, y)
  y += 10

  doc.setFontSize(10)
  doc.text('Article', margin, y)
  doc.text('Qte', 86, y)
  doc.text('Unite', 108, y)
  doc.text('PU', 132, y)
  doc.text('Total', 166, y)
  y += 4
  doc.line(margin, y, 196, y)
  y += 7

  for (const item of order.purchase_order_items ?? []) {
    if (y > 270) {
      doc.addPage()
      y = 16
    }
    doc.text(String(item.articles?.name ?? '-').slice(0, 36), margin, y)
    doc.text(Number(item.quantity_ordered ?? 0).toLocaleString('fr-FR'), 86, y)
    doc.text(item.units?.abbreviation ?? '', 108, y)
    doc.text(`${Number(item.unit_price ?? 0).toLocaleString('fr-FR')} Ar`, 132, y)
    doc.text(`${(Number(item.quantity_ordered ?? 0) * Number(item.unit_price ?? 0)).toLocaleString('fr-FR')} Ar`, 166, y)
    y += 7
  }

  y += 5
  doc.line(margin, y, 196, y)
  y += 8
  doc.setFontSize(12)
  doc.text(`Total : ${Number(order.total_amount ?? 0).toLocaleString('fr-FR')} Ar`, margin, y)

  if (order.comment) {
    y += 10
    doc.setFontSize(10)
    doc.text(doc.splitTextToSize(`Commentaire : ${order.comment}`, 180), margin, y)
  }

  return doc
}
