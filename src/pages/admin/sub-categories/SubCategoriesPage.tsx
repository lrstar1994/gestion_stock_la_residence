import { zodResolver } from '@hookform/resolvers/zod'
import { Edit2, Plus, Search, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { createSubCategory, deleteSubCategory, listFamilies, listSubCategories, setReferentialActive, updateSubCategory } from '../../../api/modules/catalog.api'
import { getMyPinStatus } from '../../../api/modules/sensitiveActions.api'
import { SensitiveActionModal } from '../../../components/SensitiveActionModal'
import { useAuth } from '../../../hooks/useAuth'
import { subCategorySchema } from '../../../lib/catalog'
import type { Family, SubCategory, SubCategoryFormValues } from '../../../lib/catalog'

export function SubCategoriesPage() {
  const { profile } = useAuth()
  const [families, setFamilies] = useState<Family[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [search, setSearch] = useState('')
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [pinDefined, setPinDefined] = useState(false)
  const [subCategoryToDelete, setSubCategoryToDelete] = useState<SubCategory | null>(null)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<SubCategoryFormValues>({
    resolver: zodResolver(subCategorySchema),
    defaultValues: {
      family_id: '',
      name: '',
    },
  })

  const loadSubCategories = useCallback(async () => {
    setLoading(true)
    try {
      setSubCategories(await listSubCategories(undefined, search, true))
    } catch {
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    listFamilies('', true)
      .then(setFamilies)
      .catch(() => toast.error('Impossible de charger les categories.'))
  }, [])

  useEffect(() => {
    loadSubCategories()
  }, [loadSubCategories])

  useEffect(() => {
    getMyPinStatus().then((status) => setPinDefined(status.pin_defined)).catch(() => setPinDefined(false))
  }, [])

  const startEdit = (subCategory: SubCategory) => {
    setEditingSubCategory(subCategory)
    form.reset({
      family_id: subCategory.family_id,
      name: subCategory.name,
    })
  }

  const resetForm = () => {
    setEditingSubCategory(null)
    form.reset({
      family_id: '',
      name: '',
    })
  }

  const onSubmit = async (values: SubCategoryFormValues) => {
    try {
      if (editingSubCategory) {
        await updateSubCategory(editingSubCategory.id, values)
        toast.success('Sous-categorie mise a jour avec succes')
      } else {
        await createSubCategory(values, profile?.id)
        toast.success('Sous-categorie creee avec succes')
      }
      resetForm()
      await loadSubCategories()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const handleDelete = (subCategory: SubCategory) => setSubCategoryToDelete(subCategory)

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Catalogue</p>
        <h1 className="page-title mt-2">Sous-categories</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gere les sous-categories disponibles selon chaque categorie d'article.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <form onSubmit={form.handleSubmit(onSubmit)} className="surface h-fit p-5">
          <h2 className="text-lg font-bold text-slate-900">
            {editingSubCategory ? 'Modifier une sous-categorie' : 'Creer une sous-categorie'}
          </h2>

          <div className="mt-5 grid gap-4">
            <Field label="Categorie" error={form.formState.errors.family_id?.message}>
              <select {...form.register('family_id')} className="input mt-2">
                <option value="">Selectionner</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>{family.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Sous-categorie" error={form.formState.errors.name?.message}>
              <input {...form.register('name')} className="input mt-2" />
            </Field>
          </div>

          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={form.formState.isSubmitting} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              {editingSubCategory ? 'Mettre a jour' : 'Creer'}
            </button>
            {editingSubCategory && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Annuler
              </button>
            )}
          </div>
        </form>

        <div className="surface overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-9"
                placeholder="Rechercher une sous-categorie"
              />
            </label>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-slate-600">Chargement...</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {subCategories.map((subCategory) => (
                <article key={subCategory.id} className="grid gap-3 p-4 xl:grid-cols-[1fr_1fr_110px_110px] xl:items-center">
                  <p className="text-sm font-semibold text-slate-700">{subCategory.families?.name || '-'}</p>
                  <p className="font-semibold text-slate-950">{subCategory.name}</p>
                  <p className="text-sm text-slate-700">{subCategory.articles_count ?? 0} article(s)</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(subCategory)} className="btn-secondary px-3 py-2" aria-label="Modifier">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(subCategory)} className="btn-secondary px-3 py-2 text-red-700" aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
              {subCategories.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune sous-categorie trouvee.</p>}
            </div>
          )}
        </div>
      </section>
      <SensitiveActionModal
        open={Boolean(subCategoryToDelete)}
        title={subCategoryToDelete?.is_active === false ? 'Réactiver la sous-catégorie' : (subCategoryToDelete?.articles_count ?? 0) > 0 ? 'Désactiver la sous-catégorie utilisée' : 'Supprimer une sous-catégorie inutilisée'}
        description={(subCategoryToDelete?.articles_count ?? 0) > 0 ? 'La sous-catégorie reste dans l’historique.' : 'La suppression physique est refusée dès qu’un article l’utilise.'}
        permissionLabel={subCategoryToDelete?.is_active === false ? 'referentials.reactivate' : (subCategoryToDelete?.articles_count ?? 0) > 0 ? 'referentials.deactivate' : 'referentials.delete_unused'}
        pinDefined={pinDefined}
        requireReason
        busy={deleting}
        onCancel={() => setSubCategoryToDelete(null)}
        onConfirm={async ({ pin, reason }) => {
          if (!subCategoryToDelete) return
          setDeleting(true)
          try {
            if (subCategoryToDelete.is_active === false) {
              await setReferentialActive('sub_category', subCategoryToDelete.id, true, pin, reason)
              toast.success('Sous-catégorie réactivée et auditée.')
            } else if ((subCategoryToDelete.articles_count ?? 0) > 0) {
              await setReferentialActive('sub_category', subCategoryToDelete.id, false, pin, reason)
              toast.success('Sous-catégorie désactivée et auditée.')
            } else {
              await deleteSubCategory(subCategoryToDelete.id, pin, reason)
              toast.success('Sous-catégorie supprimée et auditée.')
            }
            setSubCategoryToDelete(null)
            await loadSubCategories()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Suppression impossible')
          } finally {
            setDeleting(false)
          }
        }}
      />
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="mt-2 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
