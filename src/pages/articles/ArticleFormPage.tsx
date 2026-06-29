import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createArticle, getArticle, listFamilies, listLocations, listUnits, updateArticle } from '../../api/modules/catalog.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import { articleSchema } from '../../lib/catalog'
import type { ArticleFormValues, Family, Location, Unit } from '../../lib/catalog'
import type { Supplier } from '../../lib/suppliers'
import type { ReactNode } from 'react'

export function ArticleFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [families, setFamilies] = useState<Family[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(isEdit)

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
      status: 'active',
      location_ids: [],
    },
  })
  const selectedSupplier = useWatch({ control: form.control, name: 'default_supplier' })

  useEffect(() => {
    Promise.all([listFamilies(), listUnits(), listLocations(), listSuppliers()])
      .then(([loadedFamilies, loadedUnits, loadedLocations, loadedSuppliers]) => {
        setFamilies(loadedFamilies)
        setUnits(loadedUnits)
        setLocations(loadedLocations)
        setSuppliers(loadedSuppliers)
        const defaultLocation = loadedLocations.find((location) => location.is_magasin_general)
        if (!isEdit && defaultLocation) {
          form.setValue('location_ids', [defaultLocation.id])
        }
      })
      .catch(() => toast.error('Une erreur est survenue. Veuillez reessayer.'))
  }, [form, isEdit])

  useEffect(() => {
    if (!id) {
      return
    }

    setLoading(true)
    getArticle(id)
      .then((article) => {
        form.reset({
          name: article.name,
          family_id: article.family_id,
          sub_family: article.sub_family ?? '',
          unit_id: article.unit_id,
          packaging: article.packaging ?? '',
          default_supplier: article.default_supplier ?? '',
          min_stock: Number(article.min_stock ?? 0),
          status: article.status,
          location_ids: article.article_locations?.map((item) => item.locations.id) ?? [],
        })
      })
      .catch(() => toast.error('Article introuvable'))
      .finally(() => setLoading(false))
  }, [form, id])

  const onSubmit = async (values: ArticleFormValues) => {
    try {
      if (id) {
        await updateArticle(id, values, profile?.id)
        toast.success('Article mis a jour avec succes')
        navigate(`/articles/${id}`)
      } else {
        await createArticle(values, profile?.id)
        toast.success('Article cree avec succes')
        navigate('/articles')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  if (loading) {
    return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Catalogue</p>
        <h1 className="page-title mt-2">{isEdit ? "Modifier l'article" : 'Nouvel article'}</h1>
      </header>

      <form onSubmit={form.handleSubmit(onSubmit)} className="surface p-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="Nom normalise" error={form.formState.errors.name?.message}>
            <input {...form.register('name')} className="input mt-2" />
          </Field>
          <Field label="Famille" error={form.formState.errors.family_id?.message}>
            <select {...form.register('family_id')} className="input mt-2">
              <option value="">Selectionner</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>{family.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Sous-famille">
            <input {...form.register('sub_family')} className="input mt-2" />
          </Field>
          <Field label="Unite de gestion" error={form.formState.errors.unit_id?.message}>
            <select {...form.register('unit_id')} className="input mt-2">
              <option value="">Selectionner</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>
              ))}
            </select>
          </Field>
          <Field label="Conditionnement">
            <input {...form.register('packaging')} className="input mt-2" placeholder="12 bouteilles, sac de 25kg..." />
          </Field>
          <Field label="Fournisseur habituel">
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
            <input {...form.register('min_stock', { valueAsNumber: true })} type="number" step="0.01" min="0" className="input mt-2" />
          </Field>
          <Field label="Statut">
            <select {...form.register('status')} className="input mt-2">
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="archived">Archive</option>
            </select>
          </Field>
        </div>

        <div className="mt-6">
          <p className="field-label">Localisations autorisees</p>
          {form.formState.errors.location_ids?.message && <span className="mt-2 block text-sm text-red-600">{form.formState.errors.location_ids.message}</span>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((location) => (
              <label key={location.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                <input type="checkbox" value={location.id} {...form.register('location_ids')} className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A]" />
                {location.name}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={form.formState.isSubmitting} className="btn-primary">
            <Save className="mr-2 h-4 w-4" />
            {isEdit ? 'Mettre a jour' : 'Creer'}
          </button>
          <Link to={isEdit && id ? `/articles/${id}` : '/articles'} className="btn-secondary">
            Annuler
          </Link>
        </div>
      </form>
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
