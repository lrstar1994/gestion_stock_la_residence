import { X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { createQuickSupplier } from '../../api/modules/suppliers.api'
import type { Supplier } from '../../lib/suppliers'
import {
  supplierBusinessTypeLabels,
  supplierBusinessTypes,
  supplierProvidedServiceLabels,
  supplierProvidedServiceTags,
  supplierUsageTypeLabels,
  supplierUsageTypes,
} from '../../lib/suppliers'
import type { QuickSupplierFormValues, SupplierProvidedServiceTag } from '../../lib/suppliers'

type Props = {
  open: boolean
  profileId?: string
  onClose: () => void
  onCreated: (supplier: Supplier) => void
  createSupplier?: (values: QuickSupplierFormValues) => Promise<Supplier>
}

const initialValues: QuickSupplierFormValues = {
  name: '',
  legal_name: '',
  business_type: 'a_verifier',
  usage_type: 'occasionnel',
  nif: '',
  stat: '',
  vat_status: 'unknown',
  fiscal_status: 'to_check',
  contact: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  payment_mode: '',
  payment_terms: '',
  aliases: '',
  provided_services: ['generaliste'],
}

export function QuickSupplierDrawer({ open, profileId, onClose, onCreated, createSupplier }: Props) {
  const [values, setValues] = useState<QuickSupplierFormValues>(initialValues)
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const toggleService = (tag: SupplierProvidedServiceTag) => {
    setValues((current) => ({
      ...current,
      provided_services: current.provided_services.includes(tag)
        ? current.provided_services.filter((item) => item !== tag)
        : [...current.provided_services, tag],
    }))
  }

  const save = async () => {
    if (!values.name.trim()) {
      toast.error('Nom commercial obligatoire')
      return
    }
    try {
      setSaving(true)
      const supplier = await (createSupplier ? createSupplier(values) : createQuickSupplier(values, profileId))
      toast.success(values.fiscal_status === 'to_check' ? 'Fournisseur provisoire cree' : 'Fournisseur cree')
      setValues(initialValues)
      onCreated(supplier)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de creer le fournisseur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40">
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <p className="eyebrow">Fournisseur</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Creation rapide fournisseur</h2>
            <p className="mt-1 text-sm text-slate-600">La saisie en cours reste conservee. Les informations manquantes pourront etre completees plus tard.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nom commercial">
              <input value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} className="input mt-2" />
            </Field>
            <Field label="Raison sociale si differente">
              <input value={values.legal_name} onChange={(event) => setValues((current) => ({ ...current, legal_name: event.target.value }))} className="input mt-2" />
            </Field>
            <Field label="Type">
              <select value={values.business_type} onChange={(event) => setValues((current) => ({ ...current, business_type: event.target.value as QuickSupplierFormValues['business_type'] }))} className="input mt-2">
                {supplierBusinessTypes.map((type) => <option key={type} value={type}>{supplierBusinessTypeLabels[type]}</option>)}
              </select>
            </Field>
            <Field label="Usage">
              <select value={values.usage_type} onChange={(event) => setValues((current) => ({ ...current, usage_type: event.target.value as QuickSupplierFormValues['usage_type'] }))} className="input mt-2">
                {supplierUsageTypes.map((type) => <option key={type} value={type}>{supplierUsageTypeLabels[type]}</option>)}
              </select>
            </Field>
            <Field label="NIF"><input value={values.nif} onChange={(event) => setValues((current) => ({ ...current, nif: event.target.value }))} className="input mt-2" /></Field>
            <Field label="STAT"><input value={values.stat} onChange={(event) => setValues((current) => ({ ...current, stat: event.target.value }))} className="input mt-2" /></Field>
            <Field label="Assujetti TVA">
              <select value={values.vat_status} onChange={(event) => setValues((current) => ({ ...current, vat_status: event.target.value as QuickSupplierFormValues['vat_status'] }))} className="input mt-2">
                <option value="unknown">A verifier</option>
                <option value="yes">Oui</option>
                <option value="no">Non</option>
              </select>
            </Field>
            <Field label="Statut fiche">
              <select value={values.fiscal_status} onChange={(event) => setValues((current) => ({ ...current, fiscal_status: event.target.value as QuickSupplierFormValues['fiscal_status'] }))} className="input mt-2">
                <option value="to_check">Provisoire / a completer</option>
                <option value="complete">Complet</option>
              </select>
            </Field>
          </div>

          {values.fiscal_status === 'to_check' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Fiche fournisseur a completer.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Contact principal"><input value={values.contact} onChange={(event) => setValues((current) => ({ ...current, contact: event.target.value }))} className="input mt-2" /></Field>
            <Field label="Telephone"><input value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} className="input mt-2" /></Field>
            <Field label="WhatsApp"><input value={values.whatsapp} onChange={(event) => setValues((current) => ({ ...current, whatsapp: event.target.value }))} className="input mt-2" /></Field>
            <Field label="Email"><input value={values.email} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} type="email" className="input mt-2" /></Field>
            <Field label="Adresse / quartier / marche"><input value={values.address} onChange={(event) => setValues((current) => ({ ...current, address: event.target.value }))} className="input mt-2" /></Field>
            <Field label="Mode paiement habituel"><input value={values.payment_mode} onChange={(event) => setValues((current) => ({ ...current, payment_mode: event.target.value }))} className="input mt-2" /></Field>
            <Field label="Conditions paiement"><input value={values.payment_terms} onChange={(event) => setValues((current) => ({ ...current, payment_terms: event.target.value }))} className="input mt-2" /></Field>
            <Field label="Alias / mots-cles"><input value={values.aliases} onChange={(event) => setValues((current) => ({ ...current, aliases: event.target.value }))} className="input mt-2" /></Field>
          </div>

          <section>
            <p className="field-label">Produits / services fournis</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {supplierProvidedServiceTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleService(tag)}
                  className={`rounded-full px-3 py-2 text-sm font-bold ${values.provided_services.includes(tag) ? 'bg-[#10285f] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {supplierProvidedServiceLabels[tag]}
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 p-5">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary">{saving ? 'Creation...' : 'Creer et selectionner'}</button>
        </footer>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}
