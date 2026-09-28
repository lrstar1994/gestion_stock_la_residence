import { Download, Printer, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listDailyCashDisbursementReport } from '../../api/modules/cashPurchases.api'
import { listNonPurchaseDisbursements } from '../../api/modules/cashDisbursements.api'
import { listInvoices } from '../../api/modules/invoices.api'
import { listPurchaseOrders } from '../../api/modules/purchaseOrders.api'
import { listPurchaseReportingReceptions } from '../../api/modules/purchaseReporting.api'
import { exportDailyCashDisbursementReport } from '../../lib/cashPurchaseExports'
import { cashPurchaseSourceLabels } from '../../lib/cashPurchases'
import type { CashPurchase, CashPurchaseSource } from '../../lib/cashPurchases'
import { getDisbursementRelay, nonPurchaseDisbursementStatusLabels, nonPurchaseDisbursementTypeLabels, paymentModeLabels, supportingDocumentStatusLabels } from '../../lib/cashDisbursements'
import type { NonPurchaseDisbursement } from '../../lib/cashDisbursements'
import type { Invoice } from '../../lib/invoices'
import type { PurchaseOrder } from '../../lib/purchaseOrders'
import { useAuth } from '../../hooks/useAuth'
import type { PurchaseReportingReception } from '../../api/modules/purchaseReporting.api'

type ReportType = 'all' | 'cash_purchase' | 'purchase_order' | 'reception' | 'invoice' | 'non_purchase'
type DocumentFilter = 'all' | 'present' | 'missing'
type ClassificationFilter = 'all' | 'classified' | 'unclassified'

type DocumentRow = {
  key: string; type: Exclude<ReportType, 'all' | 'cash_purchase' | 'non_purchase'>; label: string; reference: string
  date: string; supplier: string; amount: number; supplierInvoice: string; internalNumber: string
  documentPresent: boolean; classified: boolean; responsible: string; targetUrl: string; problem?: string
}

export type DailyDirectionAlert = {
  key: string; dossier: string; type: string; amount: number; problem: string; owner: string; action: string
  reportType: Exclude<ReportType, 'all'>; cashSource?: string; service?: string; responsible?: string
  documentPresent?: boolean; classified?: boolean
}

const todayIso = () => new Date().toISOString().slice(0, 10)
const money = (value: unknown) => `${Number(value ?? 0).toLocaleString('fr-FR')} Ar`

