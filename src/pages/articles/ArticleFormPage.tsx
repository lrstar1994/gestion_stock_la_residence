import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createArticle, getArticle, listArticleEditorFamilies, listArticleEditorSubCategories, listArticleEditorUnits, listLocations, updateArticle, updateArticleSensitive } from '../../api/modules/catalog.api'
import { getMyPinStatus } from '../../api/modules/sensitiveActions.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { SensitiveActionModal } from '../../components/SensitiveActionModal'
import { useAuth } from '../../hooks/useAuth'
import { articleNatureLabels, articleNatures, articleSchema } from '../../lib/catalog'
import type { ArticleFormValues, Family, Location, SubCategory, Unit } from '../../lib/catalog'
import type { Supplier } from '../../lib/suppliers'
import type { ReactNode } from 'react'

function describeReferenceLoadError(error: unknown) {
  if (typeof error !== 'object' || error === null) return String(error)
  const details = error as { code?: string; message?: string; details?: string; hint?: string }
  return [details.code ? `(${details.code})` : '', details.message ?? 'Erreur inconnue', details.details, details.hint]
    .filter(Boolean)
    .join(' — ')
}

function loadNamedReference<T>(label: string, load: () => Promise<T>) {
  return load().catch((error: unknown) => {
    throw new Error(`${label} : ${describeReferenceLoadError(error)}`)
  })
}

