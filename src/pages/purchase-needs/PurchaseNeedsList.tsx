import { AlertTriangle, CheckCircle, Clock, Download, FileSpreadsheet, Layers, PackageCheck, Plus, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { autoGroupValidatedNeeds, groupPurchaseNeeds, listPurchaseNeedsGlobal, validatePurchaseNeed, validatePurchaseNeeds, refusePurchaseNeed } from '../../api/modules/purchaseNeeds.api'
import { listFamilies } from '../../api/modules/catalog.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import { exportPurchaseNeedsGlobalToCsv, exportPurchaseNeedsGlobalToExcel } from '../../lib/purchaseNeedExports'
import {
  canCreatePurchaseNeeds,
  canGroupPurchaseNeeds,
  canValidatePurchaseNeeds,
  isNeedExpired,
  needOriginLabels,
  needOrigins,
  needStatusLabels,
  needStatuses,
  needUrgencyLabels,
  needUrgencies,
} from '../../lib/purchaseNeeds'
import type { NeedOrigin, NeedStatus, NeedUrgency, PurchaseNeedGlobal } from '../../lib/purchaseNeeds'
import type { Family } from '../../lib/catalog'
import type { Supplier } from '../../lib/suppliers'

export function PurchaseNeedsList() {
  const { profile } = useAuth()
  const canCreate = canCreatePurchaseNeeds(profile?.role)
  const canValidate = canValidatePurchaseNeeds(profile?.role)
  const canGroup = canGroupPurchaseNeeds(profile?.role)
  const [needs, setNeeds] = useState<PurchaseNeedGlobal[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [groupSupplierId, setGroupSupplierId] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<NeedStatus | 'all'>('all')
  const [origin, setOrigin] = useState<NeedOrigin | 'all'>('all')
  const [urgency, setUrgency] = useState<NeedUrgency | 'all'>('all')
  const [familyId, setFamilyId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, status, origin, urgency, familyId, page, pageSize }), [familyId, origin, page, search, status, urgency])

  const load = useCallback(async () => {
    const result = await listPurchaseNeedsGlobal(filters)
    setNeeds(result.needs)
    setTotal(result.total)
  }, [filters])

  useEffect(() => {
    Promise.all([listFamilies(), listSuppliers()])
      .then(([loadedFamilies, loadedSuppliers]) => {
        setFamilies(loadedFamilies)
        setSuppliers(loadedSuppliers)
      })
      .catch(() => toast.error('Impossible de charger les referentiels.'))
  }, [])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger les besoins.'))
  }, [load])

  const resetPage = (callback: () => void) => {
    setPage(1)
    callback()
  }

  const selectedNeeds = needs.filter((need) => selectedIds.includes(need.id))
  const selectedGroupId = selectedNeeds.length > 0 && selectedNeeds.every((need) => need.group_id && need.group_id === selectedNeeds[0].group_id) ? selectedNeeds[0].group_id : ''
  const dashboard = useMemo(() => ({
    total: needs.length,
    pending: needs.filter((need) => need.status === 'a_faire').length,
    urgent: needs.filter((need) => need.urgency !== 'normal').length,
    estimated: needs.reduce((sum, need) => sum + Number(need.estimated_cost ?? 0), 0),
    budget: needs.reduce((sum, need) => sum + Number(need.budget ?? 0), 0),
  }), [needs])

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const validateOne = async (id: string) => {
    await validatePurchaseNeed(id, profile?.id)
    toast.success('Besoin valide avec succes')
    await load()
  }

  const refuseOne = async (id: string) => {
    const reason = window.prompt('Motif du refus')
    if (!reason) return
    await refusePurchaseNeed(id, profile?.id, reason)
    toast.success('Besoin refuse')
    await load()
  }

  const validateSelected = async () => {
    await validatePurchaseNeeds(selectedIds, profile?.id)
    toast.success('Besoins valides avec succes')
    setSelectedIds([])
    await load()
  }

  const groupSelected = async () => {
    await groupPurchaseNeeds(selectedIds, groupSupplierId, profile?.id)
    toast.success('Besoins regroupes avec succes')
    setSelectedIds([])
    setGroupSupplierId('')
    await load()
  }

  const autoGroup = async () => {
    const count = await autoGroupValidatedNeeds(profile?.id)
    toast.success(`${count} besoin(s) regroupes avec succes`)
    await load()
  }

  const exportAll = async (format: 'csv' | 'excel') => {
    const result = await listPurchaseNeedsGlobal({ ...filters, page: 1, pageSize: 10000 })
    if (format === 'csv') exportPurchaseNeedsGlobalToCsv(result.needs)
    else exportPurchaseNeedsGlobalToExcel(result.needs)
    toast.success('Besoins exportes avec succes')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Achats</p><h1 className="page-title mt-2">Besoins d'achat</h1></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportAll('csv')} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>
          <button type="button" onClick={() => exportAll('excel')} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>
          {canGroup && <button type="button" onClick={autoGroup} className="btn-secondary"><RefreshCw className="mr-2 h-4 w-4" /> Auto-regrouper</button>}
          {canCreate && <Link to="/purchase-needs/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouveau besoin</Link>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <Metric icon={<PackageCheck className="h-5 w-5" />} label="Total" value={String(dashboard.total)} tone="blue" />
        <Metric icon={<Clock className="h-5 w-5" />} label="A valider" value={String(dashboard.pending)} tone="amber" />
        <Metric icon={<AlertTriangle className="h-5 w-5" />} label="Urgents" value={String(dashboard.urgent)} tone="red" />
        <Metric label="Cout estime" value={`${dashboard.estimated.toLocaleString('fr-FR')} Ar`} tone="slate" />
        <Metric label="Budget" value={`${dashboard.budget.toLocaleString('fr-FR')} Ar`} tone="slate" />
      </section>

      <section className="surface grid gap-3 p-4 xl:grid-cols-[1fr_150px_170px_150px_180px]">
        <input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} className="input" placeholder="Rechercher article ou commentaire" />
        <select value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as NeedStatus | 'all'))} className="input"><option value="all">Tous statuts</option>{needStatuses.map((item) => <option key={item} value={item}>{needStatusLabels[item]}</option>)}</select>
        <select value={origin} onChange={(event) => resetPage(() => setOrigin(event.target.value as NeedOrigin | 'all'))} className="input"><option value="all">Toutes origines</option>{needOrigins.map((item) => <option key={item} value={item}>{needOriginLabels[item]}</option>)}</select>
        <select value={urgency} onChange={(event) => resetPage(() => setUrgency(event.target.value as NeedUrgency | 'all'))} className="input"><option value="all">Toutes urgences</option>{needUrgencies.map((item) => <option key={item} value={item}>{needUrgencyLabels[item]}</option>)}</select>
        <select value={familyId} onChange={(event) => resetPage(() => setFamilyId(event.target.value))} className="input"><option value="">Toutes familles</option>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select>
      </section>

      {selectedIds.length > 0 && (
        <section className="surface flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm font-semibold">{selectedIds.length} besoin(s) selectionne(s)</p>
          <div className="flex flex-wrap gap-2">
            {canValidate && <button type="button" onClick={validateSelected} className="btn-secondary"><CheckCircle className="mr-2 h-4 w-4" /> Valider</button>}
            {canGroup && (
              <>
                <select value={groupSupplierId} onChange={(event) => setGroupSupplierId(event.target.value)} className="input w-64"><option value="">Fournisseur</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
                <button type="button" onClick={groupSelected} className="btn-primary"><Layers className="mr-2 h-4 w-4" /> Regrouper</button>
                {selectedGroupId && <Link to={`/purchase-orders/new?groupId=${selectedGroupId}`} className="btn-secondary">Creer commande</Link>}
              </>
            )}
            <span className="text-sm text-slate-500">Total selection: {selectedNeeds.reduce((sum, need) => sum + Number(need.estimated_cost ?? 0), 0).toLocaleString('fr-FR')} Ar</span>
          </div>
        </section>
      )}

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[44px_1.45fr_0.9fr_1fr_1fr_0.9fr_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span></span><span>Besoin</span><span>Quantite</span><span>Origine</span><span>Budget</span><span>Demandeur</span><span>Actions</span>
        </div>
        <div className="divide-y divide-slate-200">
          {needs.map((need) => (
            <div key={need.id} className={`grid gap-4 px-5 py-4 xl:grid-cols-[44px_1.45fr_0.9fr_1fr_1fr_0.9fr_120px] xl:items-center ${isNeedExpired(need) ? 'bg-red-50/80' : 'hover:bg-slate-50'}`}>
              <input type="checkbox" checked={selectedIds.includes(need.id)} onChange={() => toggleSelection(need.id)} className="mt-1 h-4 w-4 xl:mt-0" />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-950">{need.articles?.name}</p>
                  <Badge className={statusClass(need.status)}>{needStatusLabels[need.status]}</Badge>
                  <Badge className={urgencyClass(need.urgency)}>{needUrgencyLabels[need.urgency]}</Badge>
                  {isNeedExpired(need) && <Badge className="bg-red-100 text-red-800">Date depassee</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {need.articles?.families?.name || 'Sans famille'}
                  {need.articles?.min_stock ? ` - seuil minimum ${need.articles.min_stock}` : ''}
                  {need.suppliers?.name || need.articles?.default_supplier ? ` - fournisseur ${need.suppliers?.name || need.articles?.default_supplier}` : ''}
                </p>
                {need.comment && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{need.comment}</p>}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-950">{Number(need.quantity ?? need.quantity_needed).toLocaleString('fr-FR')} {need.units?.abbreviation}</p>
                <p className="mt-1 text-xs text-slate-500">Prix {Number(need.estimated_price ?? 0).toLocaleString('fr-FR')} Ar</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">{needOriginLabels[need.origin]}</p>
                <p className="mt-1 text-xs text-slate-500">{need.events?.name || (need.requested_date ? `Souhaite le ${new Date(need.requested_date).toLocaleDateString('fr-FR')}` : 'Sans date souhaitee')}</p>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-950">{Number(need.estimated_cost ?? 0).toLocaleString('fr-FR')} Ar</p>
                <p className="mt-1 text-xs text-slate-500">Budget {Number(need.budget ?? 0).toLocaleString('fr-FR')} Ar</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">{need.requester?.full_name || '-'}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(need.created_at).toLocaleDateString('fr-FR')}</p>
              </div>

              <div className="flex gap-2 xl:justify-end">
                {canValidate && need.status === 'a_faire' && <button type="button" onClick={() => validateOne(need.id)} className="btn-secondary"><CheckCircle className="h-4 w-4" /></button>}
                {canValidate && need.status === 'a_faire' && <button type="button" onClick={() => refuseOne(need.id)} className="btn-secondary text-red-700"><XCircle className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
          {needs.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun besoin trouve.</p>}
        </div>
      </section>

      <div className="flex justify-between gap-3">
        <p className="text-sm text-slate-600">Page {page} sur {totalPages}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Precedent</button>
          <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Suivant</button>
        </div>
      </div>
    </div>
  )
}

function Metric({ icon, label, value, tone }: { icon?: React.ReactNode; label: string; value: string; tone: 'blue' | 'amber' | 'red' | 'slate' }) {
  const color = {
    blue: 'bg-blue-50 text-[#1E3A8A]',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-800',
    slate: 'bg-slate-50 text-slate-700',
  }[tone]

  return (
    <div className="surface p-5">
      <div className="flex items-center gap-3">
        {icon && <span className={`flex h-10 w-10 items-center justify-center rounded-md ${color}`}>{icon}</span>}
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 font-bold text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{children}</span>
}

function statusClass(status: NeedStatus) {
  return {
    a_faire: 'bg-yellow-50 text-yellow-800',
    en_cours: 'bg-blue-50 text-blue-800',
    valide: 'bg-emerald-50 text-emerald-800',
    regroupe: 'bg-purple-50 text-purple-800',
    refuse: 'bg-red-50 text-red-800',
    annule: 'bg-slate-100 text-slate-700',
  }[status]
}

function urgencyClass(urgency: NeedUrgency) {
  return {
    normal: 'bg-emerald-50 text-emerald-800',
    urgent: 'bg-orange-50 text-orange-800',
    tres_urgent: 'bg-red-50 text-red-800',
  }[urgency]
}
