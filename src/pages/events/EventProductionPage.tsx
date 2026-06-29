import { Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import { getEvent, setEventStatus, updateEventRecipeProduction } from '../../api/modules/events.api'
import { syncEventProductionStock } from '../../api/modules/stock.api'
import { useAuth } from '../../hooks/useAuth'
import { canUpdateProduction, calculateConsumedPortions } from '../../lib/events'
import type { Event, EventRecipe } from '../../lib/events'

export function EventProductionPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const canEdit = canUpdateProduction(profile?.role)

  const load = useCallback(async () => {
    if (!id) return
    setEvent(await getEvent(id))
  }, [id])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger la production.'))
  }, [load])

  const updateRow = (rowId: string, patch: Partial<EventRecipe>) => {
    setEvent((current) => current ? {
      ...current,
      event_recipes: current.event_recipes?.map((row) => row.id === rowId ? { ...row, ...patch } : row),
    } : current)
  }

  const saveRow = async (row: EventRecipe) => {
    try {
      await updateEventRecipeProduction(row.id, {
        portions_produced: Number(row.portions_produced ?? 0),
        portions_additional: Number(row.portions_additional ?? 0),
        portions_returned: Number(row.portions_returned ?? 0),
        portions_lost: Number(row.portions_lost ?? 0),
        portions_unsold: Number(row.portions_unsold ?? 0),
      })
      if (event?.status === 'planifie') await setEventStatus(event.id, 'en_production')
      if (event?.id && profile?.id) {
        const movements = await syncEventProductionStock(event.id, profile.id)
        if (movements > 0) toast.success(`${movements} mouvement(s) stock cree(s)`)
      }
      toast.success('Production mise a jour')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  if (!event) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Production</p><h1 className="page-title mt-2">{event.name}</h1></div>
        <Link to={`/events/${event.id}`} className="btn-secondary">Retour</Link>
      </header>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_110px_repeat(5,90px)_90px_90px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Recette</span><span>Prev.</span><span>Produit</span><span>Rajout</span><span>Retour</span><span>Perte</span><span>Invendu</span><span>Consomme</span><span></span>
        </div>
        <div className="divide-y divide-slate-200">
          {event.event_recipes?.map((row) => {
            const consumed = calculateConsumedPortions(row)
            return (
              <div key={row.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_110px_repeat(5,90px)_90px_90px] xl:items-center">
                <span className="font-semibold">{row.recipes?.name}</span>
                <span className="text-sm">{Number(row.portions_planned).toLocaleString('fr-FR')}</span>
                {(['portions_produced', 'portions_additional', 'portions_returned', 'portions_lost', 'portions_unsold'] as const).map((field) => (
                  <input key={field} disabled={!canEdit} value={Number(row[field] ?? 0)} onChange={(event) => updateRow(row.id, { [field]: Number(event.target.value) })} type="number" min="0" className="input" />
                ))}
                <span className="text-sm font-bold">{consumed.toLocaleString('fr-FR')}</span>
                <button type="button" disabled={!canEdit} onClick={() => saveRow(row)} className="btn-secondary"><Save className="h-4 w-4" /></button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
