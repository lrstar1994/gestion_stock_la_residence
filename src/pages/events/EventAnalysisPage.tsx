import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import { getEvent } from '../../api/modules/events.api'
import { calculateConsumedPortions } from '../../lib/events'
import type { Event } from '../../lib/events'

export function EventAnalysisPage() {
  const { id } = useParams()
  const [event, setEvent] = useState<Event | null>(null)

  useEffect(() => {
    if (!id) return
    getEvent(id).then(setEvent).catch(() => toast.error('Impossible de charger analyse.'))
  }, [id])

  if (!event) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const planned = event.event_recipes?.reduce((sum, row) => sum + Number(row.portions_planned ?? 0), 0) ?? 0
  const produced = event.event_recipes?.reduce((sum, row) => sum + Number(row.portions_produced ?? 0), 0) ?? 0
  const consumed = event.event_recipes?.reduce((sum, row) => sum + calculateConsumedPortions(row), 0) ?? 0
  const lost = event.event_recipes?.reduce((sum, row) => sum + Number(row.portions_lost ?? 0), 0) ?? 0
  const estimatedCost = Number(event.total_estimated_cost ?? 0)
  const realCost = event.event_recipes?.reduce((sum, row) => sum + Number(row.real_cost ?? 0), 0) ?? 0
  const realization = planned > 0 ? (produced / planned) * 100 : 0
  const lossRate = produced > 0 ? (lost / produced) * 100 : 0
  const delta = realCost - estimatedCost

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Analyse</p><h1 className="page-title mt-2">{event.name}</h1></div>
        <Link to={`/events/${event.id}`} className="btn-secondary">Retour</Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Taux realisation" value={`${realization.toFixed(1)} %`} />
        <Info label="Taux perte" value={`${lossRate.toFixed(1)} %`} />
        <Info label="Cout prevu" value={`${estimatedCost.toLocaleString('fr-FR')} Ar`} />
        <Info label="Cout reel" value={`${realCost.toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className={`surface p-5 ${delta > 0 ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500'}`}>
        <p className="eyebrow">{delta > 0 ? 'Surconsommation' : 'Economies'}</p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{Math.abs(delta).toLocaleString('fr-FR')} Ar</p>
        <p className="mt-2 text-sm text-slate-600">{delta > 0 ? 'Verifier les coefficients retenus pour les prochains evenements.' : 'Les quantites produites sont inferieures au budget prevu.'}</p>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_120px_120px_120px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Recette</span><span>Prev.</span><span>Produit</span><span>Consomme</span><span>Ecart</span>
        </div>
        <div className="divide-y divide-slate-200">
          {event.event_recipes?.map((row) => {
            const rowConsumed = calculateConsumedPortions(row)
            const diff = rowConsumed - Number(row.portions_planned)
            return (
              <div key={row.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_120px_120px_120px_120px]">
                <span className="font-semibold">{row.recipes?.name}</span>
                <span>{Number(row.portions_planned).toLocaleString('fr-FR')}</span>
                <span>{Number(row.portions_produced).toLocaleString('fr-FR')}</span>
                <span>{rowConsumed.toLocaleString('fr-FR')}</span>
                <span className={diff > 0 ? 'text-red-700' : 'text-emerald-700'}>{diff.toLocaleString('fr-FR')}</span>
              </div>
            )
          })}
        </div>
      </section>

      <p className="text-sm text-slate-600">Prevues: {planned.toLocaleString('fr-FR')} / Produites: {produced.toLocaleString('fr-FR')} / Consommees: {consumed.toLocaleString('fr-FR')}</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
