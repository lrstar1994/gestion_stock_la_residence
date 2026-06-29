import { supabase } from '../../lib/supabase'
import type { RecipeIngredient } from '../../lib/recipes'
import type {
  Event,
  EventFormValues,
  EventRecipe,
  EventStatus,
  EventType,
  PurchaseNeed,
  PurchaseNeedStatus,
} from '../../lib/events'
import {
  calculateConsumedPortions,
  calculateEquivalentAdults,
  calculateEventRecipeCost,
  calculateEventRecipePrice,
  calculateRecipePlannedPortions,
} from '../../lib/events'

type EventFilters = {
  search?: string
  type?: EventType | 'all'
  status?: EventStatus | 'all'
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
}

type ProductionPayload = Pick<EventRecipe, 'portions_produced' | 'portions_additional' | 'portions_returned' | 'portions_lost' | 'portions_unsold'>

function cleanNullable(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listEvents(filters: EventFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('events')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false })
    .range(from, to)

  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.fromDate) query = query.gte('date', filters.fromDate)
  if (filters.toDate) query = query.lte('date', filters.toDate)
  if (filters.search?.trim()) query = query.ilike('name', `%${filters.search.trim()}%`)

  const { data, error, count } = await query
  if (error) throw error
  return { events: (data ?? []) as Event[], total: count ?? 0 }
}

export async function getEvent(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('events')
    .select('*, event_recipes(*, recipes(*, recipe_ingredients(*, articles(id, name, unit_id, default_supplier, families(id, name), units(id, name, abbreviation)), units:units!recipe_ingredients_unit_id_fkey(id, name, abbreviation), display_unit:units!recipe_ingredients_unit_display_fkey(id, name, abbreviation), stored_unit:units!recipe_ingredients_unit_stored_fkey(id, name, abbreviation))))')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Event
}

