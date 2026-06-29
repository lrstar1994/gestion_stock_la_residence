import { Save, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createEvent, getEvent, updateEvent } from '../../api/modules/events.api'
import { listRecipes } from '../../api/modules/recipes.api'
import { useAuth } from '../../hooks/useAuth'
import {
  calculateEquivalentAdults,
  calculateEventRecipeCost,
  calculateEventRecipePrice,
  calculateRecipePlannedPortions,
  eventStatusLabels,
  eventStatuses,
  eventTypeLabels,
  eventTypes,
  getRecipeEventCategory,
  interestLevelLabels,
  interestLevels,
  serviceTypeLabels,
  serviceTypes,
  suggestBuffetCoefficient,
} from '../../lib/events'
import type { EventFormValues, EventRecipeFormValues, EventStatus, EventType, InterestLevel, ServiceType } from '../../lib/events'
import { mainIngredientLabels, recipeTypeLabels } from '../../lib/recipes'
import type { Recipe } from '../../lib/recipes'

type SelectedRecipe = EventRecipeFormValues & { recipe: Recipe }

const defaultEvent = {
  name: '',
  type: 'buffet' as EventType,
  date: '',
  location: '',
  description: '',
  adults: 0,
  children: 0,
  child_coefficient: 0.5,
  safety_margin: 10,
  status: 'planifie' as EventStatus,
}

