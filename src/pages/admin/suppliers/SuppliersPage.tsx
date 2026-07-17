import { zodResolver } from '@hookform/resolvers/zod'
import { Edit2, Plus, Search, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier } from '../../../api/modules/suppliers.api'
import { useAuth } from '../../../hooks/useAuth'
import { invoiceTaxModeLabels, invoiceTaxModes, supplierTaxStatusLabels, supplierTaxStatuses } from '../../../lib/materialCosts'
import { canManageSuppliers, supplierSchema } from '../../../lib/suppliers'
import type { Supplier, SupplierFormValues } from '../../../lib/suppliers'

const supplierGridClass =
  'grid min-w-[1500px] grid-cols-[1.2fr_150px_130px_130px_170px_140px_170px_180px_1.2fr_110px] items-center gap-3'

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
      supplier_tax_status: 'unknown',
      is_identified: false,
      usually_issues_vat_invoice: false,
      default_vat_rate: 20,
      default_vat_recoverable: true,
      default_invoice_tax_mode: 'invoice_with_recoverable_vat',
      is_usual_without_nif_stat: false,
      default_declared_extra_tax_enabled: false,
      default_declared_extra_tax_rate: 0,
      occasional_purchase_alert_threshold: 1000000,
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
      supplier_tax_status: supplier.supplier_tax_status ?? 'unknown',
      is_identified: Boolean(supplier.is_identified),
      usually_issues_vat_invoice: Boolean(supplier.usually_issues_vat_invoice),
      default_vat_rate: Number(supplier.default_vat_rate ?? 20),
      default_vat_recoverable: supplier.default_vat_recoverable ?? true,
      default_invoice_tax_mode: supplier.default_invoice_tax_mode ?? 'invoice_with_recoverable_vat',
      is_usual_without_nif_stat: Boolean(supplier.is_usual_without_nif_stat),
      default_declared_extra_tax_enabled: Boolean(supplier.default_declared_extra_tax_enabled),
      default_declared_extra_tax_rate: Number(supplier.default_declared_extra_tax_rate ?? 0),
      occasional_purchase_alert_threshold: Number(supplier.occasional_purchase_alert_threshold ?? 1000000),
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
      supplier_tax_status: 'unknown',
      is_identified: false,
      usually_issues_vat_invoice: false,
      default_vat_rate: 20,
      default_vat_recoverable: true,
      default_invoice_tax_mode: 'invoice_with_recoverable_vat',
      is_usual_without_nif_stat: false,
      default_declared_extra_tax_enabled: false,
      default_declared_extra_tax_rate: 0,
      occasional_purchase_alert_threshold: 1000000,
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
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold text-slate-950">Profil fiscal habituel</p>
                <p className="mt-1 text-sm text-slate-600">Ces valeurs servent de proposition par defaut. Le justificatif reel reste verifie dans l'achat, la reception ou la facture.</p>
                <div className="mt-4 grid gap-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" {...form.register('is_identified')} className="h-4 w-4" />
                    Fournisseur identifie
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" {...form.register('usually_issues_vat_invoice')} className="h-4 w-4" />
                    Emet habituellement des factures avec TVA
                  </label>
                  <Field label="Statut fiscal habituel">
                    <select {...form.register('supplier_tax_status')} className="input mt-2">
                      {supplierTaxStatuses.map((status) => <option key={status} value={status}>{supplierTaxStatusLabels[status]}</option>)}
                    </select>
                  </Field>
                  <Field label="Mode fiscal propose">
                    <select {...form.register('default_invoice_tax_mode')} className="input mt-2">
                      {invoiceTaxModes.map((mode) => <option key={mode} value={mode}>{invoiceTaxModeLabels[mode]}</option>)}
                    </select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Taux TVA habituel">
                      <input type="number" step="0.01" {...form.register('default_vat_rate', { valueAsNumber: true })} className="input mt-2" />
                    </Field>
                    <Field label="Charge declarative par defaut %">
                      <input type="number" step="0.01" {...form.register('default_declared_extra_tax_rate', { valueAsNumber: true })} className="input mt-2" />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" {...form.register('default_vat_recoverable')} className="h-4 w-4" />
                    TVA recuperable par defaut
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" {...form.register('is_usual_without_nif_stat')} className="h-4 w-4" />
                    Fournisseur habituel sans NIF/STAT
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" {...form.register('default_declared_extra_tax_enabled')} className="h-4 w-4" />
                    Proposer une charge declarative par defaut
                  </label>
                  <Field label="Seuil alerte achat occasionnel sans NIF/STAT">
                    <input type="number" {...form.register('occasional_purchase_alert_threshold', { valueAsNumber: true })} className="input mt-2" />
                  </Field>
                </div>
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
              <span>Profil fiscal</span>
              <span>TVA</span>
              <span>Charge declarative</span>
              <span>Telephone</span>
              <span>Email</span>
              <span>Actions</span>
            </div>

            {loading ? (
              <p className="min-w-[1500px] p-5 text-sm text-slate-600">Chargement...</p>
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
                    <p className="text-sm text-slate-700">{supplierTaxStatusLabels[supplier.supplier_tax_status ?? 'unknown']}</p>
                    <p className="text-sm text-slate-700">{supplier.usually_issues_vat_invoice ? `${Number(supplier.default_vat_rate ?? 20).toLocaleString('fr-FR')} %` : '-'}</p>
                    <p className="text-sm text-slate-700">{supplier.default_declared_extra_tax_enabled ? `${Number(supplier.default_declared_extra_tax_rate ?? 0).toLocaleString('fr-FR')} %` : '-'}</p>
                    <p className="text-sm text-slate-700">{supplier.phone || '-'}</p>
                    <p className="truncate text-sm text-slate-700">{supplier.email || '-'}</p>
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
                {suppliers.length === 0 && <p className="min-w-[1500px] p-5 text-sm text-slate-600">Aucun fournisseur trouve.</p>}
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
