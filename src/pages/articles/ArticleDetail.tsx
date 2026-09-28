import { ArchiveRestore, ArrowLeft, Pencil, Archive } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getArticle, setArticleStatusSensitive } from '../../api/modules/catalog.api'
import { getMyPinStatus } from '../../api/modules/sensitiveActions.api'
import { SensitiveActionModal } from '../../components/SensitiveActionModal'
import { useAuth } from '../../hooks/useAuth'
import { articleNatureLabels, articleStatusLabels, canManageArticles } from '../../lib/catalog'
import type { Article } from '../../lib/catalog'

export function ArticleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = canManageArticles(profile?.role)
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [pinDefined, setPinDefined] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

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

  useEffect(() => {
    getMyPinStatus().then((status) => setPinDefined(status.pin_defined)).catch(() => setPinDefined(false))
  }, [])

  const toggleArchive = async () => {
    if (!article) {
      return
    }

    const nextStatus = article.status === 'archived' ? 'active' : 'archived'
    if (nextStatus) setStatusModalOpen(true)
  }

  if (loading || !article) {
    return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>
  }

  const locations = article.locations_restricted
    ? article.article_locations?.map((item) => item.locations.name) ?? []
    : []

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
            Retour à la liste
          </Link>
          {canEdit && (
            <>
              <Link to={`/articles/${article.id}/edit`} className="btn-primary">
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </Link>
              <button type="button" onClick={toggleArchive} className="btn-secondary">
                {article.status === 'archived' ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
                {article.status === 'archived' ? 'Désarchiver' : 'Archiver'}
              </button>
            </>
          )}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <Info label="Catégorie" value={article.families?.name ?? '-'} />
        <Info label="Nature" value={articleNatureLabels[article.nature ?? 'autre']} />
        <Info label="Stockable" value={article.stockable ? 'Oui' : 'Non'} />
        <Info label="Unité stock de référence" value={article.units ? `${article.units.name} (${article.units.abbreviation})` : '-'} />
        <Info label="Statut" value={articleStatusLabels[article.status]} />
        <Info label="Sous-catégorie" value={article.sub_family || '-'} />
        <Info label="Conditionnement" value={article.packaging || '-'} />
        <Info label="Fournisseur principal" value={article.default_supplier || '-'} />
        <Info label="Stock minimum" value={String(article.min_stock ?? 0)} />
        <Info label="À vendre sans transformation" value={article.sellable_without_transformation ? 'Oui' : 'Non'} />
        <Info label="Équipement durable" value={article.durable_equipment ? 'Oui' : 'Non'} />
        <Info label="Prix indicatif" value={article.indicative_price == null ? 'Non renseigné' : `${Number(article.indicative_price).toLocaleString('fr-FR')} Ar`} />
        <Info label="Utilisable en fiche technique" value={article.usable_in_recipes ? 'Oui' : 'Non'} />
        <Info label="Création" value={new Date(article.created_at).toLocaleDateString('fr-FR')} />
        <Info label="Mise à jour" value={new Date(article.updated_at).toLocaleDateString('fr-FR')} />
      </section>

      <section className="surface p-5">
        <p className="eyebrow">Localisations autorisées</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!article.locations_restricted && <span className="rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">Toutes les localisations actives</span>}
          {locations.map((location) => (
            <span key={location} className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-semibold text-[#1E3A8A]">
              {location}
            </span>
          ))}
          {article.locations_restricted && locations.length === 0 && <span className="text-sm text-slate-600">Aucune localisation sélectionnée.</span>}
        </div>
      </section>
      <SensitiveActionModal
        open={statusModalOpen}
        title={article.status === 'archived' ? 'Réactiver l’article' : 'Désactiver l’article'}
        description="L’historique est conservé ; l’article n’est pas supprimé physiquement."
        permissionLabel={article.status === 'archived' ? 'items.reactivate' : 'items.deactivate'}
        pinDefined={pinDefined}
        requireReason
        busy={savingStatus}
        onCancel={() => setStatusModalOpen(false)}
        onConfirm={async ({ pin, reason }) => {
          setSavingStatus(true)
          try {
            const nextStatus = article.status === 'archived' ? 'active' : 'archived'
            await setArticleStatusSensitive(article.id, nextStatus, pin, reason)
            toast.success(nextStatus === 'archived' ? 'Article archivé et audité.' : 'Article réactivé et audité.')
            setStatusModalOpen(false)
            await loadArticle()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Modification impossible')
          } finally {
            setSavingStatus(false)
          }
        }}
      />
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
