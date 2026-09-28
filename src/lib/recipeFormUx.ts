/** Règles UX pures du formulaire FT, testables sans navigateur. */
export function isRecipeDraftMeaningful(name: string | undefined) {
  return Boolean(name?.trim())
}

export function normalizeRecipeArticleSearch(value: string) {
  return value.trim().toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** The ingredient picker searches immediately and progressively from the first character. */
export function canSearchRecipeArticles(value: string) {
  void value
  return true
}

export function filterRecipeArticleSearchResults<T extends { name: string }>(articles: T[], search: string) {
  const normalizedSearch = normalizeRecipeArticleSearch(search)
  return articles.filter((article) => normalizeRecipeArticleSearch(article.name).includes(normalizedSearch))
}

export function shouldReplaceInitialNumericValue(value: string | number, initialValue: string | number, isPersistedValue: boolean) {
  return !isPersistedValue && String(value) === String(initialValue)
}
