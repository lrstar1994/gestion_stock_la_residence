import { Download, FileSpreadsheet, Plus, Search, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listLocations } from '../../api/modules/catalog.api'
import { listStockOuts, validateStockOut } from '../../api/modules/stockOuts.api'
import { useAuth } from '../../hooks/useAuth'
import type { Location } from '../../lib/catalog'
import {
  canCreateStockOuts,
  canExportStockOuts,
  canValidateStockOuts,
  consumptionTypeLabels,
  stockOutDestinationLabels,
  stockOutDestinations,
} from '../../lib/stockOuts'
import type { StockOut, StockOutDestination } from '../../lib/stockOuts'
import { exportStockOutsToCsv, exportStockOutsToExcel } from '../../lib/stockOutExports'

const statusClasses: Record<string, string> = {
  valide: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  en_attente: 'bg-amber-50 text-amber-700 ring-amber-200',
  annule: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const typeClasses: Record<string, string> = {
  normale: 'bg-blue-50 text-blue-700 ring-blue-200',
  surconsommation: 'bg-red-50 text-red-700 ring-red-200',
  economie: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  perte: 'bg-orange-50 text-orange-700 ring-orange-200',
}

export function StockOutsList() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<StockOut[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    destination: 'all' as StockOutDestination | 'all',
    locationId: '',
    fromDate: '',
    toDate: '',
  })

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((row) => row.status === 'en_attente').length,
    losses: rows.filter((row) => row.is_loss || row.destination === 'perte' || row.destination === 'casse').length,
    over: rows.filter((row) => row.consumption_type === 'surconsommation').length,
  }), [rows])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stockOutResult, loadedLocations] = await Promise.all([
        listStockOuts({ ...filters, page: 1, pageSize: 100 }),
        listLocations(),
      ])
      setRows(stockOutResult.stockOuts)
      setLocations(loadedLocations)
    } catch {
      toast.error('Impossible de charger les sorties de stock.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault()
    load()
  }

  const validate = async (row: StockOut) => {
    if (!profile?.id) return
    try {
      await validateStockOut(row.id, profile.id)
      toast.success('Sortie de stock enregistree avec succes')
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Stock et production</p>
          <h1 className="page-title mt-2">Journal des sorties</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/stock/consumption-analysis" className="btn-secondary">Analyse consommation</Link>
          {canExportStockOuts(profile?.role) && (
            <>
              <button type="button" onClick={() => exportStockOutsToCsv(rows)} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>
              <button type="button" onClick={() => exportStockOutsToExcel(rows)} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>
            </>
          )}
          {canCreateStockOuts(profile?.role) && (
            <Link to="/stock/stock-out/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvelle sortie</Link>
          )}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="surface p-5"><p className="text-sm text-slate-500">Sorties affichees</p><p className="mt-2 text-2xl font-black text-[#1E3A8A]">{stats.total}</p></div>
        <div className="surface p-5"><p className="text-sm text-slate-500">En attente</p><p className="mt-2 text-2xl font-black text-amber-600">{stats.pending}</p></div>
        <div className="surface p-5"><p className="text-sm text-slate-500">Pertes / casses</p><p className="mt-2 text-2xl font-black text-orange-600">{stats.losses}</p></div>
        <div className="surface p-5"><p className="text-sm text-slate-500">Surconsommations</p><p className="mt-2 text-2xl font-black text-red-600">{stats.over}</p></div>
      </section>

      <form onSubmit={applyFilters} className="surface grid gap-3 p-4 md:grid-cols-6">
        <label className="md:col-span-2">
          <span className="field-label">Recherche motif</span>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} className="input pl-9" placeholder="Motif ou observation" />
          </div>
        </label>
        <label>
          <span className="field-label">Destination</span>
          <select value={filters.destination} onChange={(event) => setFilters((current) => ({ ...current, destination: event.target.value as StockOutDestination | 'all' }))} className="input mt-2">
            <option value="all">Toutes</option>
            {stockOutDestinations.map((destination) => <option key={destination} value={destination}>{stockOutDestinationLabels[destination]}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">Localisation</span>
          <select value={filters.locationId} onChange={(event) => setFilters((current) => ({ ...current, locationId: event.target.value }))} className="input mt-2">
            <option value="">Toutes</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">Du</span>
          <input type="date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} className="input mt-2" />
        </label>
        <label>
          <span className="field-label">Au</span>
          <input type="date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} className="input mt-2" />
        </label>
        <div className="md:col-span-6">
          <button type="submit" className="btn-secondary">Filtrer</button>
        </div>
      </form>

      <section className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Article</th>
                <th className="px-4 py-3">Quantite</th>
                <th className="px-4 py-3">Localisation</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Ecart</th>
                <th className="px-4 py-3">Mouvement / cout</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-sm">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-700">{new Date(row.out_date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{row.articles?.name}</p>
                    <p className="text-xs text-slate-500">{row.reference} · {row.reason}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{Number(row.quantity).toLocaleString('fr-FR')} {row.units?.abbreviation}</td>
                  <td className="px-4 py-3">{row.locations?.name}</td>
                  <td className="px-4 py-3">{stockOutDestinationLabels[row.destination]}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${typeClasses[row.consumption_type ?? 'normale']}`}>
                      {consumptionTypeLabels[row.consumption_type ?? 'normale']}
                    </span>
                    {row.theoretical_quantity !== null && <p className="mt-1 text-xs text-slate-500">Theo. {Number(row.theoretical_quantity).toLocaleString('fr-FR')} · Ecart {Number(row.difference ?? 0).toLocaleString('fr-FR')}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#1E3A8A]">{row.stock_movement?.movement_reference ?? '-'}</p>
                    <p className="text-xs text-slate-500">{Number(row.stock_movement?.total_cost ?? 0).toLocaleString('fr-FR')} Ar</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusClasses[row.status] ?? statusClasses.valide}`}>
                      {row.status === 'en_attente' ? 'En attente' : row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/stock/stock-out/${row.id}`} className="btn-secondary">Detail</Link>
                      {row.status === 'en_attente' && canValidateStockOuts(profile?.role) && (
                        <button type="button" onClick={() => validate(row)} className="btn-secondary"><ShieldCheck className="mr-2 h-4 w-4" /> Valider</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">Aucune sortie trouvee.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">Chargement...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
