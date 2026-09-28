import { Filter, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { listFamilies, listArticles, listLocations } from '../../api/modules/catalog.api'
import { listStockCorrections } from '../../api/modules/stockCorrections.api'
import type { StockCorrectionFilters, StockCorrection } from '../../api/modules/stockCorrections.api'
import { getSignedStockCorrectionQuantity, getStockCorrectionOrigin, getStockCorrectionSourcePath } from '../../lib/stockCorrections'
import type { StockCorrectionOrigin } from '../../lib/stockCorrections'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Family, Location } from '../../lib/catalog'
import { canManageStock, movementStatusLabels, movementStatuses } from '../../lib/stock'

const pageSize = 20
const originLabels: Record<StockCorrectionOrigin, string> = {
  inventory: 'Inventaire',
  manual: 'Correction manuelle',
  other: 'Autre',
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR')
}

function formatSignedQuantity(movement: StockCorrection) {
  const quantity = getSignedStockCorrectionQuantity(movement)
  const formatted = Math.abs(quantity).toLocaleString('fr-FR')
  return `${quantity < 0 ? '−' : '+'}${formatted}`
}

function sourceLabel(movement: StockCorrection) {
  if (movement.reference_type === 'inventaire') return movement.source_reference ?? movement.reference_id ?? 'Inventaire'
  if (movement.reference_type === 'sensitive_action') return 'Correction manuelle'
  if (movement.reference_type && movement.reference_id) return `${movement.reference_type} · ${movement.reference_id}`
  return movement.reference_type ?? (movement.is_manual ? 'Correction manuelle' : '—')
}

async function loadAllArticles() {
  const items: Article[] = []
  const batchSize = 500
  for (let page = 1; ; page += 1) {
    const result = await listArticles({ page, pageSize: batchSize, status: 'all' })
    items.push(...result.articles)
    if (items.length >= result.total) break
  }
  return items.sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }))
}

