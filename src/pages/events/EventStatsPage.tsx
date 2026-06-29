import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listEvents } from '../../api/modules/events.api'
import { eventTypeLabels } from '../../lib/events'
import type { Event } from '../../lib/events'

export function EventStatsPage() {
  const [events, setEvents] = useState<Event[]>([])

  useEffect(() => {
    listEvents({ pageSize: 10000 })
      .then((result) => setEvents(result.events))
      .catch(() => toast.error('Impossible de charger les statistiques.'))
  }, [])

  const byType = events.reduce<Record<string, number>>((counts, event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1
    return counts
  }, {})
  const totalCost = events.reduce((sum, event) => sum + Number(event.total_estimated_cost ?? 0), 0)
  const averageCost = events.length > 0 ? totalCost / events.length : 0
  const totalPrice = events.reduce((sum, event) => sum + Number(event.total_estimated_price ?? 0), 0)
  const averageMargin = totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Statistiques</p><h1 className="page-title mt-2">Evenements</h1></div>
        <Link to="/events" className="btn-secondary">Retour</Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Evenements" value={String(events.length)} />
        <Info label="Cout total estime" value={`${totalCost.toLocaleString('fr-FR')} Ar`} />
        <Info label="Cout moyen" value={`${averageCost.toLocaleString('fr-FR')} Ar`} />
        <Info label="Marge moyenne" value={`${averageMargin.toFixed(1)} %`} />
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-bold">Evenements par type</h2>
        <div className="mt-4 space-y-3">
          {Object.entries(byType).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
              <span className="font-semibold">{eventTypeLabels[type as keyof typeof eventTypeLabels]}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-[#1E3A8A]">{count}</span>
            </div>
          ))}
          {events.length === 0 && <p className="text-sm text-slate-600">Aucune donnee statistique.</p>}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
