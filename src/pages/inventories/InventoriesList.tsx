import { Download, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listLocations } from '../../api/modules/catalog.api'
import { getInventoryDashboard, listInventories } from '../../api/modules/inventories.api'
import { useAuth } from '../../hooks/useAuth'
import { exportInventoriesToExcel } from '../../lib/inventoryExports'
import { canCreateInventories, canExportInventories, inventoryStatusLabels, inventoryStatuses, inventoryTypeLabels, inventoryTypes } from '../../lib/inventories'
import type { Inventory, InventoryDashboard, InventoryStatus, InventoryType } from '../../lib/inventories'
import type { Location } from '../../lib/catalog'

export function InventoriesList() {
  const { profile } = useAuth()
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [dashboard, setDashboard] = useState<InventoryDashboard | null>(null)
  const [search, setSearch] = useState('')
  const [locationId, setLocationId] = useState('')
  const [type, setType] = useState<InventoryType | 'all'>('all')
  const [status, setStatus] = useState<InventoryStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, locationId, type, status, page, pageSize }), [locationId, page, search, status, type])

  const load = useCallback(async () => {
    const [result, loadedLocations, loadedDashboard] = await Promise.all([
      listInventories(filters),
      listLocations(),
      getInventoryDashboard(),
    ])
    setInventories(result.inventories)
    setTotal(result.total)
    setLocations(loadedLocations)
    setDashboard(loadedDashboard)
  }, [filters])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger les inventaires.'))
  }, [load])

  const exportAll = async () => {
    const result = await listInventories({ ...filters, page: 1, pageSize: 10000 })
    exportInventoriesToExcel(result.inventories)
    toast.success('Correction creee avec succes')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Inventaires et ecarts</h1></div>
        <div className="flex flex-wrap gap-2">
          <Link to="/inventories/initial" className="btn-secondary">Inventaire initial</Link>
          {canExportInventories(profile?.role) && <button type="button" onClick={exportAll} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> Excel</button>}
          {canCreateInventories(profile?.role) && <Link to="/inventories/new" className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouvel inventaire</Link>}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Inventaires" value={String(dashboard?.total ?? 0)} />
        <Metric label="En attente" value={String(dashboard?.pending ?? 0)} />
        <Metric label="Initiaux non confirmes" value={String(dashboard?.initialMissing ?? 0)} />
        <Metric label="Ecart valeur" value={`${Number(dashboard?.totalValueDifference ?? 0).toLocaleString('fr-FR')} Ar`} />
      </section>

      {(dashboard?.biggestDifferences.length ?? 0) > 0 && (
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="font-bold">Plus grands ecarts</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {dashboard?.biggestDifferences.slice(0, 5).map((item) => (
              <div key={item.id} className="grid gap-3 px-5 py-3 md:grid-cols-[1fr_120px_140px] md:items-center">
                <span className="font-semibold">{item.articles?.name}</span>
                <span>{Number(item.difference ?? 0).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
                <span>{Number(item.value_difference ?? 0).toLocaleString('fr-FR')} Ar</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="surface grid gap-3 p-4 md:grid-cols-4">
        <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} className="input" placeholder="Recherche commentaire" />
        <select value={locationId} onChange={(event) => { setPage(1); setLocationId(event.target.value) }} className="input"><option value="">Toutes zones</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
        <select value={type} onChange={(event) => { setPage(1); setType(event.target.value as InventoryType | 'all') }} className="input"><option value="all">Tous types</option>{inventoryTypes.map((item) => <option key={item} value={item}>{inventoryTypeLabels[item]}</option>)}</select>
        <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value as InventoryStatus | 'all') }} className="input"><option value="all">Tous statuts</option>{inventoryStatuses.map((item) => <option key={item} value={item}>{inventoryStatusLabels[item]}</option>)}</select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[150px_120px_1fr_120px_100px_130px_130px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Reference</span><span>Date</span><span>Zone</span><span>Type</span><span>Articles</span><span>Ecart</span><span>Valeur</span><span>Statut</span>
        </div>
        <div className="divide-y divide-slate-200">
          {inventories.map((inventory) => (
            <Link key={inventory.id} to={`/inventories/${inventory.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[150px_120px_1fr_120px_100px_130px_130px_120px] xl:items-center">
              <span className="font-bold text-[#1E3A8A]">{inventory.reference}</span>
              <span>{new Date(inventory.inventory_date).toLocaleDateString('fr-FR')}</span>
              <span>{inventory.locations?.name}</span>
              <span>{inventoryTypeLabels[inventory.type]}</span>
              <span>{inventory.inventory_items?.length ?? 0}</span>
              <span>{Number(inventory.total_difference ?? 0).toLocaleString('fr-FR')}</span>
              <span>{Number(inventory.total_value_difference ?? 0).toLocaleString('fr-FR')} Ar</span>
              <Badge status={inventory.status} />
            </Link>
          ))}
          {inventories.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun inventaire.</p>}
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

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function Badge({ status }: { status: InventoryStatus }) {
  const color = status === 'en_attente' ? 'bg-amber-50 text-amber-800' : status === 'corrige' || status === 'valide' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-800'
  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${color}`}>{inventoryStatusLabels[status]}</span>
}
