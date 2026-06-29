import { Download, ListChecks, RefreshCw, Repeat, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listFamilies, listLocations } from '../../api/modules/catalog.api'
import { integratePendingReceptionMovements, listStock, stockStatus } from '../../api/modules/stock.api'
import { getUnconfirmedInitialInventoryCount } from '../../api/modules/inventories.api'
import { useAuth } from '../../hooks/useAuth'
import type { Family, Location } from '../../lib/catalog'
import { exportStockToExcel } from '../../lib/stockExports'
import { canManageStock } from '../../lib/stock'
import type { StockRow } from '../../lib/stock'

export function StockList() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<StockRow[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [search, setSearch] = useState('')
  const [familyId, setFamilyId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [status, setStatus] = useState<'all' | 'low' | 'normal' | 'out'>('all')
  const [unconfirmedInitial, setUnconfirmedInitial] = useState(0)
  const canManage = canManageStock(profile?.role)
  const filters = useMemo(() => ({ search, familyId, locationId, status }), [familyId, locationId, search, status])

  const load = useCallback(async () => {
    const [stockRows, initialCount] = await Promise.all([listStock(filters), getUnconfirmedInitialInventoryCount(locationId || undefined)])
    setRows(stockRows)
    setUnconfirmedInitial(initialCount)
  }, [filters, locationId])

  useEffect(() => {
    Promise.all([listFamilies(), listLocations()])
      .then(([loadedFamilies, loadedLocations]) => {
        setFamilies(loadedFamilies)
        setLocations(loadedLocations)
      })
      .catch(() => toast.error('Impossible de charger les referentiels.'))
  }, [])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger le stock.'))
  }, [load])

  const integrate = async () => {
    if (!profile?.id) return
    const count = await integratePendingReceptionMovements(profile.id)
    toast.success(`${count} entree(s) de reception integree(s) au stock`)
    await load()
  }

  const dashboard = {
    total: rows.length,
    low: rows.filter((row) => stockStatus(row) === 'bas').length,
    out: rows.filter((row) => stockStatus(row) === 'rupture').length,
    value: rows.reduce((sum, row) => sum + Number(row.total_quantity ?? 0) * Number(row.average_price ?? 0), 0),
  }
  const alerts = rows.filter((row) => ['bas', 'rupture'].includes(stockStatus(row)))

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Stock actuel</h1></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportStockToExcel(rows)} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> Excel</button>
          <Link to="/stock/movements" className="btn-secondary"><ListChecks className="mr-2 h-4 w-4" /> Journal</Link>
          {canManage && <button type="button" onClick={integrate} className="btn-secondary"><RefreshCw className="mr-2 h-4 w-4" /> Integrer receptions</button>}
          {canManage && <Link to="/stock/movements/manual/new" className="btn-secondary">Mouvement manuel</Link>}
          {canManage && <Link to="/stock/transfer" className="btn-primary"><Repeat className="mr-2 h-4 w-4" /> Transfert</Link>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Articles suivis" value={String(dashboard.total)} />
        <Metric label="Stock bas" value={String(dashboard.low)} />
        <Metric label="Ruptures" value={String(dashboard.out)} />
        <Metric label="Valeur estimee" value={`${dashboard.value.toLocaleString('fr-FR')} Ar`} />
      </section>

      {unconfirmedInitial > 0 && (
        <section className="surface border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Stock initial non confirme. Inventaire initial a realiser dans un delai maximum de 2 jours. {unconfirmedInitial} article(s)/localisation(s) concerne(s).
        </section>
      )}

      {alerts.length > 0 && (
        <section className="surface overflow-hidden border border-yellow-200">
          <div className="border-b border-yellow-100 bg-yellow-50 px-5 py-4">
            <h2 className="font-bold text-yellow-900">Alertes stock minimum</h2>
            <p className="mt-1 text-sm text-yellow-800">Articles en stock bas ou en rupture.</p>
          </div>
          <div className="divide-y divide-yellow-100">
            {alerts.slice(0, 8).map((row) => (
              <Link key={row.article_id} to={`/stock/articles/${row.article_id}`} className="grid gap-3 px-5 py-3 transition hover:bg-yellow-50 md:grid-cols-[1fr_140px_140px_120px] md:items-center">
                <span className="font-semibold text-slate-950">{row.articles?.name}</span>
                <span>{Number(row.total_quantity ?? 0).toLocaleString('fr-FR')} {row.articles?.units?.abbreviation}</span>
                <span>Seuil {Number(row.articles?.min_stock ?? 0).toLocaleString('fr-FR')}</span>
                <Badge status={stockStatus(row)} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="surface grid gap-3 p-4 xl:grid-cols-[1fr_180px_210px_180px]">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-9" placeholder="Rechercher article" /></label>
        <select value={familyId} onChange={(event) => setFamilyId(event.target.value)} className="input"><option value="">Toutes familles</option>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select>
        <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="input"><option value="">Toutes localisations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="input"><option value="all">Tous statuts</option><option value="normal">Stock normal</option><option value="low">Stock bas</option><option value="out">Rupture</option></select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_130px_1.2fr_110px_120px_120px_110px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Total</span><span>Localisations</span><span>Seuil</span><span>Dernier prix</span><span>Prix moyen</span><span>Statut</span>
        </div>
        <div className="divide-y divide-slate-200">
          {rows.map((row) => (
            <div key={row.article_id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_130px_1.2fr_110px_120px_120px_110px] xl:items-center">
              <Link to={`/stock/articles/${row.article_id}`} className="font-bold text-[#1E3A8A]">{row.articles?.name}<span className="block text-xs font-normal text-slate-500">{row.articles?.families?.name}</span></Link>
              <span>{Number(row.total_quantity ?? 0).toLocaleString('fr-FR')} {row.articles?.units?.abbreviation}</span>
              <span className="text-sm text-slate-600">{row.locations?.map((location) => `${location.location_name}: ${Number(location.quantity).toLocaleString('fr-FR')}`).join(' | ') || '-'}</span>
              <span>{Number(row.articles?.min_stock ?? 0).toLocaleString('fr-FR')}</span>
              <span>{Number(row.last_price ?? 0).toLocaleString('fr-FR')} Ar</span>
              <span>{Number(row.average_price ?? 0).toLocaleString('fr-FR')} Ar</span>
              <Badge status={stockStatus(row)} />
            </div>
          ))}
          {rows.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun stock disponible.</p>}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function Badge({ status }: { status: string }) {
  const color = status === 'rupture' ? 'bg-red-50 text-red-800' : status === 'bas' ? 'bg-yellow-50 text-yellow-800' : 'bg-emerald-50 text-emerald-800'
  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${color}`}>{status === 'rupture' ? 'Rupture' : status === 'bas' ? 'Stock bas' : 'Normal'}</span>
}
