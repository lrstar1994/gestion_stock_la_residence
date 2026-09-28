import * as XLSX from 'xlsx'
import { cashPurchaseSourceLabels, cashPurchaseStatusLabels, cashReceptionStatusLabels, cashStockEntryStatusLabels, cashWorkflowStatusLabels } from './cashPurchases'
import type { CashPurchase } from './cashPurchases'
import type { NonPurchaseDisbursement } from './cashDisbursements'
import { nonPurchaseDisbursementStatusLabels, nonPurchaseDisbursementTypeLabels, supportingDocumentStatusLabels } from './cashDisbursements'

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

function rows(purchases: CashPurchase[]) {
  return purchases.map((purchase) => ({
    Reference: purchase.reference,
    Date: purchase.request_date,
    Acheteur: purchase.buyer?.full_name || '',
    Caisse: cashPurchaseSourceLabels[purchase.cash_source],
    Motif: purchase.reason,
    'Montant demande': Number(purchase.amount_requested ?? 0),
    'Montant remis': Number(purchase.amount_given ?? 0),
    'Total achete': Number(purchase.total_purchased ?? 0),
    Ecart: Number(purchase.difference ?? 0),
    Statut: cashPurchaseStatusLabels[purchase.status],
  }))
}

export function exportCashPurchasesToCsv(purchases: CashPurchase[]) {
  const data = rows(purchases)
  const headers = Object.keys(data[0] ?? { Reference: '', Date: '', Acheteur: '', Caisse: '', Motif: '', 'Montant demande': '', 'Montant remis': '', 'Total achete': '', Ecart: '', Statut: '' })
  const csv = [headers.map(csvEscape).join(';'), ...data.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(';'))].join('\n')
  downloadBlob(`\uFEFF${csv}`, `achats-especes-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}

export function exportCashPurchasesToExcel(purchases: CashPurchase[]) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows(purchases))
  worksheet['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 34 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Achats especes')
  XLSX.writeFile(workbook, `achats-especes-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

type DailyExportDocumentRow = {
  label: string
  reference: string
  date: string
  supplier: string
  amount: number
  supplierInvoice: string
  internalNumber: string
  documentPresent: boolean
  classified: boolean
  responsible: string
  problem?: string
}

type DailyExportAlert = {
  dossier: string
  type: string
  amount: number
  problem: string
  owner: string
  action: string
}

export function exportDailyCashDisbursementReport(data: {
  purchases: CashPurchase[]
  disbursements: NonPurchaseDisbursement[]
  orders: DailyExportDocumentRow[]
  receptions: DailyExportDocumentRow[]
  invoices: DailyExportDocumentRow[]
  alerts: DailyExportAlert[]
  reportDate: string
}) {
  const { purchases, disbursements, orders, receptions, invoices, alerts, reportDate } = data
  const total = (field: keyof Pick<CashPurchase, 'amount_requested' | 'amount_validated' | 'amount_given' | 'total_purchased' | 'change_expected' | 'change_returned' | 'difference'>) =>
    purchases.reduce((sum, purchase) => sum + Number(purchase[field] ?? 0), 0)
  const nonPurchaseTotal = disbursements.reduce((sum, item) => sum + Number(item.amount_given ?? item.amount_validated ?? item.amount_requested), 0)
  const documentRows = [...orders, ...receptions, ...invoices]

  const workbook = XLSX.utils.book_new()
  const summary = [
    { Indicateur: 'Date du rapport', Valeur: reportDate },
    { Indicateur: 'Nombre de dossiers', Valeur: purchases.length },
    { Indicateur: 'Montant demande', Valeur: total('amount_requested') },
    { Indicateur: 'Montant valide', Valeur: total('amount_validated') },
    { Indicateur: 'Especes remises', Valeur: total('amount_given') },
    { Indicateur: 'Total achete', Valeur: total('total_purchased') },
    { Indicateur: 'Monnaie attendue', Valeur: total('change_expected') },
    { Indicateur: 'Monnaie rendue', Valeur: total('change_returned') },
    { Indicateur: 'Ecart monnaie', Valeur: total('difference') },
    { Indicateur: 'Achats - justificatifs presents', Valeur: purchases.filter((purchase) => (purchase.cash_purchase_receipts?.length ?? 0) > 0).length },
    { Indicateur: 'Achats - justificatifs manquants / a regulariser', Valeur: purchases.filter((purchase) => (purchase.cash_purchase_receipts?.length ?? 0) === 0).length },
    { Indicateur: 'Achats - dossiers non classes', Valeur: purchases.filter((purchase) => purchase.status !== 'cloture').length },
    { Indicateur: 'Commandes traitees', Valeur: orders.length },
    { Indicateur: 'Receptions du jour', Valeur: receptions.length },
    { Indicateur: 'Factures recues', Valeur: invoices.length },
    { Indicateur: 'Pieces commandes/receptions/factures presentes', Valeur: documentRows.filter((item) => item.documentPresent).length },
    { Indicateur: 'Dossiers commandes/receptions/factures a regulariser', Valeur: documentRows.filter((item) => !item.documentPresent || !item.classified).length },
    { Indicateur: 'Decaissements hors achat', Valeur: disbursements.length },
    { Indicateur: 'Montant decaissements hors achat', Valeur: nonPurchaseTotal },
    { Indicateur: 'Decaissements hors achat a valider Direction', Valeur: disbursements.filter((item) => item.status === 'pending_direction').length },
    { Indicateur: 'Decaissements hors achat justificatif manquant', Valeur: disbursements.filter((item) => item.metadata.supportingDocumentStatus !== 'present').length },
    { Indicateur: 'Alertes Direction', Valeur: alerts.length },
    { Indicateur: 'Solde theorique caisse', Valeur: 'Non disponible' },
  ]
  const detail = purchases.map((purchase) => ({
    Reference: purchase.reference,
    Date: purchase.request_date,
    Acheteur: purchase.buyer?.full_name || '',
    Caissier: purchase.cashier?.full_name || '',
    Caisse: cashPurchaseSourceLabels[purchase.cash_source],
    Motif: purchase.reason,
    'Montant demande': Number(purchase.amount_requested ?? 0),
    'Montant valide': Number(purchase.amount_validated ?? 0),
    'Especes remises': Number(purchase.amount_given ?? 0),
    'Total achete': Number(purchase.total_purchased ?? 0),
    'Monnaie attendue': Number(purchase.change_expected ?? 0),
    'Monnaie rendue': Number(purchase.change_returned ?? 0),
    'Ecart monnaie': Number(purchase.difference ?? 0),
    'Nombre justificatifs': purchase.cash_purchase_receipts?.length ?? 0,
    'Ecarts ouverts': purchase.cash_purchase_differences?.filter((difference) => difference.status !== 'valide').length ?? 0,
    Statut: cashPurchaseStatusLabels[purchase.status],
    Caisse_statut: cashWorkflowStatusLabels[purchase.cash_status ?? 'especes_demandees'],
    Reception: cashReceptionStatusLabels[purchase.reception_status ?? 'en_attente_reception'],
    Stock: cashStockEntryStatusLabels[purchase.stock_entry_status ?? 'non_entre_stock'],
  }))

  const summarySheet = XLSX.utils.json_to_sheet(summary)
  summarySheet['!cols'] = [{ wch: 34 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Synthese')

  const detailSheet = XLSX.utils.json_to_sheet(detail)
  detailSheet['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 34 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 22 }, { wch: 20 },
  ]
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Achats especes')

  const documentsSheet = XLSX.utils.json_to_sheet(documentRows.map((item) => ({
    Type: item.label, Dossier: item.reference, Date: item.date, Fournisseur: item.supplier, Montant: item.amount,
    'Numero facture fournisseur': item.supplierInvoice || '-', 'Numero interne': item.internalNumber || '-',
    Responsable: item.responsible, Justificatif: item.documentPresent ? 'Justificatif present' : 'Justificatif manquant / a regulariser',
    Classement: item.classified ? 'Dossier classe' : 'Dossier non classe', Probleme: item.problem ?? '',
  })))
  documentsSheet['!cols'] = [{ wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 22 }, { wch: 32 }, { wch: 22 }, { wch: 38 }]
  XLSX.utils.book_append_sheet(workbook, documentsSheet, 'Receptions factures')

  const disbursementsSheet = XLSX.utils.json_to_sheet(disbursements.map((item) => ({
    'Piece interne': item.reference, Date: item.request_date, Type: nonPurchaseDisbursementTypeLabels[item.metadata.type],
    Beneficiaire: item.metadata.beneficiary, Service: item.metadata.service || 'Non disponible', Caisse: item.cash_source,
    Montant: Number(item.amount_given ?? item.amount_validated ?? item.amount_requested),
    Justificatif: supportingDocumentStatusLabels[item.metadata.supportingDocumentStatus],
    Statut: nonPurchaseDisbursementStatusLabels[item.status], Classement: item.status === 'closed' ? 'Dossier classe' : 'Dossier non classe',
  })))
  disbursementsSheet['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 34 }, { wch: 24 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 34 }, { wch: 24 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(workbook, disbursementsSheet, 'Decaissements hors achat')

  const alertsSheet = XLSX.utils.json_to_sheet(alerts.map((item) => ({
    Dossier: item.dossier, Type: item.type, Montant: item.amount, Probleme: item.problem,
    'Responsable actuel': item.owner, 'Action attendue': item.action,
  })))
  alertsSheet['!cols'] = [{ wch: 20 }, { wch: 26 }, { wch: 16 }, { wch: 42 }, { wch: 24 }, { wch: 42 }]
  XLSX.utils.book_append_sheet(workbook, alertsSheet, 'Alertes Direction')
  XLSX.writeFile(workbook, `rapport-decaissements-${reportDate}.xlsx`)
}
