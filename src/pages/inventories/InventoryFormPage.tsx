import { Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listLocations } from '../../api/modules/catalog.api'
import { createInventory, prepareInventoryItems } from '../../api/modules/inventories.api'
import { useAuth } from '../../hooks/useAuth'
import type { Location } from '../../lib/catalog'
import { inventoryTypeLabels, inventoryTypes, summarizeInventory } from '../../lib/inventories'
import type { InventoryFormValues, InventoryItem, InventoryType } from '../../lib/inventories'

const today = new Date().toISOString().slice(0, 10)

export function InventoryFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [locations, setLocations] = useState<Location[]>([])
  const [familyFilter, setFamilyFilter] = useState('all')
  const [articleSearch, setArticleSearch] = useState('')
  const [values, setValues] = useState<Omit<InventoryFormValues, 'items'> & { items: InventoryItem[] }>({ location_id: '', inventory_date: today, type: 'periodique', comment: '', items: [] })
  const summary = useMemo(() => summarizeInventory(values.items), [values.items])
  const families = useMemo(() => {
    const unique = new Map<string, string>()
    for (const item of values.items) {
      if (item.articles?.families?.id) unique.set(item.articles.families.id, item.articles.families.name)
    }
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [values.items])
  const visibleItems = useMemo(() => values.items.filter((item) => {
    const familyMatch = familyFilter === 'all' || item.articles?.families?.id === familyFilter
    const searchMatch = !articleSearch.trim() || item.articles?.name?.toLowerCase().includes(articleSearch.trim().toLowerCase())
    return familyMatch && searchMatch
  }), [articleSearch, familyFilter, values.items])

  useEffect(() => {
    listLocations().then(setLocations).catch(() => toast.error('Impossible de charger les localisations.'))
  }, [])

  const selectLocation = async (locationId: string) => {
    setValues((current) => ({ ...current, location_id: locationId, items: [] }))
    if (!locationId) return
    try {
      const items = await prepareInventoryItems(locationId)
      setValues((current) => ({ ...current, location_id: locationId, items }))
    } catch {
      toast.error('Impossible de preparer les articles.')
    }
  }

  const updateItem = (articleId: string, counted: number) => {
    setValues((current) => ({ ...current, items: current.items.map((item) => item.article_id === articleId ? { ...item, counted_quantity: counted } : item) }))
  }

  const updateReason = (articleId: string, reason: string) => {
    setValues((current) => ({ ...current, items: current.items.map((item) => item.article_id === articleId ? { ...item, reason } : item) }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile?.id) return
    try {
      const payload: InventoryFormValues = {
        ...values,
        items: values.items.map((item) => ({
          article_id: item.article_id,
          theoretical_quantity: item.theoretical_quantity,
          counted_quantity: item.counted_quantity,
          unit_id: item.unit_id,
          unit_price: item.unit_price,
          reason: item.reason ?? '',
        })),
      }
      const result = await createInventory(payload, profile.id, profile.role)
      toast.success(result.pendingValidation ? 'Le seuil d ecart est depasse, validation Direction requise' : 'Inventaire cree avec succes')
      navigate(`/inventories/${result.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Inventaire</p><h1 className="page-title mt-2">Nouvel inventaire</h1></div>
        <div className="flex gap-2"><Link to="/inventories" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button></div>
      </header>

      <section className="surface grid gap-4 p-5 md:grid-cols-3">
        <label><span className="field-label">Zone / localisation</span><select value={values.location_id} onChange={(event) => selectLocation(event.target.value)} className="input mt-2"><option value="">Selectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label><span className="field-label">Date</span><input type="date" value={values.inventory_date} onChange={(event) => setValues((current) => ({ ...current, inventory_date: event.target.value }))} className="input mt-2" /></label>
        <label><span className="field-label">Type</span><select value={values.type} onChange={(event) => setValues((current) => ({ ...current, type: event.target.value as InventoryType }))} className="input mt-2">{inventoryTypes.map((item) => <option key={item} value={item}>{inventoryTypeLabels[item]}</option>)}</select></label>
        <label className="md:col-span-3"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-20" /></label>
      </section>

      <section className="surface overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-[220px_1fr_auto] md:items-end">
          <label>
            <span className="field-label">Famille</span>
            <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)} className="input mt-2">
              <option value="all">Toutes les familles</option>
              {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Recherche article</span>
            <input value={articleSearch} onChange={(event) => setArticleSearch(event.target.value)} className="input mt-2" placeholder="Nom de l'article" />
          </label>
          <p className="text-sm font-semibold text-slate-600">{visibleItems.length} / {values.items.length} articles</p>
        </div>
        <div className="hidden grid-cols-[1fr_130px_130px_120px_120px_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Theorique</span><span>Compte</span><span>Unite</span><span>Ecart</span><span>Motif</span>
        </div>
        <div className="divide-y divide-slate-200">
          {visibleItems.map((item) => {
            const difference = Number(item.counted_quantity) - Number(item.theoretical_quantity)
            return (
              <div key={item.article_id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_130px_130px_120px_120px_1fr] xl:items-center">
                <div><span className="font-semibold">{item.articles?.name}</span><p className="text-xs text-slate-500">{item.articles?.families?.name ?? 'Sans famille'}</p></div>
                <span>{Number(item.theoretical_quantity).toLocaleString('fr-FR')}</span>
                <input type="number" value={item.counted_quantity} onChange={(event) => updateItem(item.article_id, Number(event.target.value))} className="input" />
                <span>{item.units?.abbreviation}</span>
                <span className={difference > 0 ? 'font-bold text-emerald-600' : difference < 0 ? 'font-bold text-red-600' : 'font-bold text-slate-700'}>{difference.toLocaleString('fr-FR')}</span>
                <input value={item.reason ?? ''} onChange={(event) => updateReason(item.article_id, event.target.value)} className="input" placeholder="Motif si ecart important" />
              </div>
            )
          })}
          {values.items.length === 0 && <p className="p-5 text-sm text-slate-600">Selectionnez une localisation pour charger les articles.</p>}
          {values.items.length > 0 && visibleItems.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun article ne correspond aux filtres.</p>}
        </div>
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-4">
        <Metric label="Ecart positif" value={summary.positive.toLocaleString('fr-FR')} />
        <Metric label="Ecart negatif" value={summary.negative.toLocaleString('fr-FR')} />
        <Metric label="Ecart total" value={summary.total.toLocaleString('fr-FR')} />
        <Metric label="Valeur ecart" value={`${summary.value.toLocaleString('fr-FR')} Ar`} />
      </section>
    </form>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-[#1E3A8A]">{value}</p></div>
}
