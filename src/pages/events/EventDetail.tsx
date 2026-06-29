import { BarChart3, ClipboardList, PackageSearch, Pencil, PlayCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getEvent, setEventStatus } from '../../api/modules/events.api'
import { useAuth } from '../../hooks/useAuth'
import { canManageEvents, eventStatusLabels, eventTypeLabels, serviceTypeLabels, interestLevelLabels } from '../../lib/events'
import type { Event } from '../../lib/events'

export function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const canManage = canManageEvents(profile?.role)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setEvent(await getEvent(id))
    } catch {
      toast.error('Evenement introuvable')
      navigate('/events')
    }
  }, [id, navigate])

  useEffect(() => {
    load()
  }, [load])

  const startProduction = async () => {
    if (!event) return
    try {
      await setEventStatus(event.id, 'en_production')
      toast.success('Evenement passe en production')
      await load()
    } catch {
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    }
  }

  if (!event) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const margin = Number(event.total_estimated_price) - Number(event.total_estimated_cost)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Evenement</p>
          <h1 className="page-title mt-2">{event.name}</h1>
          <p className="mt-2 text-sm text-slate-600">{new Date(event.date).toLocaleString('fr-FR')} - {eventTypeLabels[event.type]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && <Link to={`/events/${event.id}/edit`} className="btn-primary"><Pencil className="mr-2 h-4 w-4" />Modifier</Link>}
          {canManage && event.status === 'planifie' && <button type="button" onClick={startProduction} className="btn-secondary"><PlayCircle className="mr-2 h-4 w-4" />Production</button>}
          <Link to={`/events/${event.id}/purchase-needs`} className="btn-secondary"><PackageSearch className="mr-2 h-4 w-4" />Besoins d'achat</Link>
          <Link to={`/events/${event.id}/production`} className="btn-secondary"><ClipboardList className="mr-2 h-4 w-4" />Suivi</Link>
          <Link to={`/events/${event.id}/analysis`} className="btn-secondary"><BarChart3 className="mr-2 h-4 w-4" />Analyse</Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <Info label="Statut" value={eventStatusLabels[event.status]} />
        <Info label="Adultes" value={String(event.adults)} />
        <Info label="Enfants" value={`${event.children} x ${Number(event.child_coefficient)}`} />
        <Info label="Equivalent adultes" value={Number(event.total_equivalent).toLocaleString('fr-FR')} />
        <Info label="Cout estime" value={`${Number(event.total_estimated_cost).toLocaleString('fr-FR')} Ar`} />
        <Info label="Cout reel" value={`${Number(event.total_real_cost).toLocaleString('fr-FR')} Ar`} />
        <Info label="Prix estime" value={`${Number(event.total_estimated_price).toLocaleString('fr-FR')} Ar`} />
        <Info label="Marge estimee" value={`${margin.toLocaleString('fr-FR')} Ar`} />
      </section>

      {(event.location || event.description) && (
        <section className="surface p-5">
          {event.location && <p className="font-semibold text-slate-950">{event.location}</p>}
          {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
        </section>
      )}

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_130px_150px_130px_130px_130px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Recette</span><span>Service</span><span>Interet</span><span>Coef.</span><span>Portions</span><span>Cout</span>
        </div>
        <div className="divide-y divide-slate-200">
          {event.event_recipes?.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_130px_150px_130px_130px_130px] xl:items-center">
              <span className="font-semibold text-slate-950">{item.recipes?.name}</span>
              <span className="text-sm">{serviceTypeLabels[item.service_type]}</span>
              <span className="text-sm">{interestLevelLabels[item.interest_level]}</span>
              <span className="text-sm">{Number(item.selected_coefficient).toLocaleString('fr-FR')} %</span>
              <span className="text-sm">{Number(item.portions_planned).toLocaleString('fr-FR')}</span>
              <span className="text-sm">{Number(item.estimated_cost).toLocaleString('fr-FR')} Ar</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