export function StockCorrectionsPage() {
  const { profile } = useAuth()
  const [corrections, setCorrections] = useState<StockCorrection[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [optionsReady, setOptionsReady] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<StockCorrectionFilters>({
    fromDate: '', toDate: '', articleId: '', familyId: '', locationId: '', origin: 'all', status: 'all',
  })
  const [appliedFilters, setAppliedFilters] = useState<StockCorrectionFilters>(filters)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const isManager = canManageStock(profile?.role)

  useEffect(() => {
    let active = true
    Promise.all([loadAllArticles(), listFamilies('', true), listLocations('', true)])
      .then(([loadedArticles, loadedFamilies, loadedLocations]) => {
        if (!active) return
        setArticles(loadedArticles)
        setFamilies(loadedFamilies)
        setLocations(loadedLocations)
        setOptionsError(null)
      })
      .catch((error) => {
        if (!active) return
        console.error('Erreur de chargement des filtres de corrections', error)
        setOptionsError('Les filtres n’ont pas pu être chargés.')
        toast.error('Les filtres des corrections n’ont pas pu être chargés.', { id: 'stock-corrections-options-error' })
      })
      .finally(() => { if (active) { setOptionsReady(true) } })
    return () => { active = false }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await listStockCorrections({ ...appliedFilters, page, pageSize })
      setCorrections(result.corrections)
      setTotal(result.total)
    } catch (error) {
      console.error('Erreur de chargement des corrections de stock', error)
      setLoadError('Impossible de charger les corrections de stock.')
      toast.error('Impossible de charger les corrections de stock.', { id: 'stock-corrections-load-error' })
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, page])

  useEffect(() => { void load() }, [load])

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
    setAppliedFilters({ ...filters })
  }

  const resetFilters = () => {
    const cleared: StockCorrectionFilters = { fromDate: '', toDate: '', articleId: '', familyId: '', locationId: '', origin: 'all', status: 'all' }
    setFilters(cleared)
    setPage(1)
    setAppliedFilters(cleared)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock & inventaires</p><h1 className="page-title mt-2">Corrections de stock</h1><p className="mt-2 text-sm text-slate-600">Mouvements de correction issus des inventaires et opérations manuelles.</p></div>
        <div className="flex gap-2">
          {isManager && <Link to="/stock/movements/manual/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvelle correction manuelle</Link>}
          <Link to="/stock/movements" className="btn-secondary">Journal complet</Link>
        </div>
      </header>

      <form onSubmit={applyFilters} className="surface grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm"><span className="field-label">Du</span><input type="date" value={filters.fromDate ?? ''} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} className="input mt-1" /></label>
        <label className="text-sm"><span className="field-label">Au</span><input type="date" value={filters.toDate ?? ''} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} className="input mt-1" /></label>
        <label className="text-sm"><span className="field-label">Article</span><select value={filters.articleId ?? ''} onChange={(event) => setFilters((current) => ({ ...current, articleId: event.target.value }))} className="input mt-1"><option value="">Tous les articles</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}</select></label>
        <label className="text-sm"><span className="field-label">Famille</span><select value={filters.familyId ?? ''} onChange={(event) => setFilters((current) => ({ ...current, familyId: event.target.value }))} className="input mt-1"><option value="">Toutes les familles</option>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select></label>
        <label className="text-sm"><span className="field-label">Localisation / magasin</span><select value={filters.locationId ?? ''} onChange={(event) => setFilters((current) => ({ ...current, locationId: event.target.value }))} className="input mt-1"><option value="">Toutes mes localisations accessibles</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label className="text-sm"><span className="field-label">Origine</span><select value={filters.origin ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, origin: event.target.value as StockCorrectionOrigin | 'all' }))} className="input mt-1"><option value="all">Toutes les origines</option>{Object.entries(originLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm"><span className="field-label">Statut</span><select value={filters.status ?? 'all'} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as StockCorrectionFilters['status'] }))} className="input mt-1"><option value="all">Tous les statuts</option>{movementStatuses.map((status) => <option key={status} value={status}>{movementStatusLabels[status]}</option>)}</select></label>
        <div className="flex items-end gap-2"><button type="submit" className="btn-primary"><Filter className="mr-2 h-4 w-4" /> Filtrer</button><button type="button" onClick={resetFilters} className="btn-secondary">Réinitialiser</button></div>
      </form>

      {optionsError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{optionsError} La liste des corrections reste consultable.</p>}
      {loadError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</p>}

      <section className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1400px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-3">Référence</th><th className="px-4 py-3">Date / heure</th><th className="px-4 py-3">Article / famille</th><th className="px-4 py-3">Variation</th><th className="px-4 py-3">Localisation</th><th className="px-4 py-3">Origine / dossier source</th><th className="px-4 py-3">Motif</th><th className="px-4 py-3">Saisi par</th><th className="px-4 py-3">Validateur</th><th className="px-4 py-3">Statut</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {corrections.map((movement) => {
                const origin = getStockCorrectionOrigin(movement)
                const source = sourceLabel(movement)
                const sourceHref = getStockCorrectionSourcePath(movement)
                const location = movement.from_location?.name ?? movement.to_location?.name ?? '—'
                const validator = movement.manual_validator?.full_name ?? movement.retroactive_validator?.full_name ?? '—'
                return <tr key={movement.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold"><Link className="text-blue-800 underline-offset-2 hover:underline" to={`/stock/movements/${movement.id}`}>{movement.movement_reference || movement.id}</Link></td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(movement.created_at)}</td>
                  <td className="px-4 py-3"><span className="block font-medium">{movement.articles?.name ?? 'Article indisponible'}</span><span className="text-xs text-slate-500">{movement.articles?.families?.name ?? 'Sans famille'}</span></td>
                  <td className={`px-4 py-3 font-semibold ${getSignedStockCorrectionQuantity(movement) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatSignedQuantity(movement)} {movement.units?.abbreviation ?? ''}</td>
                  <td className="px-4 py-3">{location}</td>
                  <td className="px-4 py-3">{originLabels[origin]}{source !== '—' && <span className="mt-1 block text-xs text-slate-500">{sourceHref ? <Link to={sourceHref} className="underline">{source}</Link> : source}</span>}</td>
                  <td className="px-4 py-3 max-w-xs">{movement.manual_reason || movement.comment || '—'}</td>
                  <td className="px-4 py-3">{movement.creator?.full_name ?? '—'}</td><td className="px-4 py-3">{validator}</td>
                  <td className="px-4 py-3">{movementStatusLabels[movement.status]}</td>
                </tr>
              })}
              {!loading && corrections.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Aucune correction ne correspond aux filtres.</td></tr>}
              {loading && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Chargement des corrections…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-600">{total.toLocaleString('fr-FR')} correction(s) · page {page} sur {totalPages}{!optionsReady ? ' · chargement des filtres…' : ''}</span>
          <div className="flex gap-2"><button type="button" className="btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Précédent</button><button type="button" className="btn-secondary" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Suivant</button></div>
        </div>
      </section>
    </div>
  )
}
