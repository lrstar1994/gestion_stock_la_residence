import { useMemo, useState } from 'react'
import type { Article } from '../../lib/catalog'
import { searchArticles } from '../../lib/articleSearch'

type Props = {
  articles: Article[]
  value: string
  onChange: (articleId: string) => void
  onCreate: () => void
  disabled?: boolean
  /** In transfer flows, creation is offered only after searching the complete article set. */
  allowCreateAfterNoMatch?: boolean
  extraOptions?: Array<{ value: string; label: string }>
}

export function ArticleSearchSelect({ articles, value, onChange, onCreate, disabled, allowCreateAfterNoMatch = false, extraOptions = [] }: Props) {
  const [search, setSearch] = useState('')
  const searchMatches = useMemo(() => searchArticles(articles, search), [articles, search])
  const filtered = useMemo(() => {
    if (!search.trim()) return articles
    if (value && !searchMatches.some((article) => article.id === value)) {
      const selected = articles.find((article) => article.id === value)
      if (selected) return [selected, ...searchMatches]
    }
    return searchMatches
  }, [articles, searchMatches, search, value])
  const matches = search.trim() ? searchMatches.slice(0, 8) : []
  const showCreate = allowCreateAfterNoMatch
    ? search.trim().length >= 2 && searchMatches.length === 0
    : true

  return (
    <div className="space-y-2">
      <input value={search} onChange={(event) => setSearch(event.target.value)} disabled={disabled} className="input disabled:bg-slate-100" placeholder="Rechercher : nom, mot-cle, famille, sous-famille..." />
      <select
        value={value}
        onChange={(event) => {
          if (event.target.value === '__new__') onCreate()
          else onChange(event.target.value)
        }}
        disabled={disabled}
        className="input disabled:bg-slate-100"
      >
        <option value="">Selectionner un article</option>
        {filtered.map((article) => <option key={article.id} value={article.id}>{article.name} - {article.units?.abbreviation ?? 'unite non definie'}</option>)}
        {extraOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        {showCreate && <option value="__new__">+ Nouvel article</option>}
      </select>
      {matches.length > 0 && <div role="listbox" aria-label="Résultats de recherche d’articles" className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-white shadow-sm">
        {matches.map((article) => <button key={article.id} type="button" role="option" aria-selected={article.id === value} onClick={() => { onChange(article.id); setSearch(article.name) }} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50 focus:bg-blue-50">
          <span className="font-semibold">{article.name}</span><span className="ml-2 text-slate-500">{article.units?.abbreviation ?? 'unité non définie'}</span>
          {(article.families?.name || article.sub_family) && <span className="ml-2 text-xs text-slate-500">{[article.families?.name, article.sub_family].filter(Boolean).join(' · ')}</span>}
        </button>)}
      </div>}
      {search.trim() && filtered.length === 0 && <p className="text-xs font-semibold text-amber-700">Aucun article correspondant dans les articles chargés. Vérifiez la recherche avant toute création.</p>}
    </div>
  )
}
