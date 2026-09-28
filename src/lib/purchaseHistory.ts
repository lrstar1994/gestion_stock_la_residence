export type PurchaseHistorySource =
  | 'purchase_need'
  | 'cash_purchase'
  | 'purchase_order'
  | 'reception'
  | 'invoice'
  | 'non_purchase_disbursement'

export type PurchaseHistoryDocumentStatus = 'present' | 'missing' | 'regularize' | 'not_applicable'

export type PurchaseHistoryItem = {
  id: string
  source: PurchaseHistorySource
  reference: string
  label: string
  status: string
  date: string
  amount?: number | null
  supplierName?: string | null
  supplierInvoiceNumber?: string | null
  internalNumber?: string | null
  articleNames: string[]
  locationName?: string | null
  responsibleName?: string | null
  documentStatus: PurchaseHistoryDocumentStatus
  targetUrl: string
}

export const purchaseHistorySourceLabels: Record<PurchaseHistorySource, string> = {
  purchase_need: "Besoin d'achat",
  cash_purchase: 'Achat especes',
  purchase_order: 'Commande fournisseur',
  reception: 'Reception marchandises',
  invoice: 'Facture fournisseur',
  non_purchase_disbursement: 'Decaissement hors achat',
}

export const purchaseHistoryDocumentStatusLabels: Record<PurchaseHistoryDocumentStatus, string> = {
  present: 'Present',
  missing: 'Manquant',
  regularize: 'A regulariser',
  not_applicable: '-',
}

export function sortPurchaseHistory(items: PurchaseHistoryItem[]) {
  return [...items].sort((a, b) => b.date.localeCompare(a.date))
}
