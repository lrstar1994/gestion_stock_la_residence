import { zodResolver } from '@hookform/resolvers/zod'
import { Edit2, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { createUnit, deleteUnit, listUnits, updateUnit } from '../../../api/modules/catalog.api'
import { useAuth } from '../../../hooks/useAuth'
import { unitSchema } from '../../../lib/catalog'
import type { Unit, UnitFormValues } from '../../../lib/catalog'

export function UnitsPage() {
  const { profile } = useAuth()
  const [units, setUnits] = useState<Unit[]>([])
  const [search, setSearch] = useState('')
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [loading, setLoading] = useState(true)
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { name: '', abbreviation: '' },
  })

  const loadUnits = useCallback(async () => {
    setLoading(true)
    try {
      setUnits(await listUnits(search))
    } catch {
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadUnits()
  }, [loadUnits])

  const startEdit = (unit: Unit) => {
    setEditingUnit(unit)
    form.reset({ name: unit.name, abbreviation: unit.abbreviation })
  }

  const resetForm = () => {
    setEditingUnit(null)
    form.reset({ name: '', abbreviation: '' })
  }

  const onSubmit = async (values: UnitFormValues) => {
    try {
      if (editingUnit) {
        await updateUnit(editingUnit.id, values)
        toast.success('Unite mise a jour avec succes')
      } else {
        await createUnit(values, profile?.id)
        toast.success('Unite creee avec succes')
      }
      resetForm()
      await loadUnits()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const handleDelete = async (unit: Unit) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette unite ?')) {
      return
    }

    try {
      await deleteUnit(unit.id)
      toast.success('Unite supprimee avec succes')
      await loadUnits()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Direction</p>
        <h1 className="page-title mt-2">Unites</h1>
      </header>

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <form onSubmit={form.handleSubmit(onSubmit)} className="surface h-fit p-5">
          <h2 className="text-lg font-bold text-slate-900">{editingUnit ? 'Modifier une unite' : 'Creer une unite'}</h2>
          <label className="mt-5 block">
            <span className="field-label">Nom</span>
            <input {...form.register('name')} className="input mt-2" />
            {form.formState.errors.name?.message && <span className="mt-2 block text-sm text-red-600">{form.formState.errors.name.message}</span>}
          </label>
          <label className="mt-4 block">
            <span className="field-label">Abreviation</span>
            <input {...form.register('abbreviation')} className="input mt-2" />
            {form.formState.errors.abbreviation?.message && <span className="mt-2 block text-sm text-red-600">{form.formState.errors.abbreviation.message}</span>}
          </label>
          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={form.formState.isSubmitting} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />
              {editingUnit ? 'Mettre a jour' : 'Creer'}
            </button>
            {editingUnit && (
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
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-9" placeholder="Rechercher une unite" />
            </label>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-slate-600">Chargement...</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {units.map((unit) => (
                <article key={unit.id} className="grid gap-3 p-4 md:grid-cols-[1fr_140px_150px_110px] md:items-center">
                  <p className="font-semibold text-slate-950">{unit.name}</p>
                  <p className="w-fit rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#1E3A8A]">{unit.abbreviation}</p>
                  <p className="text-sm text-slate-600">{new Date(unit.created_at).toLocaleDateString('fr-FR')}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(unit)} className="btn-secondary px-3 py-2" aria-label="Modifier">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(unit)} className="btn-secondary px-3 py-2 text-red-700" aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
              {units.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune unite trouvee.</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