export function CashDisbursementReportPage() {
  const { profile } = useAuth()
  const [reportDate, setReportDate] = useState(todayIso())
  const [purchases, setPurchases] = useState<CashPurchase[]>([])
  const [disbursements, setDisbursements] = useState<NonPurchaseDisbursement[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [receptions, setReceptions] = useState<PurchaseReportingReception[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [cashSource, setCashSource] = useState<CashPurchaseSource | 'all'>('all')
  const [service, setService] = useState('all')
  const [responsible, setResponsible] = useState('all')
  const [reportType, setReportType] = useState<ReportType>('all')
  const [documentFilter, setDocumentFilter] = useState<DocumentFilter>('all')
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all')
  const [alertsOnly, setAlertsOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [purchaseRows, nonPurchaseRows, orderRows, receptionRows, invoiceRows] = await Promise.all([
        listDailyCashDisbursementReport(reportDate),
        listNonPurchaseDisbursements(reportDate),
        listPurchaseOrders({ fromDate: reportDate, toDate: reportDate, status: 'all', pageSize: 200 }),
        listPurchaseReportingReceptions(profile?.role, { fromDate: reportDate, toDate: reportDate, pageSize: 200 }),
        listInvoices({ fromDate: reportDate, toDate: reportDate, status: 'all', pageSize: 200 }),
      ])
      setPurchases(purchaseRows); setDisbursements(nonPurchaseRows); setOrders(orderRows.orders)
      setReceptions(receptionRows); setInvoices(invoiceRows.invoices)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erreur technique lors du chargement du rapport.')
      setPurchases([]); setDisbursements([]); setOrders([]); setReceptions([]); setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [profile, reportDate])

  useEffect(() => {
    if (!profile) return
    load().catch(() => toast.error('Impossible de charger le rapport journalier.'))
  }, [load, profile])

  const documentRows = useMemo<DocumentRow[]>(() => [
    ...orders.map((item) => ({
      key: `purchase_order-${item.id}`, type: 'purchase_order' as const, label: 'Commande fournisseur',
      reference: item.reference, date: item.order_date, supplier: item.suppliers?.name ?? 'Non renseigné',
      amount: Number(item.total_amount ?? 0), supplierInvoice: item.supplier_reference ?? '', internalNumber: '',
      documentPresent: (item.purchase_order_documents?.length ?? 0) > 0,
      classified: ['livree', 'cloturee', 'annulee'].includes(item.status), responsible: item.creator?.full_name ?? 'Non disponible',
      problem: !((item.purchase_order_documents?.length ?? 0) > 0) || !['livree', 'cloturee', 'annulee'].includes(item.status) ? [!((item.purchase_order_documents?.length ?? 0) > 0) ? 'Justificatif manquant / à régulariser' : '', !['livree', 'cloturee', 'annulee'].includes(item.status) ? 'Dossier non classé' : ''].filter(Boolean).join(' ; ') : undefined,
      targetUrl: `/purchase-orders/${item.id}`,
    })),
    ...receptions.map((item) => {
      const documentPresent = item.document_count > 0
      return {
        key: `reception-${item.id}`, type: 'reception' as const, label: 'Réception marchandises',
        reference: item.reference, date: item.reception_date, supplier: item.supplier_name ?? 'Non renseigné',
        amount: Number(item.total_amount ?? 0), supplierInvoice: item.invoice_number ?? '', internalNumber: '',
        documentPresent, classified: documentPresent && ['validee', 'cloturee'].includes(item.status),
        responsible: item.receiver_name ?? 'Non disponible', targetUrl: profile?.role === 'caisse' ? '/cash-purchases/report' : `/receptions/${item.id}`,
        problem: !item.invoice_number ? 'Facture fournisseur manquante / à régulariser' : !documentPresent ? 'Justificatif manquant / à régulariser' : item.status === 'validee_avec_anomalies' ? 'Écart de réception ? expliquer' : undefined,
      }
    }),
    ...invoices.map((item) => ({
      key: `invoice-${item.id}`, type: 'invoice' as const, label: 'Facture fournisseur',
      reference: item.reference, date: item.invoice_date, supplier: item.suppliers?.name ?? 'Non renseigné',
      amount: Number(item.amount_ttc ?? 0), supplierInvoice: item.invoice_number ?? '', internalNumber: item.reference,
      documentPresent: Boolean(item.file_url), classified: Boolean(item.file_url) && ['payee', 'cloturee', 'annulee'].includes(item.status),
      responsible: item.creator?.full_name ?? 'Non disponible', targetUrl: `/invoices/${item.id}`,
      problem: !item.file_url ? 'Justificatif manquant / à régulariser' : item.status === 'conteste' ? 'À arbitrer Direction : facture contestée' : undefined,
    })),
  ], [invoices, orders, profile?.role, receptions])

  const alerts = useMemo<DailyDirectionAlert[]>(() => {
    const result: DailyDirectionAlert[] = []
    purchases.forEach((item) => {
      const responsibleName = item.buyer_directory?.full_name ?? item.buyer?.full_name ?? 'Acheteur'
      const documentPresent = (item.cash_purchase_receipts?.length ?? 0) > 0
      const classified = item.status === 'cloture'
      if (!documentPresent) result.push({ key: `cash-doc-${item.id}`, dossier: item.reference, type: 'Achat espèces', amount: Number(item.amount_given ?? item.amount_requested), problem: 'Justificatif manquant / à régulariser', owner: 'Contrôle', action: 'Recevoir et enregistrer le justificatif.', reportType: 'cash_purchase', cashSource: item.cash_source, responsible: responsibleName, documentPresent, classified })
      const hasDifference = Number(item.difference ?? 0) !== 0 || item.cash_purchase_differences?.some((difference) => difference.status !== 'valide')
      if (hasDifference) result.push({ key: `cash-diff-${item.id}`, dossier: item.reference, type: 'Achat espèces', amount: Math.abs(Number(item.difference ?? 0)), problem: 'Écart à expliquer - À arbitrer Direction', owner: 'Direction', action: 'Vérifier le retour et arbitrer l’écart.', reportType: 'cash_purchase', cashSource: item.cash_source, responsible: responsibleName, documentPresent, classified })
      if (Number(item.change_expected ?? 0) > Number(item.change_returned ?? 0)) result.push({ key: `cash-change-${item.id}`, dossier: item.reference, type: 'Achat espèces', amount: Number(item.change_expected ?? 0) - Number(item.change_returned ?? 0), problem: 'Monnaie rendue incomplète', owner: 'Caisse', action: 'Recevoir la monnaie restante.', reportType: 'cash_purchase', cashSource: item.cash_source, responsible: responsibleName, documentPresent, classified })
    })
    documentRows.filter((item) => item.problem).forEach((item) => result.push({
      key: `document-${item.key}`, dossier: item.reference, type: item.label, amount: item.amount,
      problem: item.problem ?? '', owner: item.problem?.includes('Direction') ? 'Direction' : 'Contrôle',
      action: item.problem?.includes('Direction') ? 'Arbitrer le dossier.' : 'Compléter la pièce et régulariser le classement.',
      reportType: item.type, responsible: item.responsible, documentPresent: item.documentPresent, classified: item.classified,
    }))
    disbursements.forEach((item) => {
      const owner = getDisbursementRelay(item).owner
      const documentPresent = item.metadata.supportingDocumentStatus === 'present'
      const classified = item.status === 'closed'
      if (item.status === 'pending_direction') result.push({ key: `non-purchase-validation-${item.id}`, dossier: item.reference, type: 'Décaissement hors achat', amount: Number(item.amount_requested), problem: 'À arbitrer Direction : décaissement à valider', owner: 'Direction', action: 'Valider ou refuser le décaissement.', reportType: 'non_purchase', cashSource: item.cash_source, service: item.metadata.service, responsible: item.requester?.full_name, documentPresent, classified })
      if (!documentPresent) result.push({ key: `non-purchase-doc-${item.id}`, dossier: item.reference, type: 'Décaissement hors achat', amount: Number(item.amount_given ?? item.amount_requested), problem: 'Justificatif manquant / à régulariser', owner, action: 'Joindre et contrôler le justificatif.', reportType: 'non_purchase', cashSource: item.cash_source, service: item.metadata.service, responsible: item.requester?.full_name, documentPresent, classified })
    })
    return result
  }, [disbursements, documentRows, purchases])

  const alertKeys = useMemo(() => new Set(alerts.map((item) => item.key.replace(/^(cash-doc|cash-diff|cash-change|non-purchase-validation|non-purchase-doc|document)-/, ''))), [alerts])
  const sourceAllowed = (type: Exclude<ReportType, 'all'>) => reportType === 'all' || reportType === type
  const documentAllowed = (present: boolean | null) => documentFilter === 'all' || (present !== null && (documentFilter === 'present') === present)
  const classificationAllowed = (classified: boolean) => classificationFilter === 'all' || (classificationFilter === 'classified') === classified
  const responsibleAllowed = (name?: string | null) => responsible === 'all' || name === responsible

  const filteredPurchases = purchases.filter((item) =>
    sourceAllowed('cash_purchase') && (cashSource === 'all' || item.cash_source === cashSource) && service === 'all' &&
    responsibleAllowed(item.buyer_directory?.full_name ?? item.buyer?.full_name) && documentAllowed((item.cash_purchase_receipts?.length ?? 0) > 0) &&
    classificationAllowed(item.status === 'cloture') && (!alertsOnly || alertKeys.has(item.id)))

  const filteredDisbursements = disbursements.filter((item) =>
    sourceAllowed('non_purchase') && (cashSource === 'all' || item.cash_source === cashSource) &&
    (service === 'all' || item.metadata.service === service) && responsibleAllowed(item.requester?.full_name) &&
    documentAllowed(item.metadata.supportingDocumentStatus === 'present') && classificationAllowed(item.status === 'closed') &&
    (!alertsOnly || alertKeys.has(item.id)))

  const filteredDocuments = documentRows.filter((item) =>
    sourceAllowed(item.type) && cashSource === 'all' && service === 'all' && responsibleAllowed(item.responsible) &&
    documentAllowed(item.documentPresent) && classificationAllowed(item.classified) && (!alertsOnly || alertKeys.has(item.key)))

  const visibleAlerts = alerts.filter((item) =>
    sourceAllowed(item.reportType) && (cashSource === 'all' || item.cashSource === cashSource) &&
    (service === 'all' || item.service === service) && responsibleAllowed(item.responsible) &&
    documentAllowed(item.documentPresent ?? null) &&
    (item.classified === undefined || classificationAllowed(item.classified)))

  const openingAlerts: DailyDirectionAlert[] = []
  const uniqueVisibleAlerts = visibleAlerts.filter((item, index, all) => all.findIndex((candidate) => candidate.dossier === item.dossier && candidate.reportType === item.reportType && candidate.problem === item.problem) === index)

  const newAlerts = visibleAlerts
  const regularizedAlerts: DailyDirectionAlert[] = []

  const services = [...new Set(disbursements.map((item) => item.metadata.service).filter(Boolean))].sort()
  const responsibles = [...new Set([
    ...purchases.map((item) => item.buyer_directory?.full_name ?? item.buyer?.full_name), ...disbursements.map((item) => item.requester?.full_name),
    ...documentRows.map((item) => item.responsible),
  ].filter((value): value is string => Boolean(value)))].sort()

  const cashSummary = useMemo(() => ({
    count: filteredPurchases.length,
    given: filteredPurchases.reduce((sum, item) => sum + Number(item.amount_given ?? 0), 0),
    justified: filteredPurchases.reduce((sum, item) => sum + ((item.cash_purchase_receipts?.length ?? 0) > 0 ? Number(item.total_purchased ?? 0) : 0), 0),
    changeReturned: filteredPurchases.reduce((sum, item) => sum + Number(item.change_returned ?? 0), 0),
    difference: filteredPurchases.reduce((sum, item) => sum + Number(item.difference ?? 0), 0),
    unclassified: filteredPurchases.filter((item) => item.status !== 'cloture').length,
  }), [filteredPurchases])

  const nonPurchaseSummary = useMemo(() => ({
    count: filteredDisbursements.length,
    total: filteredDisbursements.reduce((sum, item) => sum + Number(item.amount_given ?? item.amount_validated ?? item.amount_requested), 0),
    documentsPresent: filteredDisbursements.filter((item) => item.metadata.supportingDocumentStatus === 'present').length,
    documentsMissing: filteredDisbursements.filter((item) => item.metadata.supportingDocumentStatus !== 'present').length,
    toValidate: filteredDisbursements.filter((item) => item.status === 'pending_direction').length,
    toRegularize: filteredDisbursements.filter((item) => item.metadata.supportingDocumentStatus !== 'present' || item.status !== 'closed').length,
  }), [filteredDisbursements])

  const documentSummary = {
    orders: filteredDocuments.filter((item) => item.type === 'purchase_order').length,
    receptions: filteredDocuments.filter((item) => item.type === 'reception').length,
    invoices: filteredDocuments.filter((item) => item.type === 'invoice').length,
    missingInvoices: filteredDocuments.filter((item) => item.type === 'reception' && !item.supplierInvoice).length,
    internalNumbers: filteredDocuments.filter((item) => item.internalNumber).length,
    documentsPresent: filteredDocuments.filter((item) => item.documentPresent).length,
    toRegularize: filteredDocuments.filter((item) => !item.documentPresent || !item.classified).length,
  }

  const nonPurchaseCashOut = filteredDisbursements.filter((item) => ['cash_given', 'justified', 'closed'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount_given ?? item.amount_validated ?? item.amount_requested), 0)
  const cashOut = cashSummary.given + nonPurchaseCashOut

  const exportReport = () => {
    exportDailyCashDisbursementReport({
      purchases: filteredPurchases, disbursements: filteredDisbursements, orders: filteredDocuments.filter((item) => item.type === 'purchase_order'),
      receptions: filteredDocuments.filter((item) => item.type === 'reception'), invoices: filteredDocuments.filter((item) => item.type === 'invoice'),
      alerts: visibleAlerts, reportDate,
    })
    toast.success('Rapport journalier exporte avec tous les blocs visibles')
  }

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">Le rapport est incomplet et n’a pas pu être chargé : {error}</div>}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Caisse</p><h1 className="page-title mt-2">Rapport journalier caisse et justificatifs</h1><p className="mt-2 max-w-4xl text-sm text-slate-600">Contrôle quotidien des sorties, retours de monnaie, pièces, dossiers non classés et arbitrages Direction.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="btn-secondary" disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> Actualiser</button>
          <button type="button" onClick={() => window.print()} className="btn-secondary"><Printer className="mr-2 h-4 w-4" /> Imprimer</button>
          <button type="button" onClick={exportReport} className="btn-primary"><Download className="mr-2 h-4 w-4" /> Export Excel</button>
        </div>
      </header>

      <section className="surface grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <Filter label="Date du rapport"><input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} className="input mt-1" /></Filter>
        <Filter label="Caisse / compte source"><select value={cashSource} onChange={(event) => setCashSource(event.target.value as CashPurchaseSource | 'all')} className="input mt-1"><option value="all">Toutes / non disponible</option>{Object.entries(cashPurchaseSourceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Filter>
          <Filter label="Service"><select value={service} onChange={(event) => setService(event.target.value)} className="input mt-1" disabled={services.length === 0}><option value="all">{services.length === 0 ? 'Filtre non disponible faute de donn?es' : 'Tous'}</option>{services.map((value) => <option key={value}>{value}</option>)}</select></Filter>
          <Filter label="Responsable"><select value={responsible} onChange={(event) => setResponsible(event.target.value)} className="input mt-1" disabled={responsibles.length === 0}><option value="all">{responsibles.length === 0 ? 'Filtre non disponible faute de donn?es' : 'Tous'}</option>{responsibles.map((value) => <option key={value}>{value}</option>)}</select></Filter>
        <Filter label="Type de dossier"><select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)} className="input mt-1"><option value="all">Tous</option><option value="cash_purchase">Achat espèces</option><option value="purchase_order">Commande fournisseur</option><option value="reception">Réception marchandises</option><option value="invoice">Facture fournisseur</option><option value="non_purchase">Décaissement hors achat</option></select></Filter>
        <Filter label="Statut justificatif"><select value={documentFilter} onChange={(event) => setDocumentFilter(event.target.value as DocumentFilter)} className="input mt-1"><option value="all">Tous</option><option value="present">Justificatif pr?sent</option><option value="missing">Justificatif manquant / à régulariser</option></select></Filter>
        <Filter label="Statut classement"><select value={classificationFilter} onChange={(event) => setClassificationFilter(event.target.value as ClassificationFilter)} className="input mt-1"><option value="all">Tous</option><option value="classified">Dossier class?</option><option value="unclassified">Dossier non class?</option></select></Filter>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={alertsOnly} onChange={(event) => setAlertsOnly(event.target.checked)} className="h-4 w-4" /> Seulement dossiers avec alerte</label>
      </section>

      <ReportBlock title="1. Achats en especes" metrics={[
        ['Dossiers', cashSummary.count], ['Montant total remis', money(cashSummary.given)], ['Montant total justifie', money(cashSummary.justified)],
        ['Monnaie rendue', money(cashSummary.changeReturned)], ['Écart à expliquer', money(cashSummary.difference)], ['Dossiers non classés', cashSummary.unclassified],
      ]} />
      <ReportBlock title="2. Réceptions marchandises / factures" metrics={[
        ['Commandes trait?es', documentSummary.orders], ['Réceptions du jour', documentSummary.receptions], ['Factures reçues', documentSummary.invoices],
        ['Factures manquantes', documentSummary.missingInvoices], ['Num?ros internes g?n?r?s', documentSummary.internalNumbers],
        ['Justificatifs joints', documentSummary.documentsPresent], ['Dossiers à régulariser', documentSummary.toRegularize],
      ]} />
      <ReportBlock title="3. Décaissements hors achat" metrics={[
        ['Décaissements', nonPurchaseSummary.count], ['Montant total', money(nonPurchaseSummary.total)], ['Justificatifs présents', nonPurchaseSummary.documentsPresent],
        ['Justificatifs manquants', nonPurchaseSummary.documentsMissing], ['? valider Direction', nonPurchaseSummary.toValidate], ['à régulariser', nonPurchaseSummary.toRegularize],
      ]} />
      <ReportBlock title="4. Caisse" metrics={[
        ['Sorties espèces', money(cashOut)], ['Retours monnaie', money(cashSummary.changeReturned)], ['Solde th?orique', 'Non disponible'],
        ['Écarts à expliquer', money(cashSummary.difference)], ['Alertes caisse', visibleAlerts.filter((item) => ['Achat espèces', 'Décaissement hors achat'].includes(item.type)).length],
      ]} />

      <CashPurchaseTable purchases={filteredPurchases} />
      {filteredPurchases.length === 0 && filteredDocuments.length === 0 && filteredDisbursements.length === 0 && <div className="surface p-5 text-center text-sm text-slate-600">Aucun dossier ne correspond aux filtres s?lectionn?s.</div>}
      <DocumentTable rows={filteredDocuments} />
      <NonPurchaseTable rows={filteredDisbursements} />
      <AnomalyBlock title="Anomalies reportées à l’ouverture" subtitle="Dossiers non régularisés avant la date du rapport." rows={openingAlerts} empty="Aucune anomalie reportée à l’ouverture." />
      <AnomalyBlock title="Nouvelles anomalies du jour" subtitle="Problèmes apparus à la date sélectionnée." rows={newAlerts} empty="Aucune nouvelle anomalie ce jour." />
      <AnomalyBlock title="Anomalies régularisées le jour" subtitle="Problèmes corrigés ou clôturés à la date sélectionnée." rows={regularizedAlerts} empty="Aucune anomalie régularisée ce jour." />

      <section className="rounded-lg border-2 border-red-300 bg-red-50 p-4 shadow-sm">
        <div className="border-b border-red-100 bg-red-50 px-5 py-4"><h2 className="font-black text-red-900">Dossier des anomalies / alertes Direction</h2><p className="mt-1 text-sm text-red-800">Problèmes à traiter sans attendre une découverte fortuite.</p></div>
        <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500"><tr><th className="px-4 py-3">Dossier</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Montant</th><th className="px-4 py-3">Problème</th><th className="px-4 py-3">Responsable actuel</th><th className="px-4 py-3">Action attendue</th></tr></thead><tbody className="divide-y divide-slate-100">
          {uniqueVisibleAlerts.map((item) => <tr key={item.key} className="align-top"><td className="px-4 py-4 font-bold text-[#1E3A8A]">{item.dossier}</td><td className="px-4 py-4">{item.type}</td><MoneyCell value={item.amount} /><td className="px-4 py-4 font-semibold text-red-800">{item.problem}</td><td className="px-4 py-4">{item.owner}</td><td className="px-4 py-4">{item.action}</td></tr>)}
          {uniqueVisibleAlerts.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-600">Aucune alerte pour les filtres choisis.</td></tr>}
        </tbody></table></div>
      </section>

    </div>
  )
}

function AnomalyBlock({ title, subtitle, rows, empty }: { title: string; subtitle: string; rows: DailyDirectionAlert[]; empty: string }) {
  return <section className="surface overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-black">{title}</h2><p className="mt-1 text-sm text-slate-600">{subtitle}</p></div><div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-sm"><tbody className="divide-y divide-slate-100">{rows.map((item) => <tr key={item.key}><td className="px-4 py-3 font-bold">{item.dossier}</td><td className="px-4 py-3">{item.type}</td><td className="px-4 py-3">{money(item.amount)}</td><td className="px-4 py-3">{item.problem}</td><td className="px-4 py-3">{item.owner}</td><td className="px-4 py-3">{item.action}</td></tr>)}{rows.length === 0 && <tr><td colSpan={6} className="px-4 py-5 text-center text-slate-600">{empty}</td></tr>}</tbody></table></div></section>
}

function ReportBlock({ title, metrics }: { title: string; metrics: Array<[string, string | number]> }) {
  return <section className="surface p-5"><h2 className="text-lg font-black">{title}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{metrics.map(([label, value]) => <Metric key={label} label={label} value={String(value)} />)}</div></section>
}

function CashPurchaseTable({ purchases }: { purchases: CashPurchase[] }) {
  return <section className="surface overflow-hidden"><div className="border-b px-5 py-4"><h2 className="font-black">Detail achats en especes</h2></div><div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500"><tr><th className="px-4 py-3">Dossier</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Caisse</th><th className="px-4 py-3 text-right">Remis</th><th className="px-4 py-3 text-right">Justifie</th><th className="px-4 py-3 text-right">Monnaie rendue</th><th className="px-4 py-3 text-right">Ecart</th><th className="px-4 py-3">Justificatif / classement</th></tr></thead><tbody className="divide-y">
    {purchases.map((item) => <tr key={item.id}><td className="px-4 py-4"><Link to={`/cash-purchases/${item.id}`} className="font-bold text-[#1E3A8A]">{item.reference}</Link></td><td className="px-4 py-4">{item.buyer_directory?.full_name ?? item.buyer?.full_name ?? 'Non disponible'}</td><td className="px-4 py-4">{cashPurchaseSourceLabels[item.cash_source]}</td><MoneyCell value={item.amount_given} /><MoneyCell value={(item.cash_purchase_receipts?.length ?? 0) > 0 ? item.total_purchased : 0} /><MoneyCell value={item.change_returned} /><MoneyCell value={item.difference} warning={Number(item.difference) !== 0} /><td className="px-4 py-4">{(item.cash_purchase_receipts?.length ?? 0) > 0 ? 'Justificatif pr?sent' : 'Justificatif manquant / à régulariser'}<p className="mt-1 text-xs font-semibold">{item.status === 'cloture' ? 'Dossier class?' : 'Dossier non class?'}</p></td></tr>)}
    {purchases.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-600">Aucun achat en espèces pour ces filtres.</td></tr>}
  </tbody></table></div></section>
}

function DocumentTable({ rows }: { rows: DocumentRow[] }) {
  return <section className="surface overflow-hidden"><div className="border-b px-5 py-4"><h2 className="font-black">Detail commandes / receptions / factures</h2></div><div className="overflow-x-auto"><table className="min-w-[1200px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500"><tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Dossier</th><th className="px-4 py-3">Fournisseur</th><th className="px-4 py-3">Facture fournisseur</th><th className="px-4 py-3">Numero interne</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Justificatif</th><th className="px-4 py-3">Classement</th></tr></thead><tbody className="divide-y">
    {rows.map((item) => <tr key={item.key}><td className="px-4 py-4">{item.label}</td><td className="px-4 py-4"><Link to={item.targetUrl} className="font-bold text-[#1E3A8A]">{item.reference}</Link></td><td className="px-4 py-4">{item.supplier}</td><td className="px-4 py-4">{item.supplierInvoice || '-'}</td><td className="px-4 py-4">{item.internalNumber || '-'}</td><td className="px-4 py-4">{item.responsible}</td><td className="px-4 py-4">{item.documentPresent ? 'Justificatif pr?sent' : 'Justificatif manquant / à régulariser'}</td><td className="px-4 py-4">{item.classified ? 'Dossier class?' : 'Dossier non class?'}</td></tr>)}
    {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-600">Aucun dossier réception/facture pour ces filtres.</td></tr>}
  </tbody></table></div></section>
}

function NonPurchaseTable({ rows }: { rows: NonPurchaseDisbursement[] }) {
  return <section id="hors-achat" className="surface overflow-hidden"><div className="flex justify-between border-b px-5 py-4"><h2 className="font-black">Détail décaissements hors achat</h2></div><div className="overflow-x-auto"><table className="min-w-[1200px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500"><tr><th className="px-4 py-3">Pièce interne</th><th className="px-4 py-3">Type / bénéficiaire</th><th className="px-4 py-3">Caisse / paiement</th><th className="px-4 py-3 text-right">Montant</th><th className="px-4 py-3">Justificatif</th><th className="px-4 py-3">Étape / responsable</th><th className="px-4 py-3">Classement</th></tr></thead><tbody className="divide-y">
    {rows.map((item) => { const relay = getDisbursementRelay(item); return <tr key={item.id}><td className="px-4 py-4"><p className="font-bold text-[#1E3A8A]">{item.reference}</p><p className="text-xs">{nonPurchaseDisbursementStatusLabels[item.status]}</p></td><td className="px-4 py-4"><p>{nonPurchaseDisbursementTypeLabels[item.metadata.type]}</p><p className="text-xs">{item.metadata.beneficiary}</p></td><td className="px-4 py-4"><p>{cashPurchaseSourceLabels[item.cash_source as CashPurchaseSource] ?? item.cash_source}</p><p className="text-xs">{paymentModeLabels[item.metadata.paymentMode]}</p></td><MoneyCell value={item.amount_given ?? item.amount_validated ?? item.amount_requested} /><td className="px-4 py-4">{supportingDocumentStatusLabels[item.metadata.supportingDocumentStatus]}</td><td className="px-4 py-4"><p>{relay.stage}</p><p className="text-xs">{relay.owner}</p></td><td className="px-4 py-4">{relay.classification}</td></tr> })}
    {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-600">Aucun décaissement hors achat pour ces filtres.</td></tr>}
  </tbody></table></div></section>
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-bold text-slate-700">{label}{children}</label>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>
}

function MoneyCell({ value, warning = false }: { value: unknown; warning?: boolean }) {
  return <td className={`px-4 py-4 text-right font-semibold ${warning ? 'text-amber-700' : ''}`}>{money(value)}</td>
}
