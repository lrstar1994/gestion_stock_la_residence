import { zodResolver } from '@hookform/resolvers/zod'
import { Edit2, Plus, Search, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier } from '../../../api/modules/suppliers.api'
import { useAuth } from '../../../hooks/useAuth'
import { canManageSuppliers, supplierSchema } from '../../../lib/suppliers'
import type { Supplier, SupplierFormValues } from '../../../lib/suppliers'

const supplierGridClass =
  'grid min-w-[1180px] grid-cols-[1.2fr_150px_130px_130px_140px_220px_1.4fr_110px] items-center gap-3'

export function SuppliersPage() {
  const { profile } = useAuth()
  const canEdit = canManageSuppliers(profile?.role)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      contact: '',
      phone: '',
      email: '',
      nif: '',
      stat: '',
      address: '',
      notes: '',
    },
  })

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      setSuppliers(await listSuppliers(search))
    } catch {
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  const startEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    form.reset({
      name: supplier.name,
      contact: supplier.contact ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      nif: supplier.nif ?? '',
      stat: supplier.stat ?? '',
      address: supplier.address ?? '',
      notes: supplier.notes ?? '',
    })
  }

  const resetForm = () => {
    setEditingSupplier(null)
    form.reset({
      name: '',
      contact: '',
      phone: '',
      email: '',
      nif: '',
      stat: '',
      address: '',
      notes: '',
    })
  }

  const onSubmit = async (values: SupplierFormValues) => {
    if (!canEdit) {
      return
    }

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, values, profile?.id)
        toast.success('Fournisseur mis a jour avec succes')
      } else {
        await createSupplier(values, profile?.id)
        toast.success('Fournisseur cree avec succes')
      }
      resetForm()
      await loadSuppliers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const handleDelete = async (supplier: Supplier) => {
    if (!canEdit) {
      return
    }

    if (!window.confirm('Voulez-vous vraiment supprimer ce fournisseur ?')) {
      return
    }

    try {
      await deleteSupplier(supplier.id)
      toast.success('Fournisseur supprime avec succes')
      await loadSuppliers()
    } catch {
      toast.error('Ce fournisseur est utilise par des commandes et ne peut pas etre supprime')
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Achats</p>
        <h1 className="page-title mt-2">Fournisseurs</h1>
        <p className="mt-2 text-sm text-slate-600">
          Centralise les contacts, coordonnees et notes des fournisseurs.
        </p>
      </header>

      <section className={`grid gap-4 ${canEdit ? 'lg:grid-cols-[420px_1fr]' : ''}`}>
        {canEdit && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="surface h-fit p-5">
            <h2 className="text-lg font-bold text-slate-900">
              {editingSupplier ? 'Modifier un fournisseur' : 'Creer un fournisseur'}
            </h2>

            <div className="mt-5 grid gap-4">
              <Field label="Nom" error={form.formState.errors.name?.message}>
                <input {...form.register('name')} className="input mt-2" />
              </Field>
              <Field label="Contact">
                <input {...form.register('contact')} className="input mt-2" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telephone">
                  <input {...form.register('phone')} className="input mt-2" />
                </Field>
                <Field label="Email" error={form.formState.errors.email?.message}>
                  <input {...form.register('email')} type="email" className="input mt-2" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="NIF">
                  <input {...form.register('nif')} className="input mt-2" />
                </Field>
                <Field label="STAT">
                  <input {...form.register('stat')} className="input mt-2" />
                </Field>
              </div>
              <Field label="Adresse">
                <textarea {...form.register('address')} className="input mt-2 min-h-20 resize-none" />
              </Field>
              <Field label="Notes">
                <textarea {...form.register('notes')} className="input mt-2 min-h-24 resize-none" />
              </Field>
            </div>

            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={form.formState.isSubmitting} className="btn-primary">
                <Plus className="mr-2 h-4 w-4" />
                {editingSupplier ? 'Mettre a jour' : 'Creer'}
              </button>
              {editingSupplier && (
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Annuler
                </button>
              )}
            </div>
          </form>
        )}

        <div className="surface overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-9"
                placeholder="Rechercher nom, NIF ou STAT"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <div className={`${supplierGridClass} border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500`}>
              <span>Fournisseur</span>
              <span>Contact</span>
              <span>NIF</span>
              <span>STAT</span>
              <span>Telephone</span>
              <span>Email</span>
              <span>Adresse</span>
              <span>Actions</span>
            </div>

            {loading ? (
              <p className="min-w-[1180px] p-5 text-sm text-slate-600">Chargement...</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {suppliers.map((supplier) => (
                  <article key={supplier.id} className={`${supplierGridClass} px-4 py-4`}>
                    <div>
                      <p className="font-semibold text-slate-950">{supplier.name}</p>
                      {supplier.notes && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{supplier.notes}</p>}
                    </div>
                    <p className="text-sm text-slate-700">{supplier.contact || '-'}</p>
                    <p className="text-sm text-slate-700">{supplier.nif || '-'}</p>
                    <p className="text-sm text-slate-700">{supplier.stat || '-'}</p>
                    <p className="text-sm text-slate-700">{supplier.phone || '-'}</p>
                    <p className="truncate text-sm text-slate-700">{supplier.email || '-'}</p>
                    <p className="line-clamp-2 text-sm text-slate-700">{supplier.address || '-'}</p>
                    {canEdit ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(supplier)} className="btn-secondary px-3 py-2" aria-label="Modifier">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(supplier)} className="btn-secondary px-3 py-2 text-red-700" aria-label="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span />
                    )}
                  </article>
                ))}
                {suppliers.length === 0 && <p className="min-w-[1180px] p-5 text-sm text-slate-600">Aucun fournisseur trouve.</p>}
              </div>
            )}
          </div>
        </div>
      </section>
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
