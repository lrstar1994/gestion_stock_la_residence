import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import { getArticle } from '../../api/modules/catalog.api'
import { getPriceHistory } from '../../api/modules/stock.api'
import { exportPriceHistoryToCsv } from '../../lib/stockExports'
import { priceSourceLabels } from '../../lib/stock'
import type { PriceHistoryRow } from '../../lib/stock'
import type { Article } from '../../lib/catalog'

export function PriceHistoryPage() {
  const { articleId } = useParams()
  const [rows, setRows] = useState<PriceHistoryRow[]>([])
  const [article, setArticle] = useState<Article | null>(null)

  useEffect(() => {
    if (!articleId) return
    Promise.all([getPriceHistory(articleId), getArticle(articleId)])
      .then(([history, loadedArticle]) => {
        setRows(history)
        setArticle(loadedArticle)
      })
      .catch(() => toast.error('Impossible de charger l historique des prix.'))
  }, [articleId])

  const stats = useMemo(() => {
    const prices = rows.map((row) => Number(row.unit_cost ?? 0)).filter((price) => price > 0)
    return {
      last: prices[0] ?? 0,
      avg: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    }
  }, [rows])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Historique des prix</h1><p className="mt-2 text-sm text-slate-600">{article?.name}</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => { exportPriceHistoryToCsv(rows); toast.success('Historique des prix exporté avec succès') }} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button><Link to="/stock" className="btn-secondary">Retour</Link></div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Dernier prix" value={`${stats.last.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Prix moyen" value={`${stats.avg.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Prix minimum" value={`${stats.min.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Prix maximum" value={`${stats.max.toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[140px_170px_130px_130px_130px_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Date</span><span>Reference</span><span>Quantite</span><span>Prix</span><span>Source</span><span>Lien</span>
        </div>
        <div className="divide-y divide-slate-200">
          {rows.map((row) => (
            <div key={row.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[140px_170px_130px_130px_130px_1fr] xl:items-center">
              <span>{new Date(row.movement_date).toLocaleDateString('fr-FR')}</span>
              <span className="font-bold text-[#1E3A8A]">{row.movement_reference}</span>
              <span>{Number(row.quantity).toLocaleString('fr-FR')}</span>
              <span>{Number(row.unit_cost).toLocaleString('fr-FR')} Ar</span>
              <span>{priceSourceLabels[row.price_source]}</span>
              <span>{row.reference_type || '-'}</span>
            </div>
          ))}
          {rows.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun historique de prix.</p>}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
