import { AlertTriangle, CheckCircle, Clock, Download, FileSpreadsheet, Layers, PackageCheck, Plus, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { autoGroupValidatedNeeds, cancelPurchaseNeed, groupPurchaseNeeds, listPurchaseNeedsGlobal } from '../../api/modules/purchaseNeeds.api'
import { createPurchaseOrderFromGroup } from '../../api/modules/purchaseOrders.api'
import { listFamilies } from '../../api/modules/catalog.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import { exportPurchaseNeedsGlobalToCsv, exportPurchaseNeedsGlobalToExcel } from '../../lib/purchaseNeedExports'
import {
  canCreatePurchaseNeeds,
  canGroupPurchaseNeeds,
  canValidatePurchaseNeeds,
  businessOriginLabels,
  getPurchaseNeedIntendedUseLabel,
  isNeedExpired,
  needCalculationSourceLabels,
  needCalculationSources,
  needDestinationLabels,
  needDestinations,
  needStatusLabels,
  needStatuses,
  needTypeLabels,
  needTypes,
  needUrgencyLabels,
  needUrgencies,
  supplyDifficultyLabels,
  workflowStatusLabels,
} from '../../lib/purchaseNeeds'
import type { BusinessOrigin, NeedCalculationSource, NeedDestination, NeedStatus, NeedType, NeedUrgency, PurchaseNeedGlobal, SupplyDifficulty, WorkflowStatus } from '../../lib/purchaseNeeds'
import type { Family } from '../../lib/catalog'
import type { Supplier } from '../../lib/suppliers'

type ProposedGroup = {
  key: string
  supplierId: string
  supplierName: string
  requestedDate: string
  ids: string[]
  articleNames: string[]
  count: number
  total: number
  highestUrgency: NeedUrgency
}
function getNeedRequestLabel(status: NeedStatus) {
  if (status === 'a_faire') return 'en attente validation Direction'
  if (status === 'refuse') return 'refusée par la Direction'
  return 'validée par la Direction'
}
function getNeedTreatmentLabel(need: PurchaseNeedGlobal) {
  const processing = need.processing
  if (!processing) return 'aucun traitement démarré'
  if (processing.kind === 'cash') {
    if (processing.stockEntryStatus === 'entree_stock_faite') return 'achat espèces — stock intégré'
    if (processing.receptionStatus === 'reception_avec_anomalie') return 'réception fournisseur — écart à arbitrer'
    if (processing.status === 'en_attente') return 'achat espèces — attente validation décaissement Direction'
    if (processing.status === 'valide') return 'achat espèces — attente remise Caisse'
    if (processing.status === 'especes_remises') return 'achat espèces — retour achat à contrôler'
    return 'achat espèces — relais Magasin / Stock'
  }
  if (processing.status === 'brouillon') return 'commande fournisseur — en attente validation commande'
  if (processing.status === 'envoyee') return 'commande fournisseur — en attente livraison/réception'
  if (processing.status === 'livree') return 'commande fournisseur — réception terminée'
  return 'commande fournisseur — commande créée'
}

function getNeedUrgencyLabel(urgency: NeedUrgency) {
  if (urgency === 'urgent') return 'urgente'
  if (urgency === 'tres_urgent') return 'très urgente'
  return 'normale'
}
function isTreatmentExpected(need: PurchaseNeedGlobal) {
  const row = need as PurchaseNeedGlobal & { decision_status?: string; processing_mode?: string }
  return need.status === 'valide' || need.status === 'regroupe' || ['cash', 'supplier', 'to_reorient'].includes(row.processing_mode ?? '') || row.decision_status === 'approved'
}

export function PurchaseNeedsList() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const focusId = searchParams.get('focus') ?? ''
  const canCreate = canCreatePurchaseNeeds(profile?.role)
  const canValidate = canValidatePurchaseNeeds(profile?.role)
  const canGroup = canGroupPurchaseNeeds(profile?.role)
  const [needs, setNeeds] = useState<PurchaseNeedGlobal[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [groupSupplierId, setGroupSupplierId] = useState('')
  const [processingMode, setProcessingMode] = useState<'supplier' | 'cash'>('supplier')
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [status, setStatus] = useState<NeedStatus | 'all' | 'open'>('open')
  const [type, setType] = useState<NeedType | 'all'>('all')
  const [destination, setDestination] = useState<NeedDestination | 'all'>('all')
  const [source, setSource] = useState<NeedCalculationSource | 'all'>('all')
  const [urgency, setUrgency] = useState<NeedUrgency | 'all'>('all')
  const [familyId, setFamilyId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const loadErrorShown = useRef(false)
  const needRowRefs = useRef(new Map<string, HTMLDivElement>())
  const lastScrolledFocusId = useRef('')
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  useEffect(() => {
    setSearch(searchParams.get('search') ?? '')
  }, [searchParams])
  const filters = useMemo(() => {
    if (focusId) return { id: focusId, status: 'all' as const, page: 1, pageSize: 1 }
    return { search, status, type, destination, source, urgency, familyId, page, pageSize }
  }, [destination, familyId, focusId, page, search, source, status, type, urgency])

  const load = useCallback(async () => {
    const result = await listPurchaseNeedsGlobal(filters)
    const visible = focusId ? result.needs.filter((need) => need.id === focusId) : result.needs
    setNeeds(visible)
    setTotal(focusId ? visible.length : result.total)
  }, [filters, focusId])

  useEffect(() => {
    Promise.all([listFamilies(), listSuppliers()])
      .then(([loadedFamilies, loadedSuppliers]) => {
        setFamilies(loadedFamilies)
        setSuppliers(loadedSuppliers)
      })
      .catch(() => toast.error('Impossible de charger les referentiels.'))
  }, [])

  useEffect(() => {
    load().then(() => { loadErrorShown.current = false }).catch(() => { if (!loadErrorShown.current) { toast.error('Impossible de charger les besoins.'); loadErrorShown.current = true } })
  }, [load])

  useEffect(() => {
    if (!focusId) {
      lastScrolledFocusId.current = ''
      return
    }
    if (lastScrolledFocusId.current === focusId) return
    const row = needRowRefs.current.get(focusId)
    if (!row) return
    row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    lastScrolledFocusId.current = focusId
  }, [focusId, needs])

  const resetPage = (callback: () => void) => {
    setPage(1)
    callback()
  }

  const selectedNeeds = needs.filter((need) => selectedIds.includes(need.id))
  const canProcessSelected = selectedNeeds.length > 0 && selectedNeeds.every((need) => need.status === 'valide')
  const dashboard = useMemo(() => ({
    total: needs.length,
    pending: needs.filter((need) => need.status === 'a_faire').length,
    urgent: needs.filter((need) => need.urgency !== 'normal').length,
    estimated: needs.reduce((sum, need) => sum + Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0), 0),
    budget: needs.reduce((sum, need) => sum + Number(need.budget ?? 0), 0),
  }), [needs])
  const proposedGroups = useMemo(() => buildProposedGroups(needs), [needs])
  const visualConsolidation = useMemo(() => buildVisualConsolidation(needs), [needs])

  const toggleSelection = (id: string) => {
    const need = needs.find((item) => item.id === id)
    if (!need || ['regroupe', 'refuse', 'annule'].includes(need.status)) return
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const validateOne = async (id: string) => {
    void id
    navigate('/validations/my')
  }

  const cancelOne = async (id: string) => {
    const reason = window.prompt('Motif de classement sans suite (Doublon, Erreur de saisie, Test, Besoin remplacé ou Autre)')
    if (!reason) return
    try {
      await cancelPurchaseNeed(id, profile?.id, reason)
      toast.success('Besoin classé sans suite')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de classer ce besoin sans suite')
    }
  }

  const groupSelected = async () => {
    try {
      const result = await groupPurchaseNeeds(selectedIds, groupSupplierId, profile?.id)
      if (!result) return
      const orderId = await createPurchaseOrderFromGroup(result.groupId, profile?.id)
      toast.success(`Commande fournisseur ${orderId} creee pour ${result.supplierName} (${result.needIds.length} besoin(s))`)
      setSelectedIds([])
      setGroupSupplierId('')
      navigate(`/purchase-orders/${orderId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Regroupement impossible')
    }
  }

  const groupProposal = async (proposal: ProposedGroup) => {
    try {
      const result = await groupPurchaseNeeds(proposal.ids, proposal.supplierId, profile?.id)
      if (!result) return
      const orderId = await createPurchaseOrderFromGroup(result.groupId, profile?.id)
      toast.success(`Commande fournisseur ${orderId} creee pour ${result.supplierName} (${result.needIds.length} besoin(s))`)
      setSelectedIds([])
      navigate(`/purchase-orders/${orderId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Regroupement impossible')
    }
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
          {canCreate && <Link to="/purchase-needs/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> + Créer un besoin d’achat</Link>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <Metric icon={<PackageCheck className="h-5 w-5" />} label="Total" value={String(dashboard.total)} tone="blue" />
        <Metric icon={<Clock className="h-5 w-5" />} label="A valider" value={String(dashboard.pending)} tone="amber" />
        <Metric icon={<AlertTriangle className="h-5 w-5" />} label="Urgents" value={String(dashboard.urgent)} tone="red" />
        <Metric label="Cout estime" value={`${dashboard.estimated.toLocaleString('fr-FR')} Ar`} tone="slate" />
        <Metric label="Budget" value={`${dashboard.budget.toLocaleString('fr-FR')} Ar`} tone="slate" />
      </section>

      <section className="surface grid gap-3 p-4 xl:grid-cols-[1fr_150px_190px_210px_190px_150px_180px]">
        <input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} className="input" placeholder="Rechercher article ou commentaire" />
        <select value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as NeedStatus | 'all' | 'open'))} className="input"><option value="open">A traiter</option><option value="all">Tous statuts</option>{needStatuses.map((item) => <option key={item} value={item}>{needStatusLabels[item]}</option>)}</select>
        <select value={type} onChange={(event) => resetPage(() => setType(event.target.value as NeedType | 'all'))} className="input"><option value="all">Tous types</option>{needTypes.map((item) => <option key={item} value={item}>{needTypeLabels[item]}</option>)}</select>
        <select value={destination} onChange={(event) => resetPage(() => setDestination(event.target.value as NeedDestination | 'all'))} className="input"><option value="all">Toutes destinations</option>{needDestinations.map((item) => <option key={item} value={item}>{needDestinationLabels[item]}</option>)}</select>
        <select value={source} onChange={(event) => resetPage(() => setSource(event.target.value as NeedCalculationSource | 'all'))} className="input"><option value="all">Toutes sources</option>{needCalculationSources.map((item) => <option key={item} value={item}>{needCalculationSourceLabels[item]}</option>)}</select>
        <select value={urgency} onChange={(event) => resetPage(() => setUrgency(event.target.value as NeedUrgency | 'all'))} className="input"><option value="all">Toutes urgences</option>{needUrgencies.map((item) => <option key={item} value={item}>{needUrgencyLabels[item]}</option>)}</select>
        <select value={familyId} onChange={(event) => resetPage(() => setFamilyId(event.target.value))} className="input"><option value="">Toutes familles</option>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select>
      </section>

{selectedIds.length > 0 && (
        <section className="surface space-y-4 p-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">Traiter les besoins validés</h2>
            <p className="mt-1 text-sm text-slate-600">Sélectionnez les besoins validés, puis choisissez le mode de traitement.</p>
          </div>
          <div className="rounded-md bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-700">Étape 1 — Sélectionner les besoins</p>
              <p className="mt-1 text-sm">{selectedIds.length} besoin(s) sélectionné(s) — Total estimé à payer : {selectedNeeds.reduce((sum, need) => sum + Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0), 0).toLocaleString('fr-FR')} Ar</p>
          </div>
          {canGroup && <div className="rounded-md bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-700">Étape 2 — Sélectionner comment acheter</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setProcessingMode('supplier')} className={processingMode === 'supplier' ? 'btn-primary' : 'btn-secondary'} disabled={!canProcessSelected}>Commande fournisseur</button>
              <span className="text-xs font-bold text-slate-500">OU</span>
              <button type="button" onClick={() => setProcessingMode('cash')} className={processingMode === 'cash' ? 'btn-primary' : 'btn-secondary'} disabled={!canProcessSelected}>Achat espèces</button>
            </div>
          </div>}
          {canGroup && <div className="rounded-md bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-700">Étape 3 — Compléter selon le mode choisi</p>
            {processingMode === 'supplier' && <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold">Fournisseur<select value={groupSupplierId} onChange={(event) => setGroupSupplierId(event.target.value)} className="input mt-1 w-64"><option value="">Choisir un fournisseur</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <button type="button" disabled={!canProcessSelected || !groupSupplierId} onClick={groupSelected} className="btn-primary disabled:opacity-50"><Layers className="mr-2 h-4 w-4" /> {selectedNeeds.length > 1 ? 'Créer commande fournisseur groupée' : 'Créer commande fournisseur'}</button>
              {!groupSupplierId && <span className="text-xs font-semibold text-amber-700">Choisissez le fournisseur avant de créer la commande.</span>}
            </div>}
            {processingMode === 'cash' && <div className="mt-2 flex flex-wrap items-center gap-3"><p className="text-sm text-slate-600">Le fournisseur réel sera renseigné au retour d’achat.</p><button type="button" disabled={!canProcessSelected} onClick={() => navigate(`/cash-purchases/new?needIds=${selectedIds.join(',')}`)} className="btn-primary disabled:opacity-50"><PackageCheck className="mr-2 h-4 w-4" /> Créer achat espèces</button></div>}
          </div>}
        </section>
      )}

      {canGroup && proposedGroups.length > 0 && (
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">Groupes proposes</h2>
            <p className="mt-1 text-sm text-slate-600">Besoins valides, meme fournisseur et meme date souhaitee. Un clic suffit pour les regrouper.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {proposedGroups.map((proposal) => (
              <div key={proposal.key} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.3fr_150px_110px_150px_1fr_auto] lg:items-center">
                <div>
                  <p className="font-bold text-slate-950">{proposal.supplierName}</p>
                  <p className="mt-1 text-xs text-slate-500">{proposal.articleNames.join(', ')}</p>
                </div>
                <div>
                  <p className="field-label">Date souhaitee</p>
                  <p className="mt-1 font-semibold">{proposal.requestedDate ? new Date(proposal.requestedDate).toLocaleDateString('fr-FR') : 'Sans date'}</p>
                </div>
                <div>
                  <p className="field-label">Lignes</p>
                  <p className="mt-1 font-semibold">{proposal.count}</p>
                </div>
                <div>
                  <p className="field-label">Total HT</p>
                  <p className="mt-1 font-semibold">{proposal.total.toLocaleString('fr-FR')} Ar</p>
                </div>
                <div>
                  <Badge className={urgencyClass(proposal.highestUrgency)}>{needUrgencyLabels[proposal.highestUrgency]}</Badge>
                </div>
                <button type="button" onClick={() => groupProposal(proposal)} className="btn-primary">
                  <Layers className="mr-2 h-4 w-4" /> Regrouper
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {visualConsolidation.length > 0 && (
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold">Consolidation visuelle par article</h2>
            <p className="mt-1 text-sm text-slate-600">Résumé de la page chargée uniquement. Les lignes sources restent séparées et les dates différentes ne sont jamais fusionnées.</p>
          </div>
          <div className="divide-y divide-slate-200">
            {visualConsolidation.map((group) => (
              <div key={group.key} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_180px_1fr] md:items-start">
                <div><p className="font-bold text-slate-950">{group.articleName} — total {group.total.toLocaleString('fr-FR')} {group.unit}</p><p className="mt-1 text-xs text-slate-500">{group.lines.length} ligne(s) source conservée(s)</p></div>
                <div><p className="field-label">Utilisation / date</p><p className="mt-1 text-sm font-semibold">{group.intendedUse} · {group.requestedDate || 'date non renseignée'}</p></div>
                <div><p className="field-label">Détail</p><p className="mt-1 text-sm text-slate-700">{group.lines.map((line) => `${line.intendedUse}: ${line.quantity} ${line.unit}`).join(' · ')}</p></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[44px_1.35fr_0.85fr_1.25fr_1fr_0.9fr_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span></span><span>Besoin</span><span>Quantite</span><span>Origine / utilisation</span><span>Budget</span><span>Demandeur</span><span>Actions</span>
        </div>
        <div className="divide-y divide-slate-200">
          {needs.map((need) => {
            const selectable = !['regroupe', 'refuse', 'annule'].includes(need.status) && !need.processing
            const isFocused = need.id === focusId
            return (
            <div
              key={need.id}
              ref={(element) => {
                if (element) needRowRefs.current.set(need.id, element)
                else needRowRefs.current.delete(need.id)
              }}
              aria-current={isFocused ? 'true' : undefined}
              className={`grid gap-4 px-5 py-4 xl:grid-cols-[44px_1.35fr_0.85fr_1.25fr_1fr_0.9fr_120px] xl:items-center ${isFocused ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : isNeedExpired(need) ? 'bg-red-50/80' : 'hover:bg-slate-50'}`}
            >
              <input type="checkbox" checked={selectedIds.includes(need.id)} disabled={!selectable} title={selectable ? 'Selectionner' : 'Besoin deja traite'} onChange={() => toggleSelection(need.id)} className="mt-1 h-4 w-4 disabled:cursor-not-allowed disabled:opacity-40 xl:mt-0" />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-950">{(need.articles?.name || 'Article non renseigne')}</p>
                  {isFocused && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-950">Besoin ciblé</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {need.articles?.families?.name ? need.articles.families.name : 'Famille non renseignée'}
                  {need.articles?.min_stock ? ` - seuil minimum ${need.articles.min_stock}` : ''}
                  {need.suppliers?.name || need.articles?.default_supplier ? ` - fournisseur ${need.suppliers?.name || need.articles?.default_supplier}` : ''}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium text-slate-800">{need.justification?.trim() || 'Justification non renseignée'}</p>
                <p className="mt-1 text-xs text-slate-500">{need.business_origin && businessOriginLabels[need.business_origin as BusinessOrigin] ? businessOriginLabels[need.business_origin as BusinessOrigin] : 'Origine historique'} · Utilisation : {getPurchaseNeedIntendedUseLabel(need)}</p>
                {need.comment && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{need.comment}</p>}
                {(need.processing as (typeof need.processing & { id?: string }) | null)?.id ? <Link to={need.processing?.kind === 'cash' ? '/cash-purchases/' + (need.processing as typeof need.processing & { id?: string }).id : '/purchase-orders/' + (need.processing as typeof need.processing & { id?: string }).id} className="mt-2 inline-block text-xs font-semibold text-blue-700 underline">Ouvrir le traitement en cours</Link> : isTreatmentExpected(need) ? <span className="mt-2 block text-xs font-semibold text-amber-700">Traitement lié non retrouvé</span> : null}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-950">{Number(need.quantity ?? need.quantity_needed).toLocaleString('fr-FR')} {need.units?.abbreviation}</p>
                <p className="mt-1 text-xs text-slate-500">Prix unitaire HT estime {Number(need.estimated_price ?? 0).toLocaleString('fr-FR')} Ar</p>
                {need.price_input_is_tax_excluded === false && (
                  <p className="mt-1 text-xs text-slate-500">Saisi TTC {Number(need.price_input_amount ?? need.estimated_price_ttc ?? 0).toLocaleString('fr-FR')} Ar</p>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">{need.business_origin && businessOriginLabels[need.business_origin as BusinessOrigin] ? businessOriginLabels[need.business_origin as BusinessOrigin] : 'Origine historique'}</p>
                <p className="mt-1 text-xs text-slate-500">Utilisation : {getPurchaseNeedIntendedUseLabel(need)}</p>
                <p className="mt-1 text-xs text-slate-500">Difficulté : {need.supply_difficulty ? supplyDifficultyLabels[need.supply_difficulty as SupplyDifficulty] : '—'}</p>
                <p className="mt-1 text-xs text-slate-500">Source : {needCalculationSourceLabels[need.source_du_calcul ?? 'saisie_manuelle']}</p>
                <div className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700">
  <p><span className="font-semibold text-slate-500">Demande :</span> {getNeedRequestLabel(need.status)}</p>
  <p><span className="font-semibold text-slate-500">Traitement :</span> {getNeedTreatmentLabel(need)}</p>
  <p><span className="font-semibold text-slate-500">Urgence :</span> {getNeedUrgencyLabel(need.urgency)}</p>
  <p><span className="font-semibold text-slate-500">Date souhaitée :</span> {need.requested_date ? `${new Date(need.requested_date).toLocaleDateString('fr-FR')}${isNeedExpired(need) ? ' — dépassée' : ''}` : 'non renseignée'}</p>
  <p><span className="font-semibold text-slate-500">Workflow :</span> {need.workflow_status ? workflowStatusLabels[need.workflow_status as WorkflowStatus] : needStatusLabels[need.status]}</p>
</div>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-950">{Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0).toLocaleString('fr-FR')} Ar</p>
                <p className="mt-1 text-xs text-slate-500">Budget {Number(need.budget ?? 0).toLocaleString('fr-FR')} Ar</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">{need.requester?.full_name || '-'}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(need.created_at).toLocaleDateString('fr-FR')}</p>
              </div>

              <div className="flex gap-2 xl:justify-end">
                <Link to={`/purchase-needs?focus=${need.id}`} className="btn-secondary">Ouvrir</Link>
                {canValidate && need.status === 'a_faire' && <button type="button" onClick={() => validateOne(need.id)} className="btn-secondary" title="Ouvrir Mes validations"><CheckCircle className="h-4 w-4" /></button>}
                {canValidate && need.status === 'a_faire' && <button type="button" title="Classer sans suite / doublon" aria-label="Classer sans suite / doublon" onClick={() => cancelOne(need.id)} className="btn-secondary text-red-700"><XCircle className="h-4 w-4" /></button>}
              </div>
            </div>
            )
          })}
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

function urgencyClass(urgency: NeedUrgency) {
  return {
    normal: 'bg-emerald-50 text-emerald-800',
    urgent: 'bg-orange-50 text-orange-800',
    tres_urgent: 'bg-red-50 text-red-800',
  }[urgency]
}

type VisualConsolidation = {
  key: string
  articleName: string
  unit: string
  total: number
  intendedUse: string
  requestedDate: string
  lines: Array<{ intendedUse: string; quantity: number; unit: string }>
}

function buildVisualConsolidation(needs: PurchaseNeedGlobal[]): VisualConsolidation[] {
  const groups = new Map<string, VisualConsolidation>()
  for (const need of needs) {
    const articleName = need.articles?.name ?? 'Article non renseigné'
    const unit = need.units?.abbreviation ?? need.units?.name ?? ''
    const intendedUse = need.intended_uses?.label ?? 'Utilisation non renseignée'
    const requestedDate = need.requested_date ?? ''
    const key = `${need.article_id}:${requestedDate}`
    const current = groups.get(key) ?? { key, articleName, unit, total: 0, intendedUse: 'Voir le détail par utilisation', requestedDate, lines: [] }
    current.total += Number(need.quantity ?? need.quantity_needed ?? 0)
    current.lines.push({ intendedUse, quantity: Number(need.quantity ?? need.quantity_needed ?? 0), unit })
    groups.set(key, current)
  }
  return [...groups.values()].filter((group) => group.lines.length > 1)
}

function buildProposedGroups(needs: PurchaseNeedGlobal[]): ProposedGroup[] {
  const groups = new Map<string, ProposedGroup>()

  for (const need of needs) {
    if (need.status !== 'valide' || need.group_id || !need.supplier_id) continue
    const requestedDate = need.requested_date ?? ''
    const key = `${need.supplier_id}-${requestedDate}`
    const current = groups.get(key) ?? {
      key,
      supplierId: need.supplier_id,
      supplierName: need.suppliers?.name ?? 'Fournisseur non renseigne',
      requestedDate,
      ids: [],
      articleNames: [],
      count: 0,
      total: 0,
      highestUrgency: 'normal' as NeedUrgency,
    }

    current.ids.push(need.id)
    current.articleNames.push((need.articles?.name || 'Article non renseigne') ?? 'Article')
    current.count += 1
    current.total += Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0)
    current.highestUrgency = higherUrgency(current.highestUrgency, need.urgency)
    groups.set(key, current)
  }

  return [...groups.values()]
    .filter((group) => group.count > 1)
    .sort((left, right) => {
      if (left.requestedDate !== right.requestedDate) return left.requestedDate.localeCompare(right.requestedDate)
      return left.supplierName.localeCompare(right.supplierName, 'fr', { sensitivity: 'base' })
    })
}

function higherUrgency(left: NeedUrgency, right: NeedUrgency): NeedUrgency {
  const order: Record<NeedUrgency, number> = { normal: 0, urgent: 1, tres_urgent: 2 }
  return order[right] > order[left] ? right : left
}
