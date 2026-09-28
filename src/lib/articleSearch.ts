import type { Article } from './catalog'

export function normalizeArticleSearch(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').trim()
}

function searchableArticleText(article: Article) {
  return normalizeArticleSearch([
    article.name,
    article.normalized_key,
    article.families?.name,
    article.sub_family,
    article.packaging,
    article.default_supplier,
    article.indicative_price_note,
  ].filter(Boolean).join(' '))
}

export function searchArticles(articles: Article[], rawTerm: string) {
  const term = normalizeArticleSearch(rawTerm)
  if (!term) return articles

  return articles.map((article) => {
    const text = searchableArticleText(article)
    const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    const name = normalizeArticleSearch(article.name)
    const nameWords = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    const matched = text.includes(term) || words.some((word) => word.startsWith(term))
    const rank = name === term ? 0
      : name.startsWith(term) ? 1
        : name.includes(term) ? 2
          : nameWords.some((word) => word.startsWith(term)) ? 3
            : matched ? 4 : 5
    return { article, matched, rank }
  }).filter((result) => result.matched)
    .sort((left, right) => left.rank - right.rank || left.article.name.localeCompare(right.article.name, 'fr'))
    .map(({ article }) => article)
}
