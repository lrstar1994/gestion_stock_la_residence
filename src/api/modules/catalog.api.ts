import { supabase } from '../../lib/supabase'
import type {
  Article,
  ArticleFormValues,
  ArticleStatus,
  Family,
  FamilyFormValues,
  Location,
  LocationFormValues,
  Unit,
  UnitFormValues,
} from '../../lib/catalog'

type ArticleFilters = {
  search?: string
  familyId?: string
  status?: ArticleStatus | 'all'
  page?: number
  pageSize?: number
}

function cleanNullable(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function listFamilies(search = '') {
  let query = supabase.schema('stock')
    .from('families')
    .select('*, articles(count)')
    .order('name', { ascending: true })

  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map((family) => ({
    ...family,
    articles_count: family.articles?.[0]?.count ?? 0,
  })) as Family[]
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

export async function deleteFamily(id: string) {
  const { count, error: countError } = await supabase.schema('stock')
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', id)

  if (countError) {
    throw countError
  }

  if ((count ?? 0) > 0) {
    throw new Error('Cette famille est utilisee par des articles et ne peut pas etre supprimee')
  }

  const { error } = await supabase.schema('stock').from('families').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function listUnits(search = '') {
  let query = supabase.schema('stock').from('units').select('*').order('name', { ascending: true })

  if (search.trim()) {
    const term = search.trim()
    query = query.or(`name.ilike.%${term}%,abbreviation.ilike.%${term}%`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

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

export async function deleteUnit(id: string) {
  const { count, error: countError } = await supabase.schema('stock')
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('unit_id', id)

  if (countError) {
    throw countError
  }

  if ((count ?? 0) > 0) {
    throw new Error('Cette unite est utilisee par des articles et ne peut pas etre supprimee')
  }

  const { error } = await supabase.schema('stock').from('units').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function listLocations(search = '') {
  let query = supabase.schema('stock')
    .from('locations')
    .select('*, article_locations(count)')
    .order('is_magasin_general', { ascending: false })
    .order('name', { ascending: true })

  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map((location) => ({
    ...location,
    articles_count: location.article_locations?.[0]?.count ?? 0,
  })) as Location[]
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

export async function deleteLocation(id: string) {
  const { count, error: countError } = await supabase.schema('stock')
    .from('article_locations')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', id)

  if (countError) {
    throw countError
  }

  if ((count ?? 0) > 0) {
    throw new Error('Cette localisation est utilisee par des articles et ne peut pas etre supprimee')
  }

  const { error } = await supabase.schema('stock').from('locations').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function listArticles(filters: ArticleFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.schema('stock')
    .from('articles')
    .select('*, families(id, name), units(id, name, abbreviation)', { count: 'exact' })
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

export async function createArticle(values: ArticleFormValues, profileId?: string) {
  const { data, error } = await supabase.schema('stock')
    .from('articles')
    .insert({
      name: values.name.trim(),
      family_id: values.family_id,
      sub_family: cleanNullable(values.sub_family),
      unit_id: values.unit_id,
      packaging: cleanNullable(values.packaging),
      default_supplier: cleanNullable(values.default_supplier),
      min_stock: values.min_stock,
      status: values.status,
      created_by: profileId,
      updated_by: profileId,
    })
    .select('id')
    .single()

  if (error) {
    throw error
  }

  await replaceArticleLocations(data.id, values.location_ids)
  return data.id as string
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
      status: values.status,
      updated_by: profileId,
    })
    .eq('id', id)

  if (error) {
    throw error
  }

  await replaceArticleLocations(id, values.location_ids)
}

export async function setArticleStatus(id: string, status: ArticleStatus, profileId?: string) {
  const { error } = await supabase.schema('stock').from('articles').update({ status, updated_by: profileId }).eq('id', id)

  if (error) {
    throw error
  }
}

async function replaceArticleLocations(articleId: string, locationIds: string[]) {
  const { error: deleteError } = await supabase.schema('stock').from('article_locations').delete().eq('article_id', articleId)

  if (deleteError) {
    throw deleteError
  }

  const rows = locationIds.map((locationId) => ({
    article_id: articleId,
    location_id: locationId,
  }))

  if (rows.length === 0) {
    return
  }

  const { error } = await supabase.schema('stock').from('article_locations').insert(rows)

  if (error) {
    throw error
  }
}
