import { supabase } from '../../lib/supabase'
import type { ReceptionStatus } from '../../lib/receptions'
import type { UserRole } from '../../lib/validation'
import { listReceptions } from './receptions.api'

export type PurchaseReportingReception = {
  id: string
  reference: string
  reception_date: string
  status: ReceptionStatus
  total_amount: number
  invoice_number: string | null
  supplier_name: string | null
  location_name: string | null
  receiver_name: string | null
  article_names: string[]
  document_count: number
}

const reportRoles: UserRole[] = ['direction', 'controleur', 'caisse']

export function roleMayReadPurchaseReceptionReports(role?: UserRole | null) {
  return role != null && reportRoles.includes(role)
}

export async function listPurchaseReportingReceptions(
  role: UserRole | undefined,
  filters: {
    fromDate?: string
    toDate?: string
    statuses?: string[]
    receptionIds?: string[]
    openOnly?: boolean
    pageSize?: number
  } = {},
): Promise<PurchaseReportingReception[]> {
  if (!role) throw new Error('Profil utilisateur non chargé pour consulter les réceptions')
  if (!roleMayReadPurchaseReceptionReports(role)) {
    const result = await listReceptions({
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      status: filters.statuses?.length === 1 ? filters.statuses[0] as ReceptionStatus : 'all',
      pageSize: filters.pageSize ?? 200,
    })
    return result.receptions.map((row) => ({
      id: row.id, reference: row.reference, reception_date: row.reception_date,
      status: row.status, total_amount: row.total_amount, invoice_number: row.invoice_number,
      supplier_name: row.suppliers?.name ?? null,
      location_name: row.locations?.name ?? null,
      receiver_name: row.receiver?.full_name ?? null,
      article_names: [...new Set((row.reception_items ?? []).map((item) => item.articles?.name).filter((name): name is string => Boolean(name)))],
      document_count: row.reception_documents?.length ?? 0,
    }))
  }

  const pageSize = Math.min(Math.max(filters.pageSize ?? 200, 1), 500)
  const all: PurchaseReportingReception[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.schema('stock').rpc('list_purchase_reporting_receptions', {
      p_from_date: filters.fromDate ?? null,
      p_to_date: filters.toDate ?? null,
      p_statuses: filters.statuses ?? null,
      p_reception_ids: filters.receptionIds ?? null,
      p_open_only: filters.openOnly ?? false,
      p_limit: pageSize,
      p_offset: offset,
    })
    if (error) throw error
    const rows = (data ?? []) as PurchaseReportingReception[]
    all.push(...rows)
    if (rows.length < pageSize || filters.receptionIds?.length) break
  }
  return all
}

export async function getPurchaseReportingReception(receptionId: string, role: UserRole | undefined) {
  const [row] = await listPurchaseReportingReceptions(role, { receptionIds: [receptionId], pageSize: 1 })
  return row ?? null
}