export function EventFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [eventFields, setEventFields] = useState(defaultEvent)
  const [library, setLibrary] = useState<Recipe[]>([])
  const [selectedRecipes, setSelectedRecipes] = useState<SelectedRecipe[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const equivalentAdults = calculateEquivalentAdults(eventFields.adults, eventFields.children, eventFields.child_coefficient)
  const filteredRecipes = library.filter((recipe) => `${recipe.name} ${recipe.code ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const totals = useMemo(() => selectedRecipes.reduce(
    (sum, item) => ({
      cost: sum.cost + item.estimated_cost,
      price: sum.price + item.estimated_price,
    }),
    { cost: 0, price: 0 },
  ), [selectedRecipes])

  useEffect(() => {
    listRecipes({ status: 'validee', pageSize: 1000 })
      .then((result) => setLibrary(result.recipes))
      .catch(() => toast.error('Impossible de charger la bibliotheque de recettes.'))
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getEvent(id)
      .then((event) => {
        setEventFields({
          name: event.name,
          type: event.type,
          date: event.date.slice(0, 16),
          location: event.location ?? '',
          description: event.description ?? '',
          adults: Number(event.adults),
          children: Number(event.children),
          child_coefficient: Number(event.child_coefficient),
          safety_margin: Number(event.safety_margin),
          status: event.status,
        })
        setSelectedRecipes((event.event_recipes ?? []).flatMap((item) => item.recipes ? [{
          recipe: item.recipes,
          recipe_id: item.recipe_id,
          service_type: item.service_type,
          interest_level: item.interest_level,
          suggested_coefficient: Number(item.suggested_coefficient ?? 0),
          selected_coefficient: Number(item.selected_coefficient ?? 0),
          coefficient_modification_reason: item.coefficient_modification_reason ?? '',
          portions_planned: Number(item.portions_planned ?? 0),
          estimated_cost: Number(item.estimated_cost ?? 0),
          estimated_price: calculateEventRecipePrice(item.recipes, Number(item.portions_planned ?? 0)),
        }] : []))
      })
      .catch(() => toast.error('Evenement introuvable'))
      .finally(() => setLoading(false))
  }, [id])

  const updateField = <K extends keyof typeof eventFields>(key: K, value: (typeof eventFields)[K]) => {
    setEventFields((current) => ({ ...current, [key]: value }))
  }

  const recomputeRows = (rows: SelectedRecipe[], nextEquivalent = equivalentAdults, nextSafety = eventFields.safety_margin) => {
    const counts = getCategoryCounts(rows.map((row) => row.recipe))
    return rows.map((row) => recomputeRow(row, counts, nextEquivalent, nextSafety))
  }

  const addRecipe = (recipe: Recipe) => {
    if (selectedRecipes.some((item) => item.recipe_id === recipe.id)) return
    const nextRows = [...selectedRecipes, {
      recipe,
      recipe_id: recipe.id,
      service_type: eventFields.type === 'buffet' ? 'buffet' as ServiceType : 'assiette' as ServiceType,
      interest_level: 'normal' as InterestLevel,
      suggested_coefficient: 40,
      selected_coefficient: 40,
      coefficient_modification_reason: '',
      portions_planned: equivalentAdults,
      estimated_cost: calculateEventRecipeCost(recipe, equivalentAdults),
      estimated_price: calculateEventRecipePrice(recipe, equivalentAdults),
    }]
    setSelectedRecipes(recomputeRows(nextRows))
  }

  const updateRecipeRow = (index: number, patch: Partial<SelectedRecipe>) => {
    const next = selectedRecipes.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row)
    setSelectedRecipes(recomputeRows(next))
  }

  const removeRecipe = (index: number) => {
    setSelectedRecipes(recomputeRows(selectedRecipes.filter((_, rowIndex) => rowIndex !== index)))
  }

  const recalculateForGuests = () => {
    const nextEquivalent = calculateEquivalentAdults(eventFields.adults, eventFields.children, eventFields.child_coefficient)
    setSelectedRecipes(recomputeRows(selectedRecipes, nextEquivalent, eventFields.safety_margin))
  }

  const save = async () => {
    try {
      if (!eventFields.name || !eventFields.date) throw new Error('Nom et date sont obligatoires')
      if (selectedRecipes.length === 0) throw new Error('Ajoutez au moins une recette au menu')

      const values: EventFormValues = {
        ...eventFields,
        recipes: selectedRecipes.map((item) => ({
          recipe_id: item.recipe_id,
          service_type: item.service_type,
          interest_level: item.interest_level,
          suggested_coefficient: item.suggested_coefficient,
          selected_coefficient: item.selected_coefficient,
          coefficient_modification_reason: item.coefficient_modification_reason,
          portions_planned: item.portions_planned,
          estimated_cost: item.estimated_cost,
          estimated_price: item.estimated_price,
        })),
      }
      const eventId = isEdit && id ? await updateEvent(id, values, profile?.id) : await createEvent(values, profile?.id)
      toast.success(isEdit ? 'Evenement mis a jour' : 'Evenement cree avec succes')
      navigate(`/events/${eventId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  if (loading) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Evenements</p><h1 className="page-title mt-2">{isEdit ? 'Modifier evenement' : 'Nouvel evenement'}</h1></header>

      <section className="surface grid gap-5 p-5 lg:grid-cols-2">
        <Field label="Nom"><input value={eventFields.name} onChange={(event) => updateField('name', event.target.value)} className="input mt-2" /></Field>
        <Field label="Type"><select value={eventFields.type} onChange={(event) => updateField('type', event.target.value as EventType)} className="input mt-2">{eventTypes.map((item) => <option key={item} value={item}>{eventTypeLabels[item]}</option>)}</select></Field>
        <Field label="Date et heure"><input value={eventFields.date} onChange={(event) => updateField('date', event.target.value)} type="datetime-local" className="input mt-2" /></Field>
        <Field label="Lieu"><input value={eventFields.location} onChange={(event) => updateField('location', event.target.value)} className="input mt-2" /></Field>
        <Field label="Adultes"><input value={eventFields.adults} onChange={(event) => updateField('adults', Number(event.target.value))} onBlur={recalculateForGuests} type="number" min="0" className="input mt-2" /></Field>
        <Field label="Enfants"><input value={eventFields.children} onChange={(event) => updateField('children', Number(event.target.value))} onBlur={recalculateForGuests} type="number" min="0" className="input mt-2" /></Field>
        <Field label="Coefficient enfant"><input value={eventFields.child_coefficient} onChange={(event) => updateField('child_coefficient', Number(event.target.value))} onBlur={recalculateForGuests} type="number" min="0" max="1" step="0.1" className="input mt-2" /></Field>
        <Field label="Marge securite %"><input value={eventFields.safety_margin} onChange={(event) => updateField('safety_margin', Number(event.target.value))} onBlur={recalculateForGuests} type="number" min="0" step="1" className="input mt-2" /></Field>
        <Field label="Statut"><select value={eventFields.status} onChange={(event) => updateField('status', event.target.value as EventStatus)} className="input mt-2">{eventStatuses.map((item) => <option key={item} value={item}>{eventStatusLabels[item]}</option>)}</select></Field>
        <div className="surface border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#1E3A8A]">Equivalent adultes</p>
          <p className="mt-2 text-2xl font-bold text-[#10285f]">{equivalentAdults.toLocaleString('fr-FR')}</p>
        </div>
        <label className="block lg:col-span-2"><span className="field-label">Description</span><textarea value={eventFields.description} onChange={(event) => updateField('description', event.target.value)} className="input mt-2 min-h-24 resize-none" /></label>
      </section>

      <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="surface p-5">
          <h2 className="text-lg font-bold">Bibliotheque</h2>
          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-9" placeholder="Rechercher une recette" />
          </label>
          <div className="mt-4 max-h-[520px] space-y-2 overflow-auto pr-1">
            {filteredRecipes.map((recipe) => (
              <button key={recipe.id} type="button" onClick={() => addRecipe(recipe)} className="w-full rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-[#D4AF37] hover:bg-amber-50">
                <span className="block font-semibold text-slate-950">{recipe.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{recipe.type} - {recipeTypeLabels[recipe.type]} / {mainIngredientLabels[recipe.main_ingredient]}</span>
                <span className="mt-1 block text-xs text-slate-500">{Number(recipe.total_cost).toLocaleString('fr-FR')} Ar pour {recipe.portions} portions</span>
              </button>
            ))}
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Menu evenement</h2>
            <div className="text-right text-sm">
              <p className="font-bold text-slate-950">{totals.cost.toLocaleString('fr-FR')} Ar</p>
              <p className="text-slate-500">Prix estime {totals.price.toLocaleString('fr-FR')} Ar</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {selectedRecipes.map((row, index) => (
              <div key={row.recipe_id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-bold text-slate-950">{row.recipe.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{getRecipeEventCategory(row.recipe)} - {row.recipe.portions} portions reference</p>
                  </div>
                  <button type="button" onClick={() => removeRecipe(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <select value={row.service_type} onChange={(event) => updateRecipeRow(index, { service_type: event.target.value as ServiceType })} className="input">
                    {serviceTypes.map((item) => <option key={item} value={item}>{serviceTypeLabels[item]}</option>)}
                  </select>
                  <select value={row.interest_level} onChange={(event) => updateRecipeRow(index, { interest_level: event.target.value as InterestLevel })} className="input">
                    {interestLevels.map((item) => <option key={item} value={item}>{interestLevelLabels[item]}</option>)}
                  </select>
                  <input value={row.suggested_coefficient} readOnly className="input bg-slate-100" title="Coefficient propose" />
                  <input value={row.selected_coefficient} onChange={(event) => updateRecipeRow(index, { selected_coefficient: Number(event.target.value) })} type="number" min="0" step="1" className="input" title="Coefficient retenu" />
                  <input value={row.portions_planned.toFixed(1)} readOnly className="input bg-slate-100" title="Portions prevues" />
                  <input value={row.estimated_cost.toFixed(0)} readOnly className="input bg-slate-100" title="Cout estime" />
                </div>
                {Math.abs(row.selected_coefficient - row.suggested_coefficient) >= 10 && (
                  <input value={row.coefficient_modification_reason ?? ''} onChange={(event) => updateRecipeRow(index, { coefficient_modification_reason: event.target.value })} className="input mt-3" placeholder="Motif de modification du coefficient" />
                )}
              </div>
            ))}
            {selectedRecipes.length === 0 && <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Ajoutez des recettes depuis la bibliotheque.</p>}
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <button type="button" onClick={save} className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button>
        <Link to="/events" className="btn-secondary">Annuler</Link>
      </div>
    </div>
  )
}

function recomputeRow(row: SelectedRecipe, counts: Record<string, number>, equivalentAdults: number, safetyMargin: number): SelectedRecipe {
  const category = getRecipeEventCategory(row.recipe)
  const suggested = row.service_type === 'assiette' ? 100 : suggestBuffetCoefficient(row.recipe, row.interest_level, counts[category] ?? 1)
  const selected = row.selected_coefficient === row.suggested_coefficient ? suggested : row.selected_coefficient
  const portionsPlanned = calculateRecipePlannedPortions({ serviceType: row.service_type, equivalentAdults, selectedCoefficient: selected, safetyMargin })
  return {
    ...row,
    suggested_coefficient: suggested,
    selected_coefficient: selected,
    portions_planned: portionsPlanned,
    estimated_cost: calculateEventRecipeCost(row.recipe, portionsPlanned),
    estimated_price: calculateEventRecipePrice(row.recipe, portionsPlanned),
  }
}

function getCategoryCounts(recipes: Recipe[]) {
  return recipes.reduce<Record<string, number>>((counts, recipe) => {
    const category = getRecipeEventCategory(recipe)
    counts[category] = (counts[category] ?? 0) + 1
    return counts
  }, {})
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}
