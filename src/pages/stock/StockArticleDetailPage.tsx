import { Download, History } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import { getStockArticleDetail, stockStatus } from '../../api/modules/stock.api'
import { exportMovementsToExcel, exportPriceHistoryToCsv } from '../../lib/stockExports'
import { movementStatusLabels, movementTypeLabels, priceSourceLabels } from '../../lib/stock'
import type { StockArticleDetail } from '../../lib/stock'

export function StockArticleDetailPage() {
  const { articleId } = useParams()
  const [detail, setDetail] = useState<StockArticleDetail | null>(null)

  useEffect(() => {
    if (!articleId) return
    getStockArticleDetail(articleId)
      .then(setDetail)
      .catch(() => toast.error('Impossible de charger la fiche stock.'))
  }, [articleId])

  const stats = useMemo(() => {
    const prices = detail?.priceHistory.map((row) => Number(row.unit_cost ?? 0)).filter((price) => price > 0) ?? []
    return {
      last: Number(detail?.stock?.last_price ?? 0),
      avg: Number(detail?.stock?.average_price ?? 0),
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    }
  }, [detail])

  if (!detail) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const stock = detail.stock
  const article = stock?.articles
  const status = stock ? stockStatus(stock) : 'rupture'

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Stock article</p>
          <h1 className="page-title mt-2">{article?.name ?? 'Article'}</h1>
          <p className="mt-2 text-sm text-slate-600">{article?.families?.name ?? '-'} · {article?.units?.abbreviation ?? ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportMovementsToExcel(detail.movements)} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> Mouvements</button>
          <button type="button" onClick={() => exportPriceHistoryToCsv(detail.priceHistory)} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> Prix CSV</button>
          <Link to={`/stock/prices/${articleId}`} className="btn-secondary"><History className="mr-2 h-4 w-4" /> Historique prix</Link>
          <Link to="/stock" className="btn-secondary">Retour</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <Metric label="Quantite totale" value={`${Number(stock?.total_quantity ?? 0).toLocaleString('fr-FR')} ${article?.units?.abbreviation ?? ''}`} />
        <Metric label="Seuil minimum" value={Number(article?.min_stock ?? 0).toLocaleString('fr-FR')} />
        <Metric label="Dernier prix" value={`${stats.last.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Prix moyen pondere" value={`${stats.avg.toLocaleString('fr-FR')} Ar`} />
        <div className="surface p-5">
          <p className="text-sm text-slate-500">Statut</p>
          <div className="mt-2"><StockBadge status={status} /></div>
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-bold text-slate-950">Quantites par localisation</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(stock?.locations ?? []).map((location) => (
            <div key={location.location_id} className="rounded-md border border-slate-200 p-4">
              <p className="font-semibold text-slate-950">{location.location_name}</p>
              <p className="mt-1 text-sm text-slate-600">{Number(location.quantity).toLocaleString('fr-FR')} {article?.units?.abbreviation}</p>
            </div>
          ))}
          {(stock?.locations?.length ?? 0) === 0 && <p className="text-sm text-slate-600">Aucune localisation alimentee.</p>}
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Derniers mouvements</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {detail.movements.map((movement) => (
            <div key={movement.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[150px_120px_120px_1fr_130px_120px] xl:items-center">
              <span className="font-bold text-[#1E3A8A]">{movement.movement_reference}</span>
              <span>{new Date(movement.movement_date).toLocaleDateString('fr-FR')}</span>
              <span>{movementTypeLabels[movement.movement_type]}</span>
              <span className="text-sm">{movement.from_location?.name || '-'} vers {movement.to_location?.name || '-'}</span>
              <span>{Number(movement.quantity).toLocaleString('fr-FR')} {movement.units?.abbreviation}</span>
              <span className="text-xs font-bold text-slate-500">{movementStatusLabels[movement.status]}</span>
            </div>
          ))}
          {detail.movements.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun mouvement.</p>}
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Prix recents</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {detail.priceHistory.slice(0, 10).map((row) => (
            <div key={row.id} className="grid gap-3 px-5 py-4 md:grid-cols-[130px_1fr_120px_120px] md:items-center">
              <span>{new Date(row.movement_date).toLocaleDateString('fr-FR')}</span>
              <span>{row.movement_reference}</span>
              <span>{Number(row.unit_cost).toLocaleString('fr-FR')} Ar</span>
              <span>{priceSourceLabels[row.price_source]}</span>
            </div>
          ))}
          {detail.priceHistory.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun prix en historique.</p>}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function StockBadge({ status }: { status: string }) {
  const color = status === 'rupture' ? 'bg-red-50 text-red-800' : status === 'bas' ? 'bg-yellow-50 text-yellow-800' : 'bg-emerald-50 text-emerald-800'
  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${color}`}>{status === 'rupture' ? 'Rupture' : status === 'bas' ? 'Stock bas' : 'Normal'}</span>
}
