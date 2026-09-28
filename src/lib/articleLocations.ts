export function getArticleAllowedLocationIds(
  locationsRestricted: boolean | null | undefined,
  explicitlyAllowedIds: Iterable<string>,
  activeLocationIds: Iterable<string>,
) {
  const activeIds = new Set(activeLocationIds)
  if (!locationsRestricted) return [...activeIds]
  return [...new Set(explicitlyAllowedIds)].filter((id) => activeIds.has(id))
}

export function isArticleAllowedAtLocation(
  locationsRestricted: boolean | null | undefined,
  explicitlyAllowedIds: Iterable<string>,
  activeLocationIds: Iterable<string>,
  locationId: string,
) {
  return getArticleAllowedLocationIds(locationsRestricted, explicitlyAllowedIds, activeLocationIds).includes(locationId)
}
