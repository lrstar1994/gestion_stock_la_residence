import { Archive, Eye, Pencil, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listArticles, listFamilies } from '../../api/modules/catalog.api'
import { useAuth } from '../../hooks/useAuth'
import { articleStatusLabels, canManageArticles } from '../../lib/catalog'
import type { Article, ArticleStatus, Family } from '../../lib/catalog'

const statusClasses: Record<ArticleStatus, string> = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  inactive: 'bg-slate-100 text-slate-700 ring-slate-200',
  archived: 'bg-red-50 text-red-700 ring-red-200',
}

export function ArticlesList() {
  const { profile } = useAuth()
  const canEdit = canManageArticles(profile?.role)
  const [articles, setArticles] = useState<Article[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [search, setSearch] = useState('')
  const [familyId, setFamilyId] = useState('all')
  const [status, setStatus] = useState<ArticleStatus | 'all'>('all')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, familyId, status, page, pageSize }), [familyId, page, pageSize, search, status])

  useEffect(() => {
    listFamilies().then(setFamilies).catch(() => toast.error('Une erreur est survenue. Veuillez reessayer.'))
  }, [])

  useEffect(() => {
    setLoading(true)
    listArticles(filters)
      .then((result) => {
        setArticles(result.articles)
        setTotal(result.total)
      })
      .catch(() => toast.error('Une erreur est survenue. Veuillez reessayer.'))
      .finally(() => setLoading(false))
  }, [filters])

  const resetPage = (callback: () => void) => {
    setPage(1)
    callback()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="page-title mt-2">Articles</h1>
          <p className="mt-2 text-sm text-slate-600">Base des produits suivis dans le stock.</p>
        </div>
        {canEdit && (
          <Link to="/articles/new" className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nouvel article
          </Link>
        )}
      </header>

      <section className="surface p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_150px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => resetPage(() => setSearch(event.target.value))}
              className="input pl-9"
              placeholder="Rechercher par nom ou famille"
            />
          </label>
          <select value={familyId} onChange={(event) => resetPage(() => setFamilyId(event.target.value))} className="input">
            <option value="all">Toutes les familles</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as ArticleStatus | 'all'))} className="input">
            <option value="all">Actifs + inactifs</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
            <option value="archived">Archive</option>
          </select>
          <select value={pageSize} onChange={(event) => resetPage(() => setPageSize(Number(event.target.value)))} className="input">
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_1fr_110px_1fr_110px_130px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Nom</span>
          <span>Famille</span>
          <span>Unite</span>
          <span>Fournisseur</span>
          <span>Stock min.</span>
          <span>Statut</span>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-600">Chargement...</p>
        ) : articles.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">Aucun article trouve.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {articles.map((article) => (
              <article key={article.id} className="grid gap-4 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[1.2fr_1fr_110px_1fr_110px_130px_140px] xl:items-center">
                <div>
                  <p className="font-semibold text-slate-950">{article.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{article.packaging || 'Conditionnement non renseigne'}</p>
                </div>
                <p className="text-sm text-slate-700">{article.families?.name ?? '-'}</p>
                <p className="text-sm font-semibold text-[#1E3A8A]">{article.units?.abbreviation ?? '-'}</p>
                <p className="text-sm text-slate-700">{article.default_supplier || '-'}</p>
                <p className="text-sm text-slate-700">{article.min_stock ?? 0}</p>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClasses[article.status]}`}>
                  {articleStatusLabels[article.status]}
                </span>
                <div className="flex gap-2">
                  <Link to={`/articles/${article.id}`} className="btn-secondary px-3 py-2" aria-label="Voir">
                    <Eye className="h-4 w-4" />
                  </Link>
                  {canEdit && (
                    <Link to={`/articles/${article.id}/edit`} className="btn-secondary px-3 py-2" aria-label="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Link>
                  )}
                  {article.status === 'archived' && <Archive className="mt-2 h-4 w-4 text-red-500" />}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Page {page} sur {totalPages} - {total} article(s)
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="btn-secondary">
            Precedent
          </button>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} className="btn-secondary">
            Suivant
          </button>
        </div>
      </div>
    </div>
  )
}