export async function createEvent(values: EventFormValues, profileId?: string) {
  const totals = calculateEventTotals(values)
  const totalEquivalent = calculateEquivalentAdults(values.adults, values.children, values.child_coefficient)
  const { data, error } = await supabase.schema('stock')
    .from('events')
    .insert({
      name: values.name.trim(),
      type: values.type,
      date: values.date,
      location: cleanNullable(values.location),
      description: cleanNullable(values.description),
      adults: values.adults,
      children: values.children,
      child_coefficient: values.child_coefficient,
      total_equivalent: totalEquivalent,
      safety_margin: values.safety_margin,
      status: values.status,
      total_estimated_cost: totals.estimatedCost,
      total_estimated_price: totals.estimatedPrice,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()

  if (error) throw error
  await replaceEventRecipes(data.id, values, profileId)
  return data.id as string
}

export async function updateEvent(id: string, values: EventFormValues, profileId?: string) {
  const totals = calculateEventTotals(values)
  const totalEquivalent = calculateEquivalentAdults(values.adults, values.children, values.child_coefficient)
  const { error } = await supabase.schema('stock')
    .from('events')
    .update({
      name: values.name.trim(),
      type: values.type,
      date: values.date,
      location: cleanNullable(values.location),
      description: cleanNullable(values.description),
      adults: values.adults,
      children: values.children,
      child_coefficient: values.child_coefficient,
      total_equivalent: totalEquivalent,
      safety_margin: values.safety_margin,
      status: values.status,
      total_estimated_cost: totals.estimatedCost,
      total_estimated_price: totals.estimatedPrice,
      updated_by: profileId,
    })
    .eq('id', id)

  if (error) throw error
  await replaceEventRecipes(id, values, profileId)
  return id
}

async function replaceEventRecipes(eventId: string, values: EventFormValues, profileId?: string) {
  const { error: deleteError } = await supabase.schema('stock').from('event_recipes').delete().eq('event_id', eventId)
  if (deleteError) throw deleteError
  if (values.recipes.length === 0) return

  const rows = values.recipes.map((recipe) => ({
    event_id: eventId,
    recipe_id: recipe.recipe_id,
    service_type: recipe.service_type,
    interest_level: recipe.interest_level,
    suggested_coefficient: recipe.suggested_coefficient,
    selected_coefficient: recipe.selected_coefficient,
    coefficient_modification_reason: cleanNullable(recipe.coefficient_modification_reason),
    coefficient_modified_by: Math.abs(recipe.selected_coefficient - recipe.suggested_coefficient) >= 10 ? profileId : null,
    coefficient_modified_at: Math.abs(recipe.selected_coefficient - recipe.suggested_coefficient) >= 10 ? new Date().toISOString() : null,
    portions_planned: recipe.portions_planned,
    estimated_cost: recipe.estimated_cost,
  }))

  const { error } = await supabase.schema('stock').from('event_recipes').insert(rows)
  if (error) throw error
}

function calculateEventTotals(values: EventFormValues) {
  return values.recipes.reduce(
    (totals, recipe) => ({
      estimatedCost: totals.estimatedCost + Number(recipe.estimated_cost ?? 0),
      estimatedPrice: totals.estimatedPrice + Number(recipe.estimated_price ?? 0),
    }),
    { estimatedCost: 0, estimatedPrice: 0 },
  )
}

export async function updateEventRecipeProduction(id: string, values: ProductionPayload) {
  const consumed = calculateConsumedPortions({
    portions_produced: Number(values.portions_produced ?? 0),
    portions_additional: Number(values.portions_additional ?? 0),
    portions_returned: Number(values.portions_returned ?? 0),
    portions_lost: Number(values.portions_lost ?? 0),
  } as EventRecipe)

  const { data: current, error: currentError } = await supabase.schema('stock')
    .from('event_recipes')
    .select('recipes(portions, total_cost), portions_planned')
    .eq('id', id)
    .single()

  if (currentError) throw currentError

  const recipe = Array.isArray(current.recipes) ? current.recipes[0] : current.recipes
  const realCost = recipe ? (Number(recipe.total_cost) / Math.max(1, Number(recipe.portions))) * consumed : 0

  const { error } = await supabase.schema('stock')
    .from('event_recipes')
    .update({
      portions_produced: values.portions_produced,
      portions_additional: values.portions_additional,
      portions_returned: values.portions_returned,
      portions_lost: values.portions_lost,
      portions_unsold: values.portions_unsold,
      portions_consumed: consumed,
      real_cost: realCost,
    })
    .eq('id', id)

  if (error) throw error
}

export async function setEventStatus(id: string, status: EventStatus) {
  const { error } = await supabase.schema('stock').from('events').update({ status }).eq('id', id)
  if (error) throw error
}

export async function generatePurchaseNeeds(eventId: string, profileId?: string) {
  const event = await getEvent(eventId)
  const needs = new Map<string, { articleId: string; unitId: string; quantity: number; cost: number }>()

  for (const item of event.event_recipes ?? []) {
    if (!item.recipes) continue
    const multiplier = Number(item.portions_planned ?? 0) / Math.max(1, Number(item.recipes.portions ?? 1))

    for (const ingredient of item.recipes.recipe_ingredients ?? []) {
      const articleId = ingredient.article_id
      const unitId = ingredient.unit_stored ?? ingredient.articles?.unit_id ?? ingredient.unit_id
      if (!articleId || !unitId) continue

      const quantity = Number(ingredient.quantity_stored ?? ingredient.quantity ?? 0) * multiplier
      const cost = quantity * Number(ingredient.unit_price ?? 0)
      const key = `${articleId}:${unitId}`
      const current = needs.get(key)
      needs.set(key, {
        articleId,
        unitId,
        quantity: (current?.quantity ?? 0) + quantity,
        cost: (current?.cost ?? 0) + cost,
      })
    }
  }

  const { error: deleteError } = await supabase.schema('stock').from('purchase_needs').delete().eq('event_id', eventId)
  if (deleteError) throw deleteError

  const rows = [...needs.values()].map((need) => ({
    event_id: eventId,
    article_id: need.articleId,
    quantity: need.quantity,
    quantity_needed: need.quantity,
    unit_id: need.unitId,
    origin: 'evenement' as const,
    urgency: 'normal' as const,
    estimated_price: need.quantity > 0 ? need.cost / need.quantity : null,
    estimated_cost: need.cost,
    status: 'a_faire' as const,
    created_by: profileId,
  }))

  if (rows.length > 0) {
    const { error } = await supabase.schema('stock').from('purchase_needs').insert(rows)
    if (error) throw error
  }

  return listPurchaseNeeds(eventId)
}

export async function listPurchaseNeeds(eventId: string) {
  const { data, error } = await supabase.schema('stock')
    .from('purchase_needs')
    .select('*, articles(id, name, default_supplier, families(id, name)), units(id, name, abbreviation)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as PurchaseNeed[]
}

export async function updatePurchaseNeedStatus(id: string, status: PurchaseNeedStatus) {
  const { error } = await supabase.schema('stock').from('purchase_needs').update({ status }).eq('id', id)
  if (error) throw error
}

export function calculateEventRecipeFromRecipe(params: {
  recipe: {
    id: string
    portions: number
    total_cost: number
    final_price: number
    type: string
  }
  equivalentAdults: number
  safetyMargin: number
  serviceType: 'assiette' | 'buffet'
  selectedCoefficient: number
}) {
  const portionsPlanned = calculateRecipePlannedPortions({
    serviceType: params.serviceType,
    equivalentAdults: params.equivalentAdults,
    selectedCoefficient: params.selectedCoefficient,
    safetyMargin: params.safetyMargin,
  })
  const recipe = params.recipe as never
  return {
    portionsPlanned,
    estimatedCost: calculateEventRecipeCost(recipe, portionsPlanned),
    estimatedPrice: calculateEventRecipePrice(recipe, portionsPlanned),
  }
}

export type PurchaseNeedExportRow = {
  Fournisseur: string
  Article: string
  Famille: string
  Quantite: number
  Unite: string
  'Cout estime': number
  Statut: string
}

export function purchaseNeedsToRows(needs: PurchaseNeed[]): PurchaseNeedExportRow[] {
  return needs.map((need) => ({
    Fournisseur: need.articles?.default_supplier || 'Sans fournisseur',
    Article: need.articles?.name || '',
    Famille: need.articles?.families?.name || '',
    Quantite: Number(need.quantity_needed ?? 0),
    Unite: need.units?.abbreviation || need.units?.name || '',
    'Cout estime': Number(need.estimated_cost ?? 0),
    Statut: need.status,
  }))
}

export type { RecipeIngredient }
