import { Download, FileSpreadsheet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listMovements, validateMovement } from '../../api/modules/stock.api'
import { useAuth } from '../../hooks/useAuth'
import { exportMovementsToCsv, exportMovementsToExcel } from '../../lib/stockExports'
import { canValidateStock, movementStatusLabels, movementTypeLabels, movementTypes } from '../../lib/stock'
import type { MovementType, StockMovement } from '../../lib/stock'

const today = new Date().toISOString().slice(0, 10)

export function StockMovementsPage() {
  const { profile } = useAuth()
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [date, setDate] = useState(today)
  const [movementType, setMovementType] = useState<MovementType | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ date, movementType, page, pageSize }), [date, movementType, page])
  const canValidate = canValidateStock(profile?.role)

  const load = useCallback(async () => {
    const result = await listMovements(filters)
    setMovements(result.movements)
    setTotal(result.total)
  }, [filters])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger le journal.'))
  }, [load])

  const validate = async (id: string) => {
    await validateMovement(id, profile?.id)
    toast.success('Mouvement enregistré avec succès')
    await load()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Journal des mouvements</h1></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { exportMovementsToCsv(movements); toast.success('Journal exporté avec succès') }} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>
          <button type="button" onClick={() => { exportMovementsToExcel(movements); toast.success('Journal exporté avec succès') }} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>
          <Link to="/stock" className="btn-secondary">Stock</Link>
        </div>
      </header>

      <section className="surface grid gap-3 p-4 md:grid-cols-[180px_220px_1fr]">
        <input type="date" value={date} onChange={(event) => { setPage(1); setDate(event.target.value) }} className="input" />
        <select value={movementType} onChange={(event) => { setPage(1); setMovementType(event.target.value as MovementType | 'all') }} className="input"><option value="all">Tous types</option>{movementTypes.map((type) => <option key={type} value={type}>{movementTypeLabels[type]}</option>)}</select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[150px_100px_1fr_110px_110px_1fr_130px_130px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Reference</span><span>Type</span><span>Article</span><span>Quantite</span><span>Unite</span><span>Origine / destination</span><span>Cout</span><span>Statut</span>
        </div>
        <div className="divide-y divide-slate-200">
          {movements.map((movement) => (
            <div key={movement.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[150px_100px_1fr_110px_110px_1fr_130px_130px] xl:items-center">
              <span className="font-bold text-[#1E3A8A]">{movement.movement_reference}</span>
              <span>{movementTypeLabels[movement.movement_type]}</span>
              <span><span className="block font-semibold">{movement.articles?.name}</span><span className="text-xs text-slate-500">{movement.articles?.families?.name}</span></span>
              <span>{Number(movement.quantity).toLocaleString('fr-FR')}</span>
              <span>{movement.units?.abbreviation}</span>
              <span className="text-sm">{movement.from_location?.name || '-'} → {movement.to_location?.name || '-'}</span>
              <span>{Number(movement.total_cost ?? 0).toLocaleString('fr-FR')} Ar</span>
              <span className="space-y-2"><Badge status={movement.status} />{canValidate && movement.status === 'en_attente' && <button type="button" onClick={() => validate(movement.id)} className="btn-secondary">Valider</button>}</span>
            </div>
          ))}
          {movements.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun mouvement.</p>}
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

function Badge({ status }: { status: StockMovement['status'] }) {
  return <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1E3A8A]">{movementStatusLabels[status]}</span>
}
