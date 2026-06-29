import { BarChart3, CalendarPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listEvents } from '../../api/modules/events.api'
import { useAuth } from '../../hooks/useAuth'
import { canManageEvents, eventStatusLabels, eventStatuses, eventTypeLabels, eventTypes } from '../../lib/events'
import type { Event, EventStatus, EventType } from '../../lib/events'

export function EventsList() {
  const { profile } = useAuth()
  const canManage = canManageEvents(profile?.role)
  const [events, setEvents] = useState<Event[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState<EventType | 'all'>('all')
  const [status, setStatus] = useState<EventStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, type, status, page, pageSize }), [page, search, status, type])

  useEffect(() => {
    listEvents(filters)
      .then((result) => {
        setEvents(result.events)
        setTotal(result.total)
      })
      .catch(() => toast.error('Une erreur est survenue. Veuillez reessayer.'))
  }, [filters])

  const resetPage = (callback: () => void) => {
    setPage(1)
    callback()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Planification</p>
          <h1 className="page-title mt-2">Evenements</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/events/stats" className="btn-secondary"><BarChart3 className="mr-2 h-4 w-4" /> Stats</Link>
          {canManage && <Link to="/events/new" className="btn-primary"><CalendarPlus className="mr-2 h-4 w-4" /> Nouvel evenement</Link>}
        </div>
      </header>

      <section className="surface grid gap-3 p-4 md:grid-cols-[1fr_190px_170px]">
        <input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} className="input" placeholder="Rechercher par nom" />
        <select value={type} onChange={(event) => resetPage(() => setType(event.target.value as EventType | 'all'))} className="input">
          <option value="all">Tous les types</option>
          {eventTypes.map((item) => <option key={item} value={item}>{eventTypeLabels[item]}</option>)}
        </select>
        <select value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as EventStatus | 'all'))} className="input">
          <option value="all">Tous les statuts</option>
          {eventStatuses.map((item) => <option key={item} value={item}>{eventStatusLabels[item]}</option>)}
        </select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_150px_150px_140px_150px_130px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Nom</span><span>Date</span><span>Type</span><span>Convives</span><span>Cout estime</span><span>Statut</span>
        </div>
        <div className="divide-y divide-slate-200">
          {events.map((event) => (
            <Link key={event.id} to={`/events/${event.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[1fr_150px_150px_140px_150px_130px] xl:items-center">
              <span className="font-semibold text-slate-950">{event.name}</span>
              <span className="text-sm">{new Date(event.date).toLocaleString('fr-FR')}</span>
              <span className="text-sm">{eventTypeLabels[event.type]}</span>
              <span className="text-sm">{event.adults} ad. / {event.children} enf.</span>
              <span className="text-sm">{Number(event.total_estimated_cost).toLocaleString('fr-FR')} Ar</span>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1E3A8A]">{eventStatusLabels[event.status]}</span>
            </Link>
          ))}
          {events.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun evenement trouve.</p>}
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
