import { supabase } from '../../lib/supabase'
import { getArticleAllowedLocationIds } from '../../lib/articleLocations'
import { getActiveStockProfileRole } from './stockAccess.api'
import type {
  Article,
  ArticleFormValues,
  ArticleStatus,
  Family,
  FamilyFormValues,
  Location,
  LocationFormValues,
  SubCategory,
  SubCategoryFormValues,
  Unit,
  UnitFormValues,
} from '../../lib/catalog'

type ArticleFilters = {
  search?: string
  familyId?: string
  status?: ArticleStatus | 'all'
  sellableWithoutTransformation?: boolean
  usableInRecipes?: boolean
  stockable?: boolean
  nature?: Article['nature'] | 'all'
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listFamilies(search = '', includeInactive = false) {
  let query = supabase.schema('stock')
    .from('families')
    .select('*, articles(count)')
    .order('name', { ascending: true })

  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map((family) => ({
    ...family,
    articles_count: family.articles?.[0]?.count ?? 0,
  })) as Family[]
}

// The article editor only needs reference values, not embedded counts/joins.
// Keeping this request minimal avoids unrelated RLS/count joins blocking an edit.
export async function listArticleEditorFamilies(includeInactive = false) {
  let query = supabase.schema('stock').from('families').select('id, name, is_active').order('name', { ascending: true })
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Family[]
}

export async function createFamily(values: FamilyFormValues, profileId?: string) {
  const { error } = await supabase.schema('stock').from('families').insert({
    name: values.name.trim(),
    description: cleanNullable(values.description),
    created_by: profileId,
  })

  if (error) {
    throw error
  }

}

export async function updateFamily(id: string, values: FamilyFormValues) {
  const { error } = await supabase.schema('stock')
    .from('families')
    .update({
      name: values.name.trim(),
      description: cleanNullable(values.description),
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function deleteFamily(id: string, pin: string, reason: string) {
  return deleteReferential('family', id, pin, reason)
}

export async function listSubCategories(familyId?: string, search = '', includeInactive = false) {
  let query = supabase.schema('stock')
    .from('sub_categories')
    .select('*, families(id, name)')
    .order('family_id', { ascending: true })
    .order('name', { ascending: true })

  if (familyId && familyId !== 'all') {
    query = query.eq('family_id', familyId)
  }
  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) {
    throw error
  }

  const rows = (data ?? []) as SubCategory[]
  const counts = await Promise.all(rows.map(async (subCategory) => {
    const { count } = await supabase.schema('stock')
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', subCategory.family_id)
      .eq('sub_family', subCategory.name)
    return [subCategory.id, count ?? 0] as const
  }))
  const countById = new Map(counts)
  return rows.map((subCategory) => ({
    ...subCategory,
    articles_count: countById.get(subCategory.id) ?? 0,
  }))
}

export async function listArticleEditorSubCategories(includeInactive = false) {
  let query = supabase.schema('stock').from('sub_categories').select('id, family_id, name, is_active').order('family_id').order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as SubCategory[]
}

export async function createSubCategory(values: SubCategoryFormValues, profileId?: string) {
  const { error } = await supabase.schema('stock').from('sub_categories').insert({
    family_id: values.family_id,
    name: values.name.trim(),
    created_by: profileId,
  })

  if (error) {
    throw error
  }
}

export async function updateSubCategory(id: string, values: SubCategoryFormValues) {
  const { error } = await supabase.schema('stock')
    .from('sub_categories')
    .update({
      family_id: values.family_id,
      name: values.name.trim(),
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function deleteSubCategory(id: string, pin: string, reason: string) {
  return deleteReferential('sub_category', id, pin, reason)
}

export async function listUnits(search = '', includeInactive = false) {
  let query = supabase.schema('stock').from('units').select('*').order('name', { ascending: true })

  if (search.trim()) {
    const term = search.trim()
    query = query.or(`name.ilike.%${term}%,abbreviation.ilike.%${term}%`)
  }
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query

  if (error) {
    throw error
  }

  const rows = (data ?? []) as Unit[]
  const counts = await Promise.all(rows.map(async (unit) => {
    const { count } = await supabase.schema('stock').from('articles').select('id', { count: 'exact', head: true }).eq('unit_id', unit.id)
    return [unit.id, count ?? 0] as const
  }))
  const countById = new Map(counts)
  return rows.map((unit) => ({ ...unit, articles_count: countById.get(unit.id) ?? 0 }))
}

export async function listArticleEditorUnits(includeInactive = false) {
  let query = supabase.schema('stock').from('units').select('id, name, abbreviation, is_active').order('name', { ascending: true })
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Unit[]
}

export async function createUnit(values: UnitFormValues, profileId?: string) {
  const { error } = await supabase.schema('stock').from('units').insert({
    name: values.name.trim(),
    abbreviation: values.abbreviation.trim(),
    created_by: profileId,
  })

  if (error) {
    throw error
  }
}

export async function updateUnit(id: string, values: UnitFormValues) {
  const { error } = await supabase.schema('stock')
    .from('units')
    .update({
      name: values.name.trim(),
      abbreviation: values.abbreviation.trim(),
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function deleteUnit(id: string, pin: string, reason: string) {
  return deleteReferential('unit', id, pin, reason)
}

export async function listLocations(search = '', includeInactive = false) {
  const { data: allowedLocationIds, error: accessError } = await supabase.schema('stock')
    .rpc('list_stock_operational_location_ids', { p_include_inactive: includeInactive })

  let scopedLocationIds = (allowedLocationIds ?? []) as string[]
  if (accessError) {
    // The location-scope RPC is introduced by migration 202609160001. Until that
    // migration is available to PostgREST, preserve the established global
    // read for Direction and Controller without weakening access for other roles.
    if (accessError.code !== 'PGRST202') throw accessError

    const role = await getActiveStockProfileRole()
    if (!['direction', 'controleur'].includes(role)) throw accessError

    // null means rely on the locations table RLS, which still determines access.
    scopedLocationIds = []
  }

  const hasScopedIds = !accessError
  if (hasScopedIds && !scopedLocationIds.length) return []

  let query = supabase.schema('stock')
    .from('locations')
    .select('*')
    .order('is_magasin_general', { ascending: false })
    .order('name', { ascending: true })

  if (hasScopedIds) query = query.in('id', scopedLocationIds)

  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query

  if (error) {
    throw error
  }

  const { data: articles, error: articlesError } = await supabase.schema('stock')
    .from('articles')
    .select('locations_restricted, article_locations(location_id)')
    .eq('stockable', true)
    .eq('status', 'active')
  if (articlesError) throw articlesError

  const operationalLocations = (data ?? []).filter((location) => !(location as { is_stock_transit?: boolean }).is_stock_transit)
  const allowedCountByLocation = new Map<string, number>()
  for (const location of operationalLocations) allowedCountByLocation.set(location.id, 0)
  for (const article of articles ?? []) {
    const allowedIds = getArticleAllowedLocationIds(
      article.locations_restricted,
      article.article_locations?.map((link) => link.location_id) ?? [],
      operationalLocations.map((location) => location.id),
    )
    for (const locationId of allowedIds) {
      allowedCountByLocation.set(locationId, (allowedCountByLocation.get(locationId) ?? 0) + 1)
    }
  }

  return operationalLocations.map((location) => ({
    ...location,
    articles_count: allowedCountByLocation.get(location.id) ?? 0,
  })) as Location[]
}

/**
 * Minimal location reference for administrative profile assignment.
 * Unlike listLocations(), this intentionally does not load/filter articles,
 * whose location-restriction columns belong to a separate schema migration.
 */
export async function listLocationsForUserAssignment(): Promise<Location[]> {
  const { data: allowedLocationIds, error: accessError } = await supabase.schema('stock')
    .rpc('list_stock_operational_location_ids', { p_include_inactive: false })

  let scopedLocationIds = (allowedLocationIds ?? []) as string[]
  let hasScopedIds = !accessError
  if (accessError) {
    // Older TEST schemas may not expose the stock-scope RPC yet. Keep the
    // Direction/Controller read governed by the existing locations RLS.
    if (accessError.code !== 'PGRST202') throw accessError
    const role = await getActiveStockProfileRole()
    if (!['direction', 'controleur'].includes(role)) throw accessError
    scopedLocationIds = []
    hasScopedIds = false
  }

  if (hasScopedIds && scopedLocationIds.length === 0) return []

  let query = supabase.schema('stock').from('locations').select('*')
    .eq('is_active', true)
    .order('is_magasin_general', { ascending: false })
    .order('name', { ascending: true })
  if (hasScopedIds) query = query.in('id', scopedLocationIds)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).filter((location) => !(location as { is_stock_transit?: boolean }).is_stock_transit) as Location[]
}

export async function createLocation(values: LocationFormValues, profileId?: string) {
  const { error } = await supabase.schema('stock').from('locations').insert({
    name: values.name.trim(),
    description: cleanNullable(values.description),
    is_magasin_general: values.is_magasin_general,
    created_by: profileId,
  })

  if (error) {
    throw error
  }
}

export async function updateLocation(id: string, values: LocationFormValues) {
  const { error } = await supabase.schema('stock')
    .from('locations')
    .update({
      name: values.name.trim(),
      description: cleanNullable(values.description),
      is_magasin_general: values.is_magasin_general,
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function deleteLocation(id: string, pin: string, reason: string) {
  return deleteReferential('location', id, pin, reason)
}

type ArticleCreateValues = Omit<
  ArticleFormValues,
  'nature' | 'stockable' | 'locations_restricted' | 'durable_equipment' | 'indicative_price' | 'indicative_price_note'
> & Partial<Pick<
  ArticleFormValues,
  'nature' | 'stockable' | 'locations_restricted' | 'durable_equipment' | 'indicative_price' | 'indicative_price_note'
>>

export type ReferentialKind = 'family' | 'sub_category' | 'unit' | 'location'

export async function deleteReferential(kind: ReferentialKind, id: string, pin: string, reason: string) {
  const { error } = await supabase.schema('stock').rpc('delete_referential_with_pin', {
    p_kind: kind,
    p_id: id,
    p_pin: pin,
    p_reason: reason,
  })
  if (error) throw error
}

export async function setReferentialActive(kind: ReferentialKind, id: string, active: boolean, pin: string, reason: string) {
  const { error } = await supabase.schema('stock').rpc('set_referential_active_with_pin', {
    p_kind: kind,
    p_id: id,
    p_active: active,
    p_pin: pin,
    p_reason: reason,
  })
  if (error) throw error
}

export async function mergeFamilies(sourceId: string, targetId: string, pin: string, reason: string) {
  const { error } = await supabase.schema('stock').rpc('merge_families_with_pin', {
    p_source_id: sourceId,
    p_target_id: targetId,
    p_pin: pin,
    p_reason: reason,
  })
  if (error) throw error
}

export async function listArticles(filters: ArticleFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('articles')
    .select('*, families(id, name), units(id, name, abbreviation), article_locations(locations(*))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters.familyId && filters.familyId !== 'all') {
    query = query.eq('family_id', filters.familyId)
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  } else {
    query = query.neq('status', 'archived')
  }

  if (typeof filters.sellableWithoutTransformation === 'boolean') {
    query = query.eq('sellable_without_transformation', filters.sellableWithoutTransformation)
  }

  if (typeof filters.usableInRecipes === 'boolean') {
    query = query.eq('usable_in_recipes', filters.usableInRecipes)
  }
  if (typeof filters.stockable === 'boolean') {
    query = query.eq('stockable', filters.stockable)
  }
  if (filters.nature && filters.nature !== 'all') {
    query = query.eq('nature', filters.nature)
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim()
    const { data: matchingFamilies, error: familySearchError } = await supabase.schema('stock')
      .from('families')
      .select('id')
      .ilike('name', `%${term}%`)

    if (familySearchError) {
      throw familySearchError
    }

    const familyIds = (matchingFamilies ?? []).map((family) => family.id)
    const familyFilter = familyIds.length > 0 ? `,family_id.in.(${familyIds.join(',')})` : ''
    query = query.or(`name.ilike.%${term}%${familyFilter}`)
  }

  const { data, error, count } = await query

  if (error) {
    throw error
  }

  return {
    articles: (data ?? []) as Article[],
    total: count ?? 0,
  }
}

/** Load the complete filtered article set when a local, accent-insensitive search is needed. */
export async function listAllArticles(filters: Omit<ArticleFilters, 'page' | 'pageSize'> = {}) {
  const pageSize = 1000
  const articles: Article[] = []
  for (let page = 1; ; page += 1) {
    const result = await listArticles({ ...filters, page, pageSize })
    articles.push(...result.articles)
    if (articles.length >= result.total || result.articles.length === 0) break
  }
  return articles
}

export async function getArticle(id: string) {
  const { data, error } = await supabase.schema('stock')
    .from('articles')
    .select('*, families(id, name), units(id, name, abbreviation), article_locations(locations(*))')
    .eq('id', id)
    .single()

  if (error) {
    throw error
  }

  return data as Article
}

export async function createArticle(values: ArticleCreateValues, profileId?: string) {
  const { data, error } = await supabase.schema('stock').rpc('create_article_with_location_restriction', {
    p_payload: {
      name: values.name.trim(),
      family_id: values.family_id,
      sub_family: cleanNullable(values.sub_family),
      unit_id: values.unit_id,
      packaging: cleanNullable(values.packaging),
      default_supplier: cleanNullable(values.default_supplier),
      min_stock: values.min_stock,
      nature: values.nature ?? 'autre',
      stockable: values.stockable ?? true,
      locations_restricted: values.locations_restricted ?? false,
      durable_equipment: values.durable_equipment ?? false,
      indicative_price: values.indicative_price ?? null,
      indicative_price_note: cleanNullable(values.indicative_price_note),
      sellable_without_transformation: values.sellable_without_transformation,
      usable_in_recipes: values.usable_in_recipes,
      status: values.status,
    },
    p_location_ids: values.locations_restricted ? values.location_ids : [],
    p_profile_id: profileId ?? null,
  })

  if (error) {
    throw error
  }
  if (!data) throw new Error('La création de l’article n’a retourné aucun identifiant')
  return data as string
}

export async function updateArticle(id: string, values: ArticleFormValues, profileId?: string) {
  const { error } = await supabase.schema('stock')
    .from('articles')
    .update({
      name: values.name.trim(),
      family_id: values.family_id,
      sub_family: cleanNullable(values.sub_family),
      unit_id: values.unit_id,
      packaging: cleanNullable(values.packaging),
      default_supplier: cleanNullable(values.default_supplier),
      min_stock: values.min_stock,
      nature: values.nature,
      stockable: values.stockable,
      durable_equipment: values.durable_equipment,
      indicative_price: values.indicative_price,
      indicative_price_note: cleanNullable(values.indicative_price_note),
      sellable_without_transformation: values.sellable_without_transformation,
      usable_in_recipes: values.usable_in_recipes,
      status: values.status,
      updated_by: profileId,
    })
    .eq('id', id)

  if (error) {
    throw error
  }

  const { error: locationError } = await supabase.schema('stock').rpc('set_article_location_restriction', {
    p_article_id: id,
    p_locations_restricted: values.stockable && values.locations_restricted,
    p_location_ids: values.stockable && values.locations_restricted ? values.location_ids : [],
  })
  if (locationError) throw locationError
}

export async function isArticleAllowedAtLocation(articleId: string, locationId: string) {
  const { data: article, error: articleError } = await supabase.schema('stock')
    .from('articles')
    .select('locations_restricted')
    .eq('id', articleId)
    .maybeSingle()
  if (articleError) throw articleError
  if (!article) return false

  const { data: location, error: locationError } = await supabase.schema('stock')
    .from('locations')
    .select('id')
    .eq('id', locationId)
    .eq('is_active', true)
    .maybeSingle()
  if (locationError) throw locationError
  if (!location) return false
  if (!article.locations_restricted) return true

  const { count, error } = await supabase.schema('stock')
    .from('article_locations')
    .select('id', { count: 'exact', head: true })
    .eq('article_id', articleId)
    .eq('location_id', locationId)
  if (error) throw error
  return (count ?? 0) > 0
}

export async function updateArticleSensitive(id: string, values: ArticleFormValues, pin: string, reason: string) {
  const { error } = await supabase.schema('stock').rpc('update_article_sensitive_with_pin', {
    p_article_id: id,
    p_payload: values,
    p_pin: pin,
    p_reason: reason,
  })
  if (error) throw error
}

export async function setArticleStatus(id: string, status: ArticleStatus, profileId?: string) {
  const { error } = await supabase.schema('stock').from('articles').update({ status, updated_by: profileId }).eq('id', id)

  if (error) {
    throw error
  }
}

export async function setArticleStatusSensitive(id: string, status: ArticleStatus, pin: string, reason: string) {
  const { error } = await supabase.schema('stock').rpc('set_article_status_with_pin', {
    p_article_id: id,
    p_status: status,
    p_pin: pin,
    p_reason: reason,
  })
  if (error) throw error
}

