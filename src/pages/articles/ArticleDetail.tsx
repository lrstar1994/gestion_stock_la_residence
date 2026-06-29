import { ArchiveRestore, ArrowLeft, Pencil, Archive } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getArticle, setArticleStatus } from '../../api/modules/catalog.api'
import { useAuth } from '../../hooks/useAuth'
import { articleStatusLabels, canManageArticles } from '../../lib/catalog'
import type { Article } from '../../lib/catalog'

export function ArticleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = canManageArticles(profile?.role)
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)

  const loadArticle = useCallback(async () => {
    if (!id) {
      return
    }

    setLoading(true)
    try {
      setArticle(await getArticle(id))
    } catch {
      toast.error('Article introuvable')
      navigate('/articles')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    loadArticle()
  }, [loadArticle])

  const toggleArchive = async () => {
    if (!article) {
      return
    }

    const nextStatus = article.status === 'archived' ? 'active' : 'archived'
    const message = article.status === 'archived' ? 'Voulez-vous vraiment desarchiver cet article ?' : 'Voulez-vous vraiment archiver cet article ?'

    if (!window.confirm(message)) {
      return
    }

    try {
      await setArticleStatus(article.id, nextStatus, profile?.id)
      toast.success(nextStatus === 'archived' ? 'Article archive avec succes' : 'Article desarchive avec succes')
      await loadArticle()
    } catch {
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    }
  }

  if (loading || !article) {
    return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>
  }

  const locations = article.article_locations?.map((item) => item.locations.name) ?? []

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Article</p>
          <h1 className="page-title mt-2">{article.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/articles" className="btn-secondary">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour a la liste
          </Link>
          {canEdit && (
            <>
              <Link to={`/articles/${article.id}/edit`} className="btn-primary">
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </Link>
              <button type="button" onClick={toggleArchive} className="btn-secondary">
                {article.status === 'archived' ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                {article.status === 'archived' ? 'Desarchiver' : 'Archiver'}
              </button>
            </>
          )}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <Info label="Famille" value={article.families?.name ?? '-'} />
        <Info label="Unite" value={article.units ? `${article.units.name} (${article.units.abbreviation})` : '-'} />
        <Info label="Statut" value={articleStatusLabels[article.status]} />
        <Info label="Sous-famille" value={article.sub_family || '-'} />
        <Info label="Conditionnement" value={article.packaging || '-'} />
        <Info label="Fournisseur habituel" value={article.default_supplier || '-'} />
        <Info label="Stock minimum" value={String(article.min_stock ?? 0)} />
        <Info label="Creation" value={new Date(article.created_at).toLocaleDateString('fr-FR')} />
        <Info label="Mise a jour" value={new Date(article.updated_at).toLocaleDateString('fr-FR')} />
      </section>

      <section className="surface p-5">
        <p className="eyebrow">Localisations autorisees</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {locations.map((location) => (
            <span key={location} className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-semibold text-[#1E3A8A]">
              {location}
            </span>
          ))}
          {locations.length === 0 && <span className="text-sm text-slate-600">Aucune localisation.</span>}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
    </div>
  )
}
