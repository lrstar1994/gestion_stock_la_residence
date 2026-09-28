import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPurchaseHistory } from '../../api/modules/purchaseHistory.api'
import type { PurchaseHistoryDocumentStatus, PurchaseHistoryItem, PurchaseHistorySource } from '../../lib/purchaseHistory'
import { purchaseHistoryDocumentStatusLabels, purchaseHistorySourceLabels } from '../../lib/purchaseHistory'
import { useAuth } from '../../hooks/useAuth'

const sourceFilters: Array<PurchaseHistorySource | 'all'> = ['all', 'cash_purchase', 'purchase_order', 'reception', 'invoice', 'non_purchase_disbursement']

function normalize(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function PurchaseHistoryPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<PurchaseHistoryItem[]>([])
  const [source, setSource] = useState<PurchaseHistorySource | 'all'>('all')
  const [search, setSearch] = useState('')
  const [supplier, setSupplier] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [internalNumber, setInternalNumber] = useState('')
  const [article, setArticle] = useState('')
  const [status, setStatus] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [location, setLocation] = useState('')
  const [responsible, setResponsible] = useState('')
  const [documentStatus, setDocumentStatus] = useState<PurchaseHistoryDocumentStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    let ignore = false
    setLoading(true)
    setError(null)
    listPurchaseHistory(profile.role)
      .then((data) => { if (!ignore) setRows(data) })
      .catch(() => { if (!ignore) setError("Impossible de charger l'historique achats.") })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [profile])

  const suppliers = useMemo(() => [...new Set(rows.map((row) => row.supplierName).filter((value): value is string => Boolean(value)))].sort(), [rows])
  const statuses = useMemo(() => [...new Set(rows.map((row) => row.status).filter(Boolean))].sort(), [rows])
  const locations = useMemo(() => [...new Set(rows.map((row) => row.locationName).filter((value): value is string => Boolean(value)))].sort(), [rows])
  const responsibles = useMemo(() => [...new Set(rows.map((row) => row.responsibleName).filter((value): value is string => Boolean(value)))].sort(), [rows])

  const filteredRows = useMemo(() => rows.filter((row) => {
    const globalText = normalize([row.reference, row.label, row.supplierName, row.status, row.supplierInvoiceNumber, row.internalNumber, row.locationName, row.responsibleName, ...row.articleNames].filter(Boolean).join(' '))
    if (search.trim() && !globalText.includes(normalize(search.trim()))) return false
    if (source !== 'all' && row.source !== source) return false
    if (supplier && row.supplierName !== supplier) return false
    if (fromDate && row.date.slice(0, 10) < fromDate) return false
    if (toDate && row.date.slice(0, 10) > toDate) return false
    if (supplierInvoiceNumber.trim() && !normalize(row.supplierInvoiceNumber).includes(normalize(supplierInvoiceNumber.trim()))) return false
    if (internalNumber.trim() && !normalize(row.internalNumber).includes(normalize(internalNumber.trim()))) return false
    if (article.trim() && !row.articleNames.some((name) => normalize(name).includes(normalize(article.trim())))) return false
    if (status && row.status !== status) return false
    if (minAmount && Number(row.amount ?? 0) < Number(minAmount)) return false
    if (maxAmount && Number(row.amount ?? 0) > Number(maxAmount)) return false
    if (location && row.locationName !== location) return false
    if (responsible && row.responsibleName !== responsible) return false
    if (documentStatus !== 'all' && row.documentStatus !== documentStatus) return false
    return true
  }), [article, documentStatus, fromDate, internalNumber, location, maxAmount, minAmount, responsible, rows, search, source, status, supplier, supplierInvoiceNumber, toDate])

  const resetFilters = () => {
    setSource('all'); setSearch(''); setSupplier(''); setFromDate(''); setToDate(''); setSupplierInvoiceNumber('')
    setInternalNumber(''); setArticle(''); setStatus(''); setMinAmount(''); setMaxAmount(''); setLocation('')
    setResponsible(''); setDocumentStatus('all')
  }

  return (
    <div className="space-y-6">
      <header className="surface p-6">
        <p className="eyebrow">Achats</p>
        <h1 className="page-title mt-2">Historique achats</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-600">Retrouvez besoins, achats especes, commandes, receptions marchandises, factures fournisseurs, pieces internes et decaissements hors achat autorises.</p>
      </header>

      <section className="surface p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Filter label="Recherche globale"><input value={search} onChange={(event) => setSearch(event.target.value)} className="input mt-1" placeholder="Reference, fournisseur, article, statut..." /></Filter>
          <Filter label="Fournisseur / beneficiaire"><select value={supplier} onChange={(event) => setSupplier(event.target.value)} className="input mt-1"><option value="">Tous</option>{suppliers.map((value) => <option key={value}>{value}</option>)}</select></Filter>
          <Filter label="Periode du"><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="input mt-1" /></Filter>
          <Filter label="Au"><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="input mt-1" /></Filter>
          <Filter label="Numero facture fournisseur"><input value={supplierInvoiceNumber} onChange={(event) => setSupplierInvoiceNumber(event.target.value)} className="input mt-1" /></Filter>
          <Filter label="Numero interne de classement"><input value={internalNumber} onChange={(event) => setInternalNumber(event.target.value)} className="input mt-1" /></Filter>
          <Filter label="Article"><input value={article} onChange={(event) => setArticle(event.target.value)} className="input mt-1" placeholder="Farine, sucre, salade..." /></Filter>
          <Filter label="Type de dossier"><select value={source} onChange={(event) => setSource(event.target.value as PurchaseHistorySource | 'all')} className="input mt-1">{sourceFilters.map((value) => <option key={value} value={value}>{value === 'all' ? 'Tous les types' : purchaseHistorySourceLabels[value]}</option>)}</select></Filter>
          <Filter label="Statut"><select value={status} onChange={(event) => setStatus(event.target.value)} className="input mt-1"><option value="">Tous</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></Filter>
          <Filter label="Montant minimum"><input type="number" min="0" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} className="input mt-1" /></Filter>
          <Filter label="Montant maximum"><input type="number" min="0" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} className="input mt-1" /></Filter>
          <Filter label="Localisation"><select value={location} onChange={(event) => setLocation(event.target.value)} className="input mt-1"><option value="">Toutes</option>{locations.map((value) => <option key={value}>{value}</option>)}</select></Filter>
          <Filter label="Responsable / utilisateur"><select value={responsible} onChange={(event) => setResponsible(event.target.value)} className="input mt-1"><option value="">Tous</option>{responsibles.map((value) => <option key={value}>{value}</option>)}</select></Filter>
          <Filter label="Justificatif"><select value={documentStatus} onChange={(event) => setDocumentStatus(event.target.value as PurchaseHistoryDocumentStatus | 'all')} className="input mt-1"><option value="all">Tous</option><option value="present">Present</option><option value="missing">Manquant</option><option value="regularize">A regulariser</option></select></Filter>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-600">{filteredRows.length} resultat(s) sur {rows.length}</p><button type="button" onClick={resetFilters} className="btn-secondary">Reinitialiser les filtres</button></div>
      </section>

      {loading && <div className="surface p-5 text-sm text-slate-600">Chargement de l'historique...</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      {!loading && !error && (
        <section className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1450px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500"><tr>
                <th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Reference dossier</th>
                <th className="px-4 py-3">Fournisseur</th><th className="px-4 py-3">Articles</th><th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3">Statut</th><th className="px-4 py-3">Numero facture fournisseur</th>
                <th className="px-4 py-3">Numero interne de classement</th><th className="px-4 py-3">Justificatif</th><th className="px-4 py-3">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => <tr key={`${row.source}-${row.id}`} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-4">{formatDate(row.date)}</td>
                  <td className="px-4 py-4 font-bold text-[#1E3A8A]">{purchaseHistorySourceLabels[row.source]}</td>
                  <td className="px-4 py-4"><p className="font-bold">{row.reference || 'Non renseigne'}</p><p className="mt-1 max-w-xs text-xs text-slate-500">{row.label}</p></td>
                  <td className="px-4 py-4">{row.supplierName || 'Non renseigne'}</td>
                  <td className="max-w-xs px-4 py-4">{row.articleNames.length > 0 ? row.articleNames.join(', ') : '-'}</td>
                  <td className="px-4 py-4 text-right font-semibold">{formatAmount(row.amount)}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{row.status || 'Non renseigne'}</span></td>
                  <td className="px-4 py-4">{row.supplierInvoiceNumber || '-'}</td>
                  <td className="px-4 py-4">{row.internalNumber || '-'}</td>
                  <td className="px-4 py-4">{purchaseHistoryDocumentStatusLabels[row.documentStatus]}</td>
                  <td className="px-4 py-4"><Link to={row.targetUrl} className="font-bold text-[#1E3A8A] hover:underline">Ouvrir le detail</Link></td>
                </tr>)}
                {filteredRows.length === 0 && <tr><td colSpan={11} className="px-5 py-6 text-center text-sm text-slate-600">Aucun historique ne correspond aux filtres. <button type="button" onClick={resetFilters} className="ml-2 font-bold text-[#1E3A8A]">Reinitialiser les filtres</button></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-bold text-slate-700">{label}{children}</label>
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '-'
}

function formatAmount(value?: number | null) {
  if (value === null || value === undefined) return '-'
  return `${Number(value).toLocaleString('fr-FR')} Ar`
}