export function ArticleFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [families, setFamilies] = useState<Family[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pinDefined, setPinDefined] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<ArticleFormValues | null>(null)
  const [originalSensitiveValues, setOriginalSensitiveValues] = useState<{ unit_id: string; stockable: boolean; status: ArticleFormValues['status'] } | null>(null)

  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      name: '',
      family_id: '',
      sub_family: '',
      unit_id: '',
      packaging: '',
      default_supplier: '',
      min_stock: 0,
      sellable_without_transformation: false,
      usable_in_recipes: false,
      nature: 'autre',
      stockable: true,
      locations_restricted: false,
      durable_equipment: false,
      indicative_price: null,
      indicative_price_note: '',
      status: 'active',
      location_ids: [],
    },
  })
  const selectedSupplier = useWatch({ control: form.control, name: 'default_supplier' })
  const selectedFamilyId = useWatch({ control: form.control, name: 'family_id' })
  const selectedSubCategory = useWatch({ control: form.control, name: 'sub_family' })
  const selectedLocations = useWatch({ control: form.control, name: 'location_ids' })
  const stockable = useWatch({ control: form.control, name: 'stockable' })
  const locationsRestricted = useWatch({ control: form.control, name: 'locations_restricted' })
  const filteredSubCategories = subCategories.filter((subCategory) => subCategory.family_id === selectedFamilyId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    Promise.all([
      loadNamedReference('Familles', () => listArticleEditorFamilies(isEdit)),
      loadNamedReference('Sous-catégories', () => listArticleEditorSubCategories(isEdit)),
      loadNamedReference('Unités', () => listArticleEditorUnits(isEdit)),
      loadNamedReference('Localisations', () => listLocations('', isEdit)),
      loadNamedReference('Fournisseurs', () => listSuppliers()),
      id ? loadNamedReference('Fiche article', () => getArticle(id)) : Promise.resolve(null),
    ])
      .then(([loadedFamilies, loadedSubCategories, loadedUnits, loadedLocations, loadedSuppliers, article]) => {
        if (cancelled) return
        setFamilies(loadedFamilies)
        setSubCategories(loadedSubCategories)
        setUnits(loadedUnits)
        setLocations(loadedLocations)
        setSuppliers(loadedSuppliers)
        if (article) {
          setOriginalSensitiveValues({ unit_id: article.unit_id, stockable: article.stockable ?? true, status: article.status })
          form.reset({
            name: article.name,
            family_id: article.family_id,
            sub_family: article.sub_family ?? '',
            unit_id: article.unit_id,
            packaging: article.packaging ?? '',
            default_supplier: article.default_supplier ?? '',
            min_stock: Number(article.min_stock ?? 0),
            sellable_without_transformation: Boolean(article.sellable_without_transformation),
            usable_in_recipes: Boolean(article.usable_in_recipes),
            nature: article.nature ?? 'autre',
            stockable: article.stockable ?? true,
            locations_restricted: Boolean(article.locations_restricted),
            durable_equipment: Boolean(article.durable_equipment),
            indicative_price: article.indicative_price === null ? null : Number(article.indicative_price),
            indicative_price_note: article.indicative_price_note ?? '',
            status: article.status,
            location_ids: article.locations_restricted ? article.article_locations?.map((item) => item.locations.id) ?? [] : [],
          })
        }
      })
      .catch((error) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Impossible de charger toutes les données de l’article.'
        setLoadError(message)
        toast.error(message)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [form, id, isEdit])

  useEffect(() => {
    if (profile?.status === 'active') {
      getMyPinStatus().then((status) => setPinDefined(status.pin_defined)).catch(() => setPinDefined(false))
    }
  }, [profile?.status])

  const onSubmit = async (values: ArticleFormValues) => {
    const sensitiveChange = Boolean(id && originalSensitiveValues && (
      values.unit_id !== originalSensitiveValues.unit_id
      || values.stockable !== originalSensitiveValues.stockable
      || values.status !== originalSensitiveValues.status
    ))
    if (sensitiveChange) {
      setPendingValues(values)
      setPinOpen(true)
      return
    }
    await save(values)
  }

  const save = async (values: ArticleFormValues, pin?: string, reason?: string) => {
    try {
      if (id) {
        if (pin) {
          await updateArticleSensitive(id, values, pin, reason ?? '')
        } else {
          await updateArticle(id, values, profile?.id)
        }
        toast.success('Article mis à jour avec succès')
        navigate(`/articles/${id}`)
      } else {
        await createArticle(values, profile?.id)
        toast.success('Article créé avec succès')
        navigate('/articles')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  if (loading) {
    return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>
  }
  if (loadError) {
    return <div className="surface border border-red-200 p-6 text-sm text-red-800">Impossible de préparer la fiche sans perdre les données existantes : {loadError}</div>
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Catalogue</p>
        <h1 className="page-title mt-2">{isEdit ? "Modifier l'article" : 'Nouvel article'}</h1>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="surface p-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="Nom normalisé" error={form.formState.errors.name?.message}>
            <input {...form.register('name')} className="input mt-2" />
          </Field>
          <Field label="Catégorie" error={form.formState.errors.family_id?.message}>
            <select
              {...form.register('family_id')}
              onChange={(event) => {
                form.setValue('family_id', event.target.value)
                form.setValue('sub_family', '')
              }}
              className="input mt-2"
            >
              <option value="">Sélectionner</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>{family.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Sous-catégorie">
            <select {...form.register('sub_family')} disabled={!selectedFamilyId} className="input mt-2 disabled:cursor-not-allowed disabled:bg-slate-100">
              <option value="">{selectedFamilyId ? 'Sélectionner' : 'Sélectionnez une catégorie'}</option>
              {selectedSubCategory && !filteredSubCategories.some((subCategory) => subCategory.name === selectedSubCategory) && (
                <option value={selectedSubCategory}>{selectedSubCategory}</option>
              )}
              {filteredSubCategories.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.name}>{subCategory.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Unité stock de référence" error={form.formState.errors.unit_id?.message}>
            <select {...form.register('unit_id')} className="input mt-2">
              <option value="">Sélectionner</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>
              ))}
            </select>
          </Field>
          <Field label="Conditionnement">
            <input {...form.register('packaging')} className="input mt-2" placeholder="12 bouteilles, sac de 25kg..." />
          </Field>
          <Field label="Fournisseur principal">
            <select {...form.register('default_supplier')} className="input mt-2">
              <option value="">Aucun fournisseur</option>
              {selectedSupplier && !suppliers.some((supplier) => supplier.name === selectedSupplier) && (
                <option value={selectedSupplier}>{selectedSupplier}</option>
              )}
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.name}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stock minimum" error={form.formState.errors.min_stock?.message}>
            <input {...form.register('min_stock', { valueAsNumber: true })} disabled={!stockable} type="number" step="0.01" min="0" className="input mt-2 disabled:bg-slate-100" />
          </Field>
          <Field label="Nature de l’article">
            <select {...form.register('nature')} className="input mt-2">
              {articleNatures.map((nature) => <option key={nature} value={nature}>{articleNatureLabels[nature]}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" {...form.register('stockable')} className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A]" />
            Article stockable
          </label>
          <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" {...form.register('durable_equipment')} className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A]" />
            Immobilisation / équipement durable
          </label>
          <Field label="Prix indicatif (hors historique officiel)">
            <input {...form.register('indicative_price', { setValueAs: (value) => value === '' ? null : Number(value) })} type="number" min="0" step="0.01" className="input mt-2" />
          </Field>
          <Field label="Note du prix indicatif">
            <input {...form.register('indicative_price_note')} className="input mt-2" placeholder="Source ou contexte du prix" />
          </Field>
          <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" {...form.register('sellable_without_transformation')} className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A]" />
            À vendre sans transformation
          </label>
          <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" {...form.register('usable_in_recipes')} className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A]" />
            Utilisable en fiche technique
          </label>
          <Field label="Statut">
            <select {...form.register('status')} className="input mt-2">
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="archived">Archivé</option>
            </select>
          </Field>
        </div>

        <div className="mt-6">
          {stockable && <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
              <input type="radio" name="article-location-mode" value="all" checked={!locationsRestricted} onChange={() => {
                form.setValue('locations_restricted', false, { shouldDirty: true, shouldValidate: true })
                form.setValue('location_ids', [], { shouldDirty: true })
              }} className="mt-0.5 h-4 w-4 border-slate-300 text-[#1E3A8A]" />
              <span><span className="block">Toutes les localisations actives</span><span className="mt-1 block text-xs font-normal text-slate-600">Valeur par défaut. Autoriser une localisation ne crée aucun stock.</span></span>
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <input type="radio" name="article-location-mode" value="restricted" checked={locationsRestricted} onChange={() => {
                form.setValue('locations_restricted', true, { shouldDirty: true, shouldValidate: true })
              }} className="h-4 w-4 border-slate-300 text-[#1E3A8A]" />
              Restreindre à certaines localisations
            </label>
            {locationsRestricted && <>
              {form.formState.errors.location_ids?.message && <span className="block text-sm text-red-600">{form.formState.errors.location_ids.message}</span>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {locations.map((location) => {
                  const isSelected = selectedLocations.includes(location.id)
                  const isInactive = location.is_active === false
                  return <label key={location.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" value={location.id} disabled={isInactive && !isSelected} {...form.register('location_ids')} className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A]" />
                    {location.name}{isInactive ? ' (inactive — sélection existante)' : ''}
                  </label>
                })}
              </div>
            </>}
          </div>}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={form.formState.isSubmitting} className="btn-primary">
            <Save className="mr-2 h-4 w-4" />
            {isEdit ? 'Mettre à jour' : 'Créer'}
          </button>
          <Link to={isEdit && id ? `/articles/${id}` : '/articles'} className="btn-secondary">
            Annuler
          </Link>
        </div>
      </form>
      <SensitiveActionModal
        open={pinOpen}
        title="Valider la modification sensible"
        description="Le changement d’unité stock ou du caractère stockable peut modifier l’interprétation du stock et des conversions."
        permissionLabel="items.sensitive_update.validate"
        pinDefined={pinDefined}
        requireReason
        busy={form.formState.isSubmitting}
        onCancel={() => {
          setPinOpen(false)
          setPendingValues(null)
        }}
        onConfirm={async ({ pin, reason }) => {
          if (!pendingValues) return
          await save(pendingValues, pin, reason)
          setPendingValues(null)
          setPinOpen(false)
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
