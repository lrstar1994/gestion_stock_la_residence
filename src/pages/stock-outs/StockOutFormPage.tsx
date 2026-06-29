import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles, listLocations } from '../../api/modules/catalog.api'
import { listEvents } from '../../api/modules/events.api'
import { createStockOut, loadStockOutItemsFromEvent } from '../../api/modules/stockOuts.api'
import { getUnconfirmedInitialInventoryCount } from '../../api/modules/inventories.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location } from '../../lib/catalog'
import type { Event } from '../../lib/events'
import { lossTypeLabels, lossTypes, stockOutDestinationLabels, stockOutDestinations } from '../../lib/stockOuts'
import type { StockOutFormValues } from '../../lib/stockOuts'

const today = new Date().toISOString().slice(0, 10)

const emptyForm: StockOutFormValues = {
  event_id: '',
  out_date: today,
  destination: 'production',
  reason: '',
  comment: '',
  items: [],
}

export function StockOutFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<StockOutFormValues>(emptyForm)
  const [articles, setArticles] = useState<Article[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [unconfirmedInitial, setUnconfirmedInitial] = useState(0)
  const defaultLocationId = locations[0]?.id ?? ''
  const totalQuantity = useMemo(() => values.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0), [values.items])

  useEffect(() => {
    Promise.all([
      listArticles({ page: 1, pageSize: 1000, status: 'active' }),
      listLocations(),
      listEvents({ page: 1, pageSize: 100, status: 'en_production' }),
    ])
      .then(([articleResult, loadedLocations, eventResult]) => {
        setArticles(articleResult.articles)
        setLocations(loadedLocations)
        setEvents(eventResult.events)
        if (loadedLocations[0]?.id) getUnconfirmedInitialInventoryCount(loadedLocations[0].id).then(setUnconfirmedInitial).catch(() => undefined)
      })
      .catch(() => toast.error('Impossible de charger le formulaire.'))
  }, [])

  const selectEvent = async (eventId: string) => {
    setValues((current) => ({ ...current, event_id: eventId }))
    if (!eventId) return
    try {
      const items = await loadStockOutItemsFromEvent(eventId, defaultLocationId)
      setValues((current) => ({ ...current, event_id: eventId, destination: 'production', reason: current.reason || 'Sortie production evenement', items }))
      toast.success('Articles de production charges')
    } catch {
      toast.error('Impossible de charger les articles de production.')
    }
  }

  const addItem = () => {
    const article = articles[0]
    setValues((current) => ({
      ...current,
      items: [...current.items, {
        article_id: article?.id ?? '',
        quantity: 1,
        unit_id: article?.unit_id ?? '',
        location_id: defaultLocationId,
        theoretical_quantity: 0,
        recipe_id: '',
        is_additional: false,
        is_return: false,
        return_quantity: 0,
        is_loss: false,
        loss_comment: '',
      }],
    }))
  }

  const updateItem = (index: number, patch: Partial<StockOutFormValues['items'][number]>) => {
    setValues((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  }

  const changeArticle = (index: number, articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    updateItem(index, { article_id: articleId, unit_id: article?.unit_id ?? '' })
  }

  const changeLocation = async (index: number, locationId: string) => {
    updateItem(index, { location_id: locationId })
    setUnconfirmedInitial(await getUnconfirmedInitialInventoryCount(locationId))
  }

  const removeItem = (index: number) => {
    setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile?.id) {
      toast.error('Profil utilisateur introuvable.')
      return
    }
    try {
      const count = await createStockOut(values, profile.id, profile.role)
      toast.success('Sortie de stock enregistree avec succes')
      if (count > 0) navigate('/stock/stock-out')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Sorties de stock</p><h1 className="page-title mt-2">Nouvelle sortie</h1></div>
        <div className="flex gap-2"><Link to="/stock/stock-out" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button></div>
      </header>

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block"><span className="field-label">Depuis un evenement en production</span><select value={values.event_id} onChange={(event) => selectEvent(event.target.value)} className="input mt-2"><option value="">Saisie manuelle</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
        <label className="block"><span className="field-label">Date sortie</span><input type="date" value={values.out_date} onChange={(event) => setValues((current) => ({ ...current, out_date: event.target.value }))} className="input mt-2" /></label>
        <label className="block"><span className="field-label">Destination</span><select value={values.destination} onChange={(event) => setValues((current) => ({ ...current, destination: event.target.value as typeof values.destination }))} className="input mt-2">{stockOutDestinations.map((destination) => <option key={destination} value={destination}>{stockOutDestinationLabels[destination]}</option>)}</select></label>
        <label className="block"><span className="field-label">Motif</span><input value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} className="input mt-2" /></label>
        <label className="block md:col-span-2"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-24" /></label>
      </section>

      {unconfirmedInitial > 0 && (
        <section className="surface border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Stock initial non confirme. Inventaire initial a realiser dans un delai maximum de 2 jours.
        </section>
      )}

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold">Articles a sortir</h2>
          <button type="button" onClick={addItem} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button>
        </div>
        <div className="divide-y divide-slate-200">
          {values.items.map((item, index) => {
            const selectedArticle = articles.find((article) => article.id === item.article_id)
            return (
              <div key={`${item.article_id}-${index}`} className="space-y-4 px-5 py-4">
                <div className="grid gap-3 xl:grid-cols-[1fr_110px_110px_160px_130px_44px] xl:items-end">
                  <label className="block"><span className="field-label">Article</span><select value={item.article_id} onChange={(event) => changeArticle(index, event.target.value)} className="input mt-2"><option value="">Article</option>{articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}</select></label>
                  <label className="block"><span className="field-label">Theorique</span><input type="number" value={item.theoretical_quantity ?? 0} onChange={(event) => updateItem(index, { theoretical_quantity: Number(event.target.value) })} className="input mt-2" /></label>
                  <label className="block"><span className="field-label">Reel</span><input type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} className="input mt-2" /></label>
                  <label className="block"><span className="field-label">Localisation</span><select value={item.location_id} onChange={(event) => changeLocation(index, event.target.value)} className="input mt-2"><option value="">Selectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                  <label className="block"><span className="field-label">Unite</span><select value={item.unit_id} onChange={(event) => updateItem(index, { unit_id: event.target.value })} className="input mt-2"><option value={selectedArticle?.unit_id ?? item.unit_id}>{selectedArticle?.units?.abbreviation ?? 'Unite'}</option></select></label>
                  <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={item.is_additional} onChange={(event) => updateItem(index, { is_additional: event.target.checked })} /> Rajout</label>
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={item.is_return} onChange={(event) => updateItem(index, { is_return: event.target.checked })} /> Retour</label>
                  <input type="number" disabled={!item.is_return} value={item.return_quantity ?? 0} onChange={(event) => updateItem(index, { return_quantity: Number(event.target.value) })} className="input" placeholder="Quantite retour" />
                  <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={item.is_loss} onChange={(event) => updateItem(index, { is_loss: event.target.checked })} /> Perte</label>
                  {item.is_loss && <select value={item.loss_type ?? 'autre'} onChange={(event) => updateItem(index, { loss_type: event.target.value as typeof item.loss_type })} className="input">{lossTypes.map((type) => <option key={type} value={type}>{lossTypeLabels[type]}</option>)}</select>}
                  {item.is_loss && <input value={item.loss_comment ?? ''} onChange={(event) => updateItem(index, { loss_comment: event.target.value })} className="input md:col-span-3" placeholder="Motif de perte" />}
                </div>
              </div>
            )
          })}
          {values.items.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun article.</p>}
        </div>
      </section>

      <section className="surface flex items-center justify-between p-5">
        <span className="text-sm text-slate-600">Quantite totale sortie</span>
        <span className="text-2xl font-black text-[#1E3A8A]">{totalQuantity.toLocaleString('fr-FR')}</span>
      </section>
    </form>
  )
}
