import { useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { createNonPurchaseDisbursement } from '../../api/modules/cashDisbursements.api'
import { useAuth } from '../../hooks/useAuth'
import { cashPurchaseSourceLabels, cashPurchaseSources } from '../../lib/cashPurchases'
import {
  nonPurchaseDisbursementTypeLabels, nonPurchaseDisbursementTypes, paymentModeLabels, paymentModes,
  supportingDocumentStatusLabels, supportingDocumentStatuses,
} from '../../lib/cashDisbursements'
import type { NonPurchaseDisbursementCategory, NonPurchaseDisbursementFormValues, NonPurchaseDisbursementType } from '../../lib/cashDisbursements'

const today = new Date().toISOString().slice(0, 10)

function categoryFor(type: NonPurchaseDisbursementType): NonPurchaseDisbursementCategory {
  if (type === 'avance_personnel') return 'personnel'
  if (type.startsWith('remboursement')) return 'remboursement'
  if (type === 'frais_administratifs_fiscaux') return 'fiscalite'
  if (type === 'transfert_interne') return 'transfert_interne'
  if (['maintenance_reparation', 'transport_deplacement', 'paiement_prestataire'].includes(type)) return 'operations'
  return 'divers'
}

export function NonPurchaseDisbursementFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [values, setValues] = useState<NonPurchaseDisbursementFormValues>({
    type: 'avance_personnel', category: 'personnel', beneficiary: '', amount: 0,
    cashSource: 'caisse_principale', paymentMode: 'especes', reason: '', service: '',
    actualDate: today, supportingDocumentStatus: 'a_regulariser', comment: '', validationRequired: true,
  })

  const update = <K extends keyof NonPurchaseDisbursementFormValues>(key: K, value: NonPurchaseDisbursementFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile?.id) return
    try {
      setSaving(true)
      const result = await createNonPurchaseDisbursement(values, profile.id, file)
      toast.success(`Decaissement ${result.reference} enregistre`)
      navigate('/cash-purchases/report#hors-achat')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d enregistrer le decaissement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="surface p-6">
        <p className="eyebrow">Caisse</p>
        <h1 className="page-title mt-2">Nouveau decaissement hors achat</h1>
        <p className="mt-2 text-sm text-slate-600">Sortie d'argent sans reception marchandises, sans entree stock et sans mouvement de stock.</p>
      </header>

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <Field label="Type de decaissement"><select value={values.type} onChange={(event) => { const type = event.target.value as NonPurchaseDisbursementType; setValues((current) => ({ ...current, type, category: categoryFor(type) })) }} className="input mt-2">{nonPurchaseDisbursementTypes.map((type) => <option key={type} value={type}>{nonPurchaseDisbursementTypeLabels[type]}</option>)}</select></Field>
        <Field label="Beneficiaire"><input value={values.beneficiary} onChange={(event) => update('beneficiary', event.target.value)} className="input mt-2" required /></Field>
        <Field label="Montant"><input type="number" min="1" value={values.amount || ''} onChange={(event) => update('amount', Number(event.target.value))} className="input mt-2" required /></Field>
        <Field label="Caisse ou compte source"><select value={values.cashSource} onChange={(event) => update('cashSource', event.target.value)} className="input mt-2">{cashPurchaseSources.map((source) => <option key={source} value={source}>{cashPurchaseSourceLabels[source]}</option>)}</select></Field>
        <Field label="Mode de paiement"><select value={values.paymentMode} onChange={(event) => update('paymentMode', event.target.value as NonPurchaseDisbursementFormValues['paymentMode'])} className="input mt-2">{paymentModes.map((mode) => <option key={mode} value={mode}>{paymentModeLabels[mode]}</option>)}</select></Field>
        <Field label="Service concerne"><input value={values.service} onChange={(event) => update('service', event.target.value)} className="input mt-2" placeholder="Facultatif" /></Field>
        <Field label="Date reelle du decaissement"><input type="date" value={values.actualDate} onChange={(event) => update('actualDate', event.target.value)} className="input mt-2" required /></Field>
        <Field label="Date de saisie"><input value={new Date().toLocaleDateString('fr-FR')} className="input mt-2 bg-slate-100" readOnly /></Field>
        <Field label="Numero interne de piece"><input value="Genere automatiquement a l'enregistrement" className="input mt-2 bg-slate-100" readOnly /></Field>
        <Field label="Statut justificatif"><select value={values.supportingDocumentStatus} onChange={(event) => update('supportingDocumentStatus', event.target.value as NonPurchaseDisbursementFormValues['supportingDocumentStatus'])} className="input mt-2">{supportingDocumentStatuses.map((status) => <option key={status} value={status}>{supportingDocumentStatusLabels[status]}</option>)}</select></Field>
        <label className="block md:col-span-2"><span className="field-label">Motif</span><textarea value={values.reason} onChange={(event) => update('reason', event.target.value)} className="input mt-2 min-h-20" required /></label>
        <Field label="Justificatif scan / photo / PDF"><input type="file" accept="image/*,.pdf" onChange={(event) => { const nextFile = event.target.files?.[0] ?? null; setFile(nextFile); if (nextFile) update('supportingDocumentStatus', 'present') }} className="input mt-2" /></Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={values.validationRequired} onChange={(event) => update('validationRequired', event.target.checked)} className="h-4 w-4" /> Validation par la Direction requise</label>
        <label className="block md:col-span-2"><span className="field-label">Commentaire</span><textarea value={values.comment} onChange={(event) => update('comment', event.target.value)} className="input mt-2 min-h-20" /></label>
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-black">Relais du dossier</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Relay label="ÉTAPE ACTUELLE" value="Saisie ou demande" />
          <Relay label="Responsable actuel" value={profile?.role === 'direction' ? 'Direction' : 'Demandeur'} />
          <Relay label="Action attendue" value="Enregistrer le dossier" />
          <Relay label="Prochain responsable" value={values.validationRequired ? 'Direction' : 'Caisse'} />
          <Relay label="Prochain statut" value={values.validationRequired ? 'En attente Direction' : 'Valide - Caisse a decaisser'} />
        </div>
        <p className="mt-4 text-sm font-semibold text-amber-700">Classement : {values.supportingDocumentStatus === 'present' ? 'piece a controler avant classement' : 'non classe - justificatif a regulariser'}.</p>
      </section>

      <div className="flex justify-end"><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Enregistrement...' : 'Enregistrer le decaissement'}</button></div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}

function Relay({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900">{value}</p></div>
}
