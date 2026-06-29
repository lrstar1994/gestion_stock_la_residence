import { zodResolver } from '@hookform/resolvers/zod'
import { Edit2, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { createLocation, deleteLocation, listLocations, updateLocation } from '../../../api/modules/catalog.api'
import { useAuth } from '../../../hooks/useAuth'
import { locationSchema } from '../../../lib/catalog'
import type { Location, LocationFormValues } from '../../../lib/catalog'

export function LocationsPage() {
  const { profile } = useAuth()
  const [locations, setLocations] = useState<Location[]>([])
  const [search, setSearch] = useState('')
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(true)
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { name: '', description: '', is_magasin_general: false },
  })

  const loadLocations = useCallback(async () => {
    setLoading(true)
    try {
      setLocations(await listLocations(search))
    } catch {
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  const startEdit = (location: Location) => {
    setEditingLocation(location)
    form.reset({
      name: location.name,
      description: location.description ?? '',
      is_magasin_general: location.is_magasin_general,
    })
  }

  const resetForm = () => {
    setEditingLocation(null)
    form.reset({ name: '', description: '', is_magasin_general: false })
  }

  const onSubmit = async (values: LocationFormValues) => {
    try {
      if (editingLocation) {
        await updateLocation(editingLocation.id, values)
        toast.success('Localisation mise a jour avec succes')
      } else {
        await createLocation(values, profile?.id)
        toast.success('Localisation creee avec succes')
      }
      resetForm()
      await loadLocations()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const handleDelete = async (location: Location) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette localisation ?')) {
      return
    }

    try {
      await deleteLocation(location.id)
      toast.success('Localisation supprimee avec succes')
      await loadLocations()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Direction</p>
        <h1 className="page-title mt-2">Localisations</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gere les emplacements autorises pour les articles.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={form.handleSubmit(onSubmit)} className="surface h-fit p-5">
          <h2 className="text-lg font-bold text-slate-900">
            {editingLocation ? 'Modifier une localisation' : 'Creer une localisation'}
          </h2>

          <label className="mt-5 block">
            <span className="field-label">Nom</span>
            <input {...form.register('name')} className="input mt-2" />
            {form.formState.errors.name?.message && <span className="mt-2 block text-sm text-red-600">{form.formState.errors.name.message}</span>}
          </label>

          <label className="mt-4 block">
            <span className="field-label">Description</span>
            <textarea {...form.register('description')} className="input mt-2 min-h-24 resize-none" />
          </label>

          <label className="mt-4 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" {...form.register('is_magasin_general')} className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A]" />
            Magasin general par defaut
          </label>

          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={form.formState.isSubmitting} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              {editingLocation ? 'Mettre a jour' : 'Creer'}
            </button>
            {editingLocation && (
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
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-9" placeholder="Rechercher une localisation" />
            </label>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-slate-600">Chargement...</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {locations.map((location) => (
                <article key={location.id} className="grid gap-3 p-4 md:grid-cols-[1fr_130px_130px_110px] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{location.name}</p>
                      {location.is_magasin_general && (
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#1E3A8A]">
                          Par defaut
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{location.description || 'Aucune description'}</p>
                  </div>
                  <p className="text-sm text-slate-600">{new Date(location.created_at).toLocaleDateString('fr-FR')}</p>
                  <p className="text-sm font-semibold text-[#1E3A8A]">{location.articles_count ?? 0} article(s)</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(location)} className="btn-secondary px-3 py-2" aria-label="Modifier">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(location)} className="btn-secondary px-3 py-2 text-red-700" aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
              {locations.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune localisation trouvee.</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
