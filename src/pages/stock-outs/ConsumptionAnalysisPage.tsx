import { FileSpreadsheet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { getConsumptionAnalysis } from '../../api/modules/stockOuts.api'
import {
  consumptionTypeLabels,
  stockOutDestinationLabels,
  stockOutDestinations,
} from '../../lib/stockOuts'
import type { ConsumptionAnalysisRow, StockOutDestination } from '../../lib/stockOuts'
import { exportConsumptionAnalysisToExcel } from '../../lib/stockOutExports'

const typeClasses: Record<string, string> = {
  normale: 'bg-blue-50 text-blue-700 ring-blue-200',
  surconsommation: 'bg-red-50 text-red-700 ring-red-200',
  economie: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  perte: 'bg-orange-50 text-orange-700 ring-orange-200',
}

export function ConsumptionAnalysisPage() {
  const [rows, setRows] = useState<ConsumptionAnalysisRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    destination: 'all' as StockOutDestination | 'all',
    fromDate: '',
    toDate: '',
  })

  const totals = useMemo(() => rows.reduce((acc, row) => ({
    quantity: acc.quantity + row.quantity,
    theoretical: acc.theoretical + row.theoretical_quantity,
    difference: acc.difference + row.difference,
    cost: acc.cost + row.cost,
    over: acc.over + (row.consumption_type === 'surconsommation' ? 1 : 0),
  }), { quantity: 0, theoretical: 0, difference: 0, cost: 0, over: 0 }), [rows])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getConsumptionAnalysis(filters)
      setRows(data)
      toast.success('Analyse de consommation generee avec succes')
    } catch {
      toast.error("Impossible de charger l'analyse de consommation.")
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Stock et production</p>
          <h1 className="page-title mt-2">Analyse de consommation</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/stock/stock-out" className="btn-secondary">Journal des sorties</Link>
          <button type="button" onClick={() => exportConsumptionAnalysisToExcel(rows)} className="btn-primary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel</button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="surface p-5"><p className="text-sm text-slate-500">Quantite reelle</p><p className="mt-2 text-2xl font-black text-[#1E3A8A]">{totals.quantity.toLocaleString('fr-FR')}</p></div>
        <div className="surface p-5"><p className="text-sm text-slate-500">Quantite theorique</p><p className="mt-2 text-2xl font-black text-slate-800">{totals.theoretical.toLocaleString('fr-FR')}</p></div>
        <div className="surface p-5"><p className="text-sm text-slate-500">Ecart global</p><p className={`mt-2 text-2xl font-black ${totals.difference > 0 ? 'text-red-600' : totals.difference < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>{totals.difference.toLocaleString('fr-FR')}</p></div>
        <div className="surface p-5"><p className="text-sm text-slate-500">Cout total</p><p className="mt-2 text-2xl font-black text-[#1E3A8A]">{totals.cost.toLocaleString('fr-FR')} Ar</p></div>
      </section>

      <form onSubmit={applyFilters} className="surface grid gap-3 p-4 md:grid-cols-4">
        <label>
          <span className="field-label">Destination</span>
          <select value={filters.destination} onChange={(event) => setFilters((current) => ({ ...current, destination: event.target.value as StockOutDestination | 'all' }))} className="input mt-2">
            <option value="all">Toutes</option>
            {stockOutDestinations.map((destination) => <option key={destination} value={destination}>{stockOutDestinationLabels[destination]}</option>)}
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
        <div className="flex items-end">
          <button type="submit" className="btn-secondary">Actualiser</button>
        </div>
      </form>

      <section className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Article</th>
                <th className="px-4 py-3">Famille</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Theorique</th>
                <th className="px-4 py-3">Reel</th>
                <th className="px-4 py-3">Ecart</th>
                <th className="px-4 py-3">Cout</th>
                <th className="px-4 py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-sm">
              {rows.map((row) => (
                <tr key={`${row.article_id}-${row.destination}-${row.consumption_type}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-900">{row.article_name}</td>
                  <td className="px-4 py-3">{row.family_name || '-'}</td>
                  <td className="px-4 py-3">{stockOutDestinationLabels[row.destination]}</td>
                  <td className="px-4 py-3">{row.theoretical_quantity.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3">{row.quantity.toLocaleString('fr-FR')}</td>
                  <td className={`px-4 py-3 font-bold ${row.difference > 0 ? 'text-red-600' : row.difference < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>{row.difference.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{row.cost.toLocaleString('fr-FR')} Ar</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${typeClasses[row.consumption_type]}`}>
                      {consumptionTypeLabels[row.consumption_type]}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">Aucune consommation trouvee.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">Chargement...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
