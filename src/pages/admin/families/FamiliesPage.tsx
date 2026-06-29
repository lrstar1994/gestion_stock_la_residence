import { zodResolver } from '@hookform/resolvers/zod'
import { Edit2, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { createFamily, deleteFamily, listFamilies, updateFamily } from '../../../api/modules/catalog.api'
import { useAuth } from '../../../hooks/useAuth'
import { familySchema } from '../../../lib/catalog'
import type { Family, FamilyFormValues } from '../../../lib/catalog'

export function FamiliesPage() {
  const { profile } = useAuth()
  const [families, setFamilies] = useState<Family[]>([])
  const [search, setSearch] = useState('')
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [loading, setLoading] = useState(true)
  const form = useForm<FamilyFormValues>({
    resolver: zodResolver(familySchema),
    defaultValues: { name: '', description: '' },
  })

  const loadFamilies = useCallback(async () => {
    setLoading(true)
    try {
      setFamilies(await listFamilies(search))
    } catch {
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadFamilies()
  }, [loadFamilies])

  const startEdit = (family: Family) => {
    setEditingFamily(family)
    form.reset({ name: family.name, description: family.description ?? '' })
  }

  const resetForm = () => {
    setEditingFamily(null)
    form.reset({ name: '', description: '' })
  }

  const onSubmit = async (values: FamilyFormValues) => {
    try {
      if (editingFamily) {
        await updateFamily(editingFamily.id, values)
        toast.success('Famille mise a jour avec succes')
      } else {
        await createFamily(values, profile?.id)
        toast.success('Famille creee avec succes')
      }
      resetForm()
      await loadFamilies()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const handleDelete = async (family: Family) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette famille ?')) {
      return
    }

    try {
      await deleteFamily(family.id)
      toast.success('Famille supprimee avec succes')
      await loadFamilies()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Direction</p>
        <h1 className="page-title mt-2">Familles</h1>
      </header>

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={form.handleSubmit(onSubmit)} className="surface h-fit p-5">
          <h2 className="text-lg font-bold text-slate-900">{editingFamily ? 'Modifier une famille' : 'Creer une famille'}</h2>
          <label className="mt-5 block">
            <span className="field-label">Nom</span>
            <input {...form.register('name')} className="input mt-2" />
            {form.formState.errors.name?.message && <span className="mt-2 block text-sm text-red-600">{form.formState.errors.name.message}</span>}
          </label>
          <label className="mt-4 block">
            <span className="field-label">Description</span>
            <textarea {...form.register('description')} className="input mt-2 min-h-24 resize-none" />
          </label>
          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={form.formState.isSubmitting} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              {editingFamily ? 'Mettre a jour' : 'Creer'}
            </button>
            {editingFamily && (
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
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-9" placeholder="Rechercher une famille" />
            </label>
          </div>

          {loading ? (
            <p className="p-5 text-sm text-slate-600">Chargement...</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {families.map((family) => (
                <article key={family.id} className="grid gap-3 p-4 md:grid-cols-[1fr_150px_130px_110px] md:items-center">
                  <div>
                    <p className="font-semibold text-slate-950">{family.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{family.description || 'Aucune description'}</p>
                  </div>
                  <p className="text-sm text-slate-600">{new Date(family.created_at).toLocaleDateString('fr-FR')}</p>
                  <p className="text-sm font-semibold text-[#1E3A8A]">{family.articles_count ?? 0} article(s)</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(family)} className="btn-secondary px-3 py-2" aria-label="Modifier">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(family)} className="btn-secondary px-3 py-2 text-red-700" aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
              {families.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune famille trouvee.</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
