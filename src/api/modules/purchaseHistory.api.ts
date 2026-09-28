import { supabase } from '../../lib/supabase'
import { listNonPurchaseDisbursements } from './cashDisbursements.api'
import type { PurchaseHistoryItem } from '../../lib/purchaseHistory'
import { sortPurchaseHistory } from '../../lib/purchaseHistory'
import type { UserRole } from '../../lib/validation'
import { listPurchaseReportingReceptions } from './purchaseReporting.api'

type Named = { name: string }
type ProfileName = { full_name: string }
type ArticleLine = { articles?: Named | null }
type NeedRow = { id: string; created_at: string; status: string; estimated_cost: number | null; estimated_payable_amount: number | null; quantity_needed?: number; quantity?: number; articles?: Named | null; suppliers?: Named | null; requester?: ProfileName | null }
type CashRow = { id: string; reference: string; request_date: string; status: string; reason: string; amount_requested: number; suppliers?: Named | null; buyer?: ProfileName | null; buyer_directory?: { first_name: string; last_name: string } | null; cash_purchase_items?: Array<ArticleLine & { free_designation?: string | null; invoice_number?: string | null; supplier?: string | null }>; cash_purchase_receipts?: Array<{ internal_number?: string | null }> }
type OrderRow = { id: string; reference: string; order_date: string; status: string; total_amount: number; suppliers?: Named | null; creator?: ProfileName | null; purchase_order_items?: ArticleLine[]; purchase_order_documents?: Array<{ id: string }> }
type InvoiceRow = { id: string; reference: string; invoice_date: string; status: string; amount_ttc: number; invoice_number?: string | null; file_url?: string | null; suppliers?: Named | null; creator?: ProfileName | null; invoice_items?: ArticleLine[] }

function articleNames(lines?: ArticleLine[]) {
  return [...new Set((lines ?? []).map((line) => line.articles?.name).filter((name): name is string => Boolean(name)))]
}

