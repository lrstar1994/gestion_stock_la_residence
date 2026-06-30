import { CheckCircle, HandCoins, LockKeyhole, ReceiptText, Save, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { closeCashPurchase, getCashPurchase, giveCash, justifyDifference, refuseCashPurchase, saveCashPurchaseReturn, uploadCashPurchaseReceipt, validateCashPurchase, validateDifference } from '../../api/modules/cashPurchases.api'
import { useAuth } from '../../hooks/useAuth'
import { canEnterCashReturn, canGiveCash, canValidateCashPurchases, cashPurchaseSourceLabels, cashPurchaseStatusLabels, differenceTypeLabels } from '../../lib/cashPurchases'
import type { CashPurchase, CashPurchaseItem } from '../../lib/cashPurchases'

export function CashPurchaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [purchase, setPurchase] = useState<CashPurchase | null>(null)
  const [items, setItems] = useState<CashPurchaseItem[]>([])
  const [amountValidated, setAmountValidated] = useState(0)
  const [amountGiven, setAmountGiven] = useState(0)
  const [changeReturned, setChangeReturned] = useState(0)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptDescription, setReceiptDescription] = useState('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [closingComment, setClosingComment] = useState('')
  const canValidate = canValidateCashPurchases(profile?.role)
  const canGive = canGiveCash(profile?.role)
  const canReturn = canEnterCashReturn(profile?.role)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const loaded = await getCashPurchase(id)
      setPurchase(loaded)
      setItems(loaded.cash_purchase_items ?? [])
      setAmountValidated(Number(loaded.amount_validated || loaded.amount_requested || 0))
      setAmountGiven(Number(loaded.amount_given || loaded.amount_validated || loaded.amount_requested || 0))
      setChangeReturned(Number(loaded.change_returned || 0))
    } catch {
      toast.error('Dossier introuvable')
      navigate('/cash-purchases')
    }
  }, [id, navigate])

  useEffect(() => {
    load()
  }, [load])

  if (!purchase) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const totalReal = items.reduce((sum, item) => sum + Number(item.quantity_bought ?? 0) * Number(item.unit_price_real ?? 0), 0)
  const expectedChange = Number(purchase.amount_given || amountGiven) - totalReal
  const difference = expectedChange - changeReturned
  const differenceRequiresDirection = Math.abs(difference) > Number(purchase.amount_given || amountGiven) * 0.1
  const hasReceipt = (purchase.cash_purchase_receipts?.length ?? 0) > 0
  const hasOpenDifference = (purchase.cash_purchase_differences ?? []).some((item) => item.status !== 'valide' && Number(item.amount) > 0)
  const canCloseFile = (purchase.status === 'retour_partiel' || purchase.status === 'retour_complet') && hasReceipt && !hasOpenDifference

  const validate = async () => {
    await validateCashPurchase(purchase.id, amountValidated, profile?.id)
    toast.success('Decaissement valide avec succes')
    await load()
  }

  const refuse = async () => {
    const reason = window.prompt('Motif du refus')
    if (!reason) return
    await refuseCashPurchase(purchase.id, profile?.id, reason)
    toast.success('Demande refusee')
    await load()
  }

  const give = async () => {
    await giveCash(purchase.id, amountGiven, profile?.id)
    toast.success('Especes remises avec succes')
    await load()
  }

  const saveReturn = async () => {
    await saveCashPurchaseReturn(purchase.id, items, changeReturned, profile?.id)
    toast.success("Retour d'achat enregistre avec succes")
    await load()
  }

  const addJustificatif = async () => {
    if (!receiptFile) {
      toast.error('Selectionnez un justificatif')
      return
    }
    try {
      setUploadingReceipt(true)
      await uploadCashPurchaseReceipt(purchase.id, receiptFile, receiptDescription, profile?.id)
      toast.success('Justificatif ajoute')
      setReceiptFile(null)
      setReceiptDescription('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d envoyer le justificatif')
    } finally {
      setUploadingReceipt(false)
    }
  }

  const close = async () => {
    await closeCashPurchase(purchase.id, profile?.id, closingComment)
    toast.success('Dossier cloture avec succes')
    await load()
  }

  const updateItem = (itemId: string | undefined, patch: Partial<CashPurchaseItem>) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...patch } : item))
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Achat en especes</p><h1 className="page-title mt-2">{purchase.reference}</h1><p className="mt-2 text-sm text-slate-600">{cashPurchaseSourceLabels[purchase.cash_source]} - {cashPurchaseStatusLabels[purchase.status]}</p></div>
        <Link to="/cash-purchases" className="btn-secondary">Retour</Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Acheteur" value={purchase.buyer?.full_name || '-'} />
        <Info label="Demande" value={`${Number(purchase.amount_requested).toLocaleString('fr-FR')} Ar`} />
        <Info label="Remis" value={`${Number(purchase.amount_given).toLocaleString('fr-FR')} Ar`} />
        <Info label="Ecart" value={`${Number(purchase.difference).toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface p-5">
        <p className="font-semibold text-slate-950">{purchase.reason}</p>
        <p className="mt-2 text-sm text-slate-600">Date demande : {new Date(purchase.request_date).toLocaleDateString('fr-FR')} / achat prevu : {purchase.purchase_date ? new Date(purchase.purchase_date).toLocaleDateString('fr-FR') : '-'}</p>
      </section>

      {canValidate && purchase.status === 'en_attente' && (
        <section className="surface flex flex-col gap-3 p-5 lg:flex-row lg:items-end">
          <label className="block"><span className="field-label">Montant valide</span><input value={amountValidated} onChange={(event) => setAmountValidated(Number(event.target.value))} type="number" className="input mt-2" /></label>
          <button type="button" onClick={validate} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" /> Valider</button>
          <button type="button" onClick={refuse} className="btn-secondary text-red-700"><XCircle className="mr-2 h-4 w-4" /> Refuser</button>
        </section>
      )}

      {canGive && purchase.status === 'valide' && (
        <section className="surface flex flex-col gap-3 p-5 lg:flex-row lg:items-end">
          <label className="block"><span className="field-label">Montant remis</span><input value={amountGiven} onChange={(event) => setAmountGiven(Number(event.target.value))} type="number" className="input mt-2" /></label>
          <button type="button" onClick={give} className="btn-primary"><HandCoins className="mr-2 h-4 w-4" /> Remettre especes</button>
        </section>
      )}

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_100px_130px_100px_130px_130px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Prev.</span><span>Prix estime</span><span>Achete</span><span>Prix reel</span><span>Total reel</span>
        </div>
        <div className="divide-y divide-slate-200">
          {items.map((item) => (
            <div key={item.id} className="px-5 py-4">
              <div className="grid gap-3 xl:grid-cols-[1fr_100px_130px_100px_130px_130px] xl:items-center">
                <span className="font-semibold">{item.articles?.name}</span>
                <span>{Number(item.quantity_planned).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
                <span>{Number(item.unit_price_estimated).toLocaleString('fr-FR')} Ar</span>
                <input disabled={!canReturn || purchase.status !== 'especes_remises'} value={Number(item.quantity_bought ?? 0)} onChange={(event) => updateItem(item.id, { quantity_bought: Number(event.target.value) })} type="number" className="input" aria-label={`Quantite achetee ${item.articles?.name ?? ''}`} />
                <input disabled={!canReturn || purchase.status !== 'especes_remises'} value={Number(item.unit_price_real ?? 0)} onChange={(event) => updateItem(item.id, { unit_price_real: Number(event.target.value) })} type="number" className="input" aria-label={`Prix reel ${item.articles?.name ?? ''}`} />
                <span>{(Number(item.quantity_bought ?? 0) * Number(item.unit_price_real ?? 0)).toLocaleString('fr-FR')} Ar</span>
              </div>

              {canReturn && purchase.status === 'especes_remises' && (
                <div className="mt-3 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
                  <label className="block">
                    <span className="field-label">Fournisseur</span>
                    <input value={item.supplier ?? ''} onChange={(event) => updateItem(item.id, { supplier: event.target.value })} className="input mt-2 bg-white" placeholder="Nom fournisseur" />
                  </label>
                  <label className="block">
                    <span className="field-label">Facture / recu</span>
                    <input value={item.invoice_number ?? ''} onChange={(event) => updateItem(item.id, { invoice_number: event.target.value })} className="input mt-2 bg-white" placeholder="Numero recu" />
                  </label>
                  <label className="block">
                    <span className="field-label">Date facture</span>
                    <input value={item.invoice_date ?? ''} onChange={(event) => updateItem(item.id, { invoice_date: event.target.value })} type="date" className="input mt-2 bg-white" />
                  </label>
                  <label className="block">
                    <span className="field-label">Commentaire</span>
                    <input value={item.comment ?? ''} onChange={(event) => updateItem(item.id, { comment: event.target.value })} className="input mt-2 bg-white" placeholder="Observation" />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {canReturn && purchase.status === 'especes_remises' && (
        <section className="surface grid gap-4 p-5 md:grid-cols-4">
          <Info label="Total achats" value={`${totalReal.toLocaleString('fr-FR')} Ar`} />
          <Info label="Monnaie attendue" value={`${expectedChange.toLocaleString('fr-FR')} Ar`} />
          <label className="block"><span className="field-label">Monnaie rendue</span><input value={changeReturned} onChange={(event) => setChangeReturned(Number(event.target.value))} type="number" className="input mt-2" /></label>
          <div><button type="button" onClick={saveReturn} className="btn-primary mt-6"><Save className="mr-2 h-4 w-4" /> Enregistrer retour</button></div>
          {differenceRequiresDirection && <p className="text-sm font-semibold text-red-700 md:col-span-4">Ecart superieur a 10% : validation Direction obligatoire.</p>}
        </section>
      )}

      {(purchase.status === 'retour_partiel' || purchase.status === 'retour_complet') && (
        <section className="surface p-5">
          <h2 className="text-lg font-bold">Justificatifs</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input type="file" accept="image/*,.pdf" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} className="input" />
            <input value={receiptDescription} onChange={(event) => setReceiptDescription(event.target.value)} className="input" placeholder="Description optionnelle" />
            <button type="button" onClick={addJustificatif} disabled={uploadingReceipt} className="btn-secondary"><ReceiptText className="mr-2 h-4 w-4" /> {uploadingReceipt ? 'Envoi...' : 'Ajouter'}</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Images acceptees et compressees automatiquement avant envoi. PDF accepte sans compression.
            {receiptFile ? ` Fichier selectionne : ${receiptFile.name}` : ''}
          </p>
          <div className="mt-4 space-y-2">
            {purchase.cash_purchase_receipts?.map((receipt) => (
              <a key={receipt.id} href={receipt.file_url} target="_blank" className="block rounded-md border border-slate-200 p-3 text-sm font-semibold text-[#1E3A8A]">
                {receipt.file_name}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {receipt.file_size ? `${(receipt.file_size / 1024).toFixed(0)} Ko` : ''}
                  {receipt.description ? ` - ${receipt.description}` : ''}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {(purchase.cash_purchase_differences?.length ?? 0) > 0 && (
        <section className="surface p-5">
          <h2 className="text-lg font-bold">Ecarts</h2>
          <div className="mt-4 space-y-3">
            {purchase.cash_purchase_differences?.map((difference) => (
              <div key={difference.id} className="rounded-md border border-slate-200 p-3">
                <p className="font-semibold">{differenceTypeLabels[difference.difference_type]} - {Number(difference.amount).toLocaleString('fr-FR')} Ar</p>
                <p className="mt-1 text-sm text-slate-600">{difference.description}</p>
                <p className="mt-1 text-xs text-slate-500">Statut : {difference.status}</p>
                {difference.status === 'a_justifier' && canReturn && <button type="button" onClick={async () => { const text = window.prompt('Justification'); if (text) { await justifyDifference(difference.id, text, profile?.id); await load() } }} className="btn-secondary mt-3">Justifier</button>}
                {difference.status === 'justifie' && canValidate && <button type="button" onClick={async () => { await validateDifference(difference.id, profile?.id); await load() }} className="btn-primary mt-3">Valider ecart</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {canValidate && (purchase.status === 'retour_partiel' || purchase.status === 'retour_complet') && (
        <section className="surface p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="block flex-1"><span className="field-label">Commentaire cloture</span><input value={closingComment} onChange={(event) => setClosingComment(event.target.value)} className="input mt-2" /></label>
            <button type="button" onClick={close} disabled={!canCloseFile} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"><LockKeyhole className="mr-2 h-4 w-4" /> Cloturer</button>
          </div>
          {!canCloseFile && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Cloture indisponible :
              {!hasReceipt && ' ajoutez au moins un justificatif.'}
              {hasOpenDifference && ' tous les ecarts doivent etre valides par la Direction.'}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