export async function listPurchaseHistory(role: UserRole): Promise<PurchaseHistoryItem[]> {
  const [needsResult, cashResult, ordersResult, receptionsResult, invoicesResult, disbursements] = await Promise.all([
    supabase.schema('stock').from('purchase_needs').select('id, created_at, status, estimated_cost, estimated_payable_amount, quantity_needed, quantity, articles(id, name), suppliers(id, name), requester:profiles!purchase_needs_created_by_fkey(id, full_name)').order('created_at', { ascending: false }).limit(150),
    supabase.schema('stock').from('cash_purchases').select('id, reference, request_date, status, reason, amount_requested, suppliers(id, name), buyer:profiles!cash_purchases_buyer_id_fkey(id, full_name), buyer_directory:cash_purchase_buyer_directory!cash_purchases_buyer_directory_id_fkey(first_name, last_name), cash_purchase_items(articles(id, name), free_designation, invoice_number, supplier), cash_purchase_receipts(internal_number)').order('created_at', { ascending: false }).limit(150),
    supabase.schema('stock').from('purchase_orders').select('id, reference, order_date, status, total_amount, suppliers(id, name), creator:profiles!purchase_orders_created_by_fkey(id, full_name), purchase_order_items(articles(id, name)), purchase_order_documents(id)').order('created_at', { ascending: false }).limit(150),
    listPurchaseReportingReceptions(role, { pageSize: 150 }),
    supabase.schema('stock').from('invoices').select('id, reference, invoice_date, status, amount_ttc, invoice_number, file_url, suppliers(id, name), creator:profiles!invoices_created_by_fkey(id, full_name), invoice_items(articles(id, name))').order('created_at', { ascending: false }).limit(150),
    listNonPurchaseDisbursements(),
  ])

  for (const result of [needsResult, ordersResult, invoicesResult]) {
    if (result.error) throw result.error
  }

  const needs = (needsResult.data ?? []) as unknown as NeedRow[]
  let cash: CashRow[]
  if (!cashResult.error) {
    cash = (cashResult.data ?? []) as unknown as CashRow[]
  } else {
    const fallback = await supabase.schema('stock').from('cash_purchases')
      .select('id, reference, request_date, status, reason, amount_requested, buyer:profiles!cash_purchases_buyer_id_fkey(id, full_name), buyer_directory:cash_purchase_buyer_directory!cash_purchases_buyer_directory_id_fkey(first_name, last_name), cash_purchase_items(articles(id, name), free_designation, invoice_number, supplier), cash_purchase_receipts(id)')
      .order('created_at', { ascending: false }).limit(150)
    if (fallback.error) throw fallback.error
    cash = (fallback.data ?? []) as unknown as CashRow[]
  }
  const orders = (ordersResult.data ?? []) as unknown as OrderRow[]
  const receptions = receptionsResult
  const invoices = (invoicesResult.data ?? []) as unknown as InvoiceRow[]

  return sortPurchaseHistory([
    ...needs.filter(() => false).map((need) => ({
      id: need.id, source: 'purchase_need' as const, reference: need.articles?.name ?? 'Besoin sans article',
      label: `${need.articles?.name ?? 'Article'} - ${Number(need.quantity_needed ?? need.quantity ?? 0).toLocaleString('fr-FR')}`,
      status: need.status, date: need.created_at, amount: need.estimated_payable_amount ?? need.estimated_cost, supplierName: need.suppliers?.name ?? null,
      articleNames: need.articles?.name ? [need.articles.name] : [], responsibleName: need.requester?.full_name ?? null,
      documentStatus: 'not_applicable' as const, targetUrl: `/purchase-needs?focus=${need.id}`,
    })),
    ...cash.map((purchase) => {
      const names = articleNames(purchase.cash_purchase_items)
      const freeNames = (purchase.cash_purchase_items ?? []).map((item) => item.free_designation).filter((name): name is string => Boolean(name))
      const supplierNames = (purchase.cash_purchase_items ?? []).map((item) => item.supplier).filter((name): name is string => Boolean(name))
      return {
        id: purchase.id, source: 'cash_purchase' as const, reference: purchase.reference, label: purchase.reason,
        status: purchase.status, date: purchase.request_date, amount: purchase.amount_requested,
        supplierName: purchase.suppliers?.name ?? supplierNames[0] ?? null,
        supplierInvoiceNumber: (purchase.cash_purchase_items ?? []).find((item) => item.invoice_number)?.invoice_number ?? null,
        internalNumber: purchase.cash_purchase_receipts?.find((receipt) => receipt.internal_number)?.internal_number ?? null,
        articleNames: [...new Set([...names, ...freeNames])], responsibleName: purchase.buyer_directory ? `${purchase.buyer_directory.first_name} ${purchase.buyer_directory.last_name}`.trim() : purchase.buyer?.full_name ?? null,
        documentStatus: (purchase.cash_purchase_receipts?.length ?? 0) > 0 ? 'present' as const : 'regularize' as const,
        targetUrl: `/cash-purchases/${purchase.id}`,
      }
    }),
    ...orders.filter((order) => !['brouillon', 'draft'].includes(order.status)).map((order) => ({
      id: order.id, source: 'purchase_order' as const, reference: order.reference, label: order.suppliers?.name ?? 'Commande fournisseur',
      status: order.status, date: order.order_date, amount: order.total_amount, supplierName: order.suppliers?.name ?? null,
      articleNames: articleNames(order.purchase_order_items), responsibleName: order.creator?.full_name ?? null,
      documentStatus: (order.purchase_order_documents?.length ?? 0) > 0 ? 'present' as const : 'not_applicable' as const,
      targetUrl: `/purchase-orders/${order.id}`,
    })),
    ...receptions.map((reception) => ({
      id: reception.id, source: 'reception' as const, reference: reception.reference, label: reception.supplier_name ?? 'Reception marchandises',
      status: reception.status, date: reception.reception_date, amount: reception.total_amount, supplierName: reception.supplier_name,
      supplierInvoiceNumber: reception.invoice_number ?? null, articleNames: reception.article_names,
      locationName: reception.location_name, responsibleName: reception.receiver_name,
      documentStatus: reception.document_count > 0 ? 'present' as const : 'regularize' as const,
      targetUrl: role === 'caisse' ? '/purchases/history' : `/receptions/${reception.id}`,
    })),
    ...invoices.map((invoice) => ({
      id: invoice.id, source: 'invoice' as const, reference: invoice.reference, label: invoice.invoice_number ?? 'Facture fournisseur',
      status: invoice.status, date: invoice.invoice_date, amount: invoice.amount_ttc, supplierName: invoice.suppliers?.name ?? null,
      supplierInvoiceNumber: invoice.invoice_number ?? null, internalNumber: invoice.reference,
      articleNames: articleNames(invoice.invoice_items), responsibleName: invoice.creator?.full_name ?? null,
      documentStatus: invoice.file_url ? 'present' as const : 'missing' as const, targetUrl: `/invoices/${invoice.id}`,
    })),
    ...disbursements.map((item) => ({
      id: item.id, source: 'non_purchase_disbursement' as const, reference: item.reference, label: item.reason,
      status: item.status, date: item.request_date, amount: item.amount_given ?? item.amount_validated ?? item.amount_requested,
      supplierName: item.metadata.beneficiary || null, internalNumber: item.reference, articleNames: [],
      responsibleName: item.requester?.full_name ?? null,
      documentStatus: item.metadata.supportingDocumentStatus === 'present' ? 'present' as const : 'regularize' as const,
      targetUrl: '/cash-purchases/report#hors-achat',
    })),
  ])
}
