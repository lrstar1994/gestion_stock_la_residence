import { CheckCircle, Download, Edit, FileUp, Send, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getReception, refuseReception, resolveReceptionAnomaly, submitReception, uploadReceptionDocument, validateReception } from '../../api/modules/receptions.api'
import { useAuth } from '../../hooks/useAuth'
import { exportReceptionToPdf } from '../../lib/receptionExports'
import { anomalyTypeLabels, canCreateReceptions, canValidateReceptionWithAnomalies, canValidateReceptions, receptionStatusLabels } from '../../lib/receptions'
import type { Reception } from '../../lib/receptions'
import { effectiveCostMethodLabels, invoiceTaxModeLabels } from '../../lib/materialCosts'

const receptionComparisonGrid =
  'grid min-w-[1740px] grid-cols-[1.4fr_120px_120px_120px_120px_130px_150px_130px_150px_150px_190px_180px_120px] items-center gap-4 px-5'

export function ReceptionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [reception, setReception] = useState<Reception | null>(null)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentDescription, setDocumentDescription] = useState('')
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const canEdit = canCreateReceptions(profile?.role)
  const canValidate = canValidateReceptions(profile?.role)
  const canValidateAnomalies = canValidateReceptionWithAnomalies(profile?.role)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setReception(await getReception(id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reception introuvable')
      navigate('/receptions')
    }
  }, [id, navigate])

  useEffect(() => {
    load()
  }, [load])

  if (!reception) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const hasAnomalies = (reception.reception_items ?? []).some((item) => item.has_anomaly || item.quality !== 'conforme' || (item.reception_anomalies?.length ?? 0) > 0)
  const canSubmit = canValidate && ['brouillon'].includes(reception.status)
  const canDirectionValidate = reception.status === 'en_attente' && (hasAnomalies ? canValidateAnomalies : canValidate)
  const canModify = canEdit && ['brouillon', 'en_attente'].includes(reception.status)
  const receptionItems = reception.reception_items ?? []
  const firstItem = receptionItems[0]
  const fiscalSummary = {
    invoiceAmountHt: receptionItems.reduce((sum, item) => sum + Number(item.invoice_amount_ht ?? 0), 0),
    invoiceVatAmount: receptionItems.reduce((sum, item) => sum + Number(item.invoice_vat_amount ?? 0), 0),
    invoiceAmountTtc: receptionItems.reduce((sum, item) => sum + Number(item.invoice_amount_ttc ?? 0), 0),
    recoverableVat: receptionItems.reduce((sum, item) => sum + Number(item.recoverable_vat_amount ?? 0), 0),
    nonRecoverableVat: receptionItems.reduce((sum, item) => sum + Number(item.non_recoverable_vat_amount ?? 0), 0),
    declaredExtraTax: receptionItems.reduce((sum, item) => sum + Number(item.declared_extra_tax_amount ?? 0), 0),
    accountingTotal: receptionItems.reduce((sum, item) => sum + Number(item.accounting_total_amount ?? 0), 0),
    effectiveMaterialCost: receptionItems.reduce((sum, item) => sum + Number(item.effective_material_cost_total ?? 0), 0),
  }

  const submit = async () => {
    await submitReception(reception.id, profile?.id)
    toast.success(reception.is_historical ? 'Reception historique validee sans entree en stock' : hasAnomalies ? 'Réception validée avec succès' : 'Entrée en stock effectuée avec succès')
    await load()
  }

  const validate = async () => {
    const comment = window.prompt('Commentaire de validation optionnel') ?? ''
    await validateReception(reception.id, profile?.id, comment)
    toast.success('Réception validée avec succès')
    await load()
  }

  const refuse = async () => {
    const reason = window.prompt('Motif du refus')
    if (!reason) return
    await refuseReception(reception.id, profile?.id, reason)
    toast.success('Reception refusee')
    await load()
  }

  const addDocument = async () => {
    if (!documentFile) {
      toast.error('Selectionnez un document')
      return
    }
    try {
      setUploadingDocument(true)
      await uploadReceptionDocument(reception.id, documentFile, documentDescription, profile?.id)
      toast.success('Document ajoute')
      setDocumentFile(null)
      setDocumentDescription('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload impossible')
    } finally {
      setUploadingDocument(false)
    }
  }

  const resolveAnomaly = async (anomalyId: string | undefined) => {
    if (!anomalyId) return
    const comment = window.prompt('Commentaire de resolution')
    if (!comment) return
    await resolveReceptionAnomaly(anomalyId, profile?.id, comment)
    toast.success('Anomalie resolue')
    await load()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Reception</p>
          <h1 className="page-title mt-2">{reception.reference}</h1>
          <p className="mt-2 text-sm text-slate-600">{reception.suppliers?.name} - {receptionStatusLabels[reception.status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportReceptionToPdf(reception)} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> PDF</button>
          {canModify && <Link to={`/receptions/${reception.id}/edit`} className="btn-secondary"><Edit className="mr-2 h-4 w-4" /> Modifier</Link>}
          <Link to="/receptions" className="btn-secondary">Retour</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Fournisseur" value={reception.suppliers?.name || '-'} />
        <Info label="Date reception" value={new Date(reception.reception_date).toLocaleDateString('fr-FR')} />
        <Info label="Facture" value={reception.invoice_number} />
        <Info label="Montant" value={`${Number(reception.total_amount ?? 0).toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <InfoFlat label="Localisation" value={reception.locations?.name || '-'} />
        <InfoFlat label="Mode" value={reception.is_historical ? 'Historique sans entree en stock' : 'Reception normale'} />
        <InfoFlat label="Receptionnaire" value={reception.receiver?.full_name || '-'} />
        {reception.purchase_orders ? <InfoLink label="Commande associee" value={reception.purchase_orders.reference} to={`/purchase-orders/${reception.purchase_order_id}`} /> : <InfoFlat label="Commande associee" value="-" />}
        {reception.cash_purchases ? <InfoLink label="Achat espece associe" value={reception.cash_purchases.reference} to={`/cash-purchases/${reception.cash_purchase_id}`} /> : <InfoFlat label="Achat espece associe" value="-" />}
        <InfoFlat label="Validation" value={reception.validated_at ? `${new Date(reception.validated_at).toLocaleString('fr-FR')} - ${reception.validator?.full_name || ''}` : '-'} />
        {reception.comment && <div className="md:col-span-2"><InfoFlat label="Commentaire" value={reception.comment} /></div>}
        {reception.validation_comment && <div className="md:col-span-2"><InfoFlat label="Commentaire validation" value={reception.validation_comment} /></div>}
      </section>

      <section className="surface p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Lecture fiscale / cout matiere</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">Resume de valorisation</h2>
            <p className="mt-1 text-sm text-slate-600">
              Le prix reel correspond au prix saisi a la reception. Le cout interne est le cout utilise pour valoriser le stock apres TVA, charges ou cout manuel.
            </p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1E3A8A]">
            {firstItem?.invoice_tax_mode ? invoiceTaxModeLabels[firstItem.invoice_tax_mode] : 'Mode fiscal non renseigne'}
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <InfoFlat label="Montant HT / base reception" value={formatMoney(fiscalSummary.invoiceAmountHt || reception.total_amount)} />
          <InfoFlat label="TVA facture" value={formatMoney(fiscalSummary.invoiceVatAmount)} />
          <InfoFlat label="Montant TTC" value={formatMoney(fiscalSummary.invoiceAmountTtc || reception.total_amount)} />
          <InfoFlat label="Total comptable" value={formatMoney(fiscalSummary.accountingTotal || reception.total_amount)} />
          <InfoFlat label="TVA recuperable" value={formatMoney(fiscalSummary.recoverableVat)} />
          <InfoFlat label="TVA non recuperable" value={formatMoney(fiscalSummary.nonRecoverableVat)} />
          <InfoFlat label="Charge declarative" value={formatMoney(fiscalSummary.declaredExtraTax)} />
          <InfoFlat label="Cout matiere interne" value={formatMoney(fiscalSummary.effectiveMaterialCost || reception.total_amount)} />
        </div>
        {firstItem?.effective_cost_method && (
          <p className="mt-4 text-sm text-slate-600">
            Methode de cout : <strong>{effectiveCostMethodLabels[firstItem.effective_cost_method]}</strong>
            {firstItem.effective_cost_note ? ` - ${firstItem.effective_cost_note}` : ''}
          </p>
        )}
      </section>

      {(reception.purchase_orders || reception.cash_purchases) && (
        <section className="surface">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="eyebrow">Source de la reception</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">
              {reception.purchase_orders ? `Commande ${reception.purchase_orders.reference}` : `Achat espece ${reception.cash_purchases?.reference}`}
            </h2>
          </div>

          {reception.purchase_orders && (
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <InfoFlat label="Statut commande" value={reception.purchase_orders.status} />
              <InfoFlat label="Montant commande" value={formatMoney(reception.purchase_orders.total_amount)} />
              <InfoLink label="Voir la commande" value={reception.purchase_orders.reference} to={`/purchase-orders/${reception.purchase_order_id}`} />
            </div>
          )}

          {reception.cash_purchases && (
            <div className="grid gap-4 p-5 md:grid-cols-4">
              <InfoFlat label="Montant demande" value={formatMoney(reception.cash_purchases.amount_requested)} />
              <InfoFlat label="Montant valide" value={formatMoney(reception.cash_purchases.amount_validated)} />
              <InfoFlat label="Monnaie remise" value={formatMoney(reception.cash_purchases.amount_given)} />
              <InfoFlat label="Ecart achat" value={formatMoney(reception.cash_purchases.difference)} />
            </div>
          )}
        </section>
      )}

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="eyebrow">Controle reception</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Prevu vs reel</h2>
        </div>
        <div className="overflow-x-auto">
          <div className={`${receptionComparisonGrid} border-b border-slate-200 bg-slate-50 py-3 text-xs font-bold uppercase tracking-wide text-slate-500`}>
            <span>Article</span>
            <span>Prevu</span>
            <span>Livre</span>
            <span>Accepte</span>
            <span>Ecart qte</span>
            <span>Prix prevu saisi</span>
            <span>Prix reel saisi</span>
            <span>Ecart prix</span>
            <span>Total prevu</span>
            <span>Total recu saisi</span>
            <span>Cout interne stock</span>
            <span>Methode cout</span>
            <span>Statut</span>
          </div>
          <div className="divide-y divide-slate-200">
            {reception.reception_items?.map((item) => {
              const displayUnit = item.display_unit?.abbreviation ?? item.units?.abbreviation
              const stockUnit = item.units?.abbreviation
              const expectedQuantity = Number(item.quantity_ordered ?? 0)
              const deliveredDisplay = Number(item.quantity_delivered_display ?? item.quantity_delivered ?? 0)
              const acceptedDisplay = Number(item.quantity_accepted_display ?? item.quantity_accepted ?? 0)
              const acceptedQuantity = Number(item.quantity_accepted ?? 0)
              const quantityDiff = acceptedDisplay - expectedQuantity
              const plannedPrice = Number(item.unit_price_planned ?? 0)
              const realPrice = Number(item.unit_price_display ?? item.unit_price_real ?? 0)
              const priceDiff = realPrice - plannedPrice
              const plannedTotal = expectedQuantity * plannedPrice
              const realTotal = acceptedDisplay * realPrice
              const isConform = quantityDiff === 0 && priceDiff === 0 && item.quality === 'conforme' && !item.has_anomaly && (item.reception_anomalies?.length ?? 0) === 0

              return (
                <div key={item.id} className="space-y-3 py-4">
                  <div className={`${receptionComparisonGrid} text-sm`}>
                    <span><span className="block font-semibold text-slate-950">{item.articles?.name}</span><span className="text-xs text-slate-500">{item.articles?.families?.name || ''}</span></span>
                    <span>{formatQuantity(expectedQuantity, displayUnit)}</span>
                    <span>{formatQuantity(deliveredDisplay, displayUnit)}</span>
                    <span><span className="block">{formatQuantity(acceptedDisplay, displayUnit)}</span>{displayUnit !== stockUnit && <span className="text-xs text-slate-500">{formatQuantity(acceptedQuantity, stockUnit)} stock</span>}</span>
                    <span className={quantityDiff === 0 ? 'text-slate-700' : quantityDiff < 0 ? 'font-semibold text-red-700' : 'font-semibold text-amber-700'}>
                      {formatSignedQuantity(quantityDiff, displayUnit)}
                    </span>
                    <span>{formatMoney(plannedPrice)}</span>
                    <span>{formatMoney(realPrice)}</span>
                    <span className={priceDiff === 0 ? 'text-slate-700' : priceDiff > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
                      {formatSignedMoney(priceDiff)}
                    </span>
                    <span>{formatMoney(plannedTotal)}</span>
                    <span className="font-semibold text-slate-950">{formatMoney(realTotal)}</span>
                    <span>
                      <span className="block font-semibold text-[#1E3A8A]">{formatMoney(item.effective_material_unit_cost ?? item.unit_price_real)} / {stockUnit}</span>
                      <span className="text-xs text-slate-500">{formatMoney(item.effective_material_cost_total ?? acceptedQuantity * Number(item.unit_price_real ?? 0))} total</span>
                    </span>
                    <span className="text-xs text-slate-600">
                      <span className="block font-semibold text-slate-800">{item.invoice_tax_mode ? invoiceTaxModeLabels[item.invoice_tax_mode] : '-'}</span>
                      <span className="mt-1 block">{item.effective_cost_method ? effectiveCostMethodLabels[item.effective_cost_method] : '-'}</span>
                    </span>
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${isConform ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                      {isConform ? 'Conforme' : 'Ecart'}
                    </span>
                  </div>
              {item.quality_comment && <p className="min-w-[1740px] px-5 text-sm text-slate-600">Qualite : {item.quality_comment}</p>}
              {(item.reception_anomalies?.length ?? 0) > 0 && (
                <div className="grid min-w-[1740px] gap-3 px-5 md:grid-cols-2">
                  {item.reception_anomalies?.map((anomaly) => (
                    <div key={anomaly.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="font-semibold text-amber-900">{anomalyTypeLabels[anomaly.anomaly_type]}</p>
                      <p className="mt-1 text-sm text-amber-900">{anomaly.description}</p>
                      <p className="mt-1 text-xs font-semibold text-amber-900">{anomaly.resolved ? 'Resolue' : 'A resoudre'}</p>
                      {anomaly.resolution_comment && <p className="mt-1 text-xs text-amber-900">Resolution : {anomaly.resolution_comment}</p>}
                      {anomaly.photo_url && <a href={anomaly.photo_url} target="_blank" className="mt-2 block text-sm font-bold text-[#1E3A8A]">Voir photo</a>}
                      {!anomaly.resolved && canValidateAnomalies && <button type="button" onClick={() => resolveAnomaly(anomaly.id)} className="btn-secondary mt-3">Resoudre</button>}
                    </div>
                  ))}
                </div>
              )}
                </div>
              )
            })}
            {(reception.reception_items?.length ?? 0) === 0 && <p className="min-w-[1740px] p-5 text-sm text-slate-600">Aucun article receptionne.</p>}
          </div>
        </div>
      </section>

      <section className="surface flex flex-wrap gap-3 p-5">
        {canSubmit && <button type="button" onClick={submit} className="btn-primary"><Send className="mr-2 h-4 w-4" /> Soumettre / valider</button>}
        {canDirectionValidate && <button type="button" onClick={validate} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" /> Valider</button>}
        {canDirectionValidate && <button type="button" onClick={refuse} className="btn-secondary text-red-700"><XCircle className="mr-2 h-4 w-4" /> Refuser</button>}
        {reception.is_historical && ['validee', 'validee_avec_anomalies'].includes(reception.status) && <p className="text-sm font-semibold text-amber-800">Reception historique validee : aucune entree en stock n'a ete generee.</p>}
        {!reception.is_historical && reception.status === 'validee' && <p className="text-sm font-semibold text-blue-800">Mouvement d'entree en stock cree en attente du module Stock.</p>}
        {!reception.is_historical && reception.status === 'validee_avec_anomalies' && <p className="text-sm font-semibold text-orange-800">Mouvement d'entree en stock cree avec anomalies en attente du module Stock.</p>}
        {!reception.is_historical && reception.status === 'entree_stock' && <p className="text-sm font-semibold text-emerald-800">Entree en stock effectuee avec succes.</p>}
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-bold">Documents</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input type="file" accept="image/*,.pdf" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className="input" />
          <input value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} className="input" placeholder="Description optionnelle" />
          <button type="button" onClick={addDocument} disabled={uploadingDocument} className="btn-secondary"><FileUp className="mr-2 h-4 w-4" /> {uploadingDocument ? 'Envoi...' : 'Ajouter'}</button>
        </div>
        <div className="mt-4 space-y-2">
          {reception.reception_documents?.map((document) => (
            <a key={document.id} href={document.file_url} target="_blank" className="block rounded-md border border-slate-200 p-3 text-sm font-semibold text-[#1E3A8A]">
              {document.file_name}
              <span className="ml-2 text-xs font-normal text-slate-500">{document.description || ''}</span>
            </a>
          ))}
          {(reception.reception_documents?.length ?? 0) === 0 && <p className="text-sm text-slate-600">Aucun document ajoute.</p>}
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-bold">Historique</h2>
        <div className="mt-4 space-y-3">
          {reception.reception_history?.map((history) => (
            <div key={history.id} className="rounded-md border border-slate-200 p-3">
              <p className="font-semibold">{history.action}</p>
              <p className="mt-1 text-sm text-slate-600">{history.description}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(history.created_at).toLocaleString('fr-FR')} - {history.actor?.full_name || '-'}</p>
            </div>
          ))}
          {(reception.reception_history?.length ?? 0) === 0 && <p className="text-sm text-slate-600">Aucun historique.</p>}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function formatMoney(value: number | string | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('fr-FR')} Ar`
}

function formatQuantity(value: number | string | null | undefined, unit?: string) {
  return `${Number(value ?? 0).toLocaleString('fr-FR')} ${unit ?? ''}`.trim()
}

function formatSignedQuantity(value: number, unit?: string) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('fr-FR')} ${unit ?? ''}`.trim()
}

function formatSignedMoney(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('fr-FR')} Ar`
}

function InfoFlat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>
}

function InfoLink({ label, value, to }: { label: string; value: string; to: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><Link to={to} className="mt-1 inline-block font-semibold text-[#1E3A8A] hover:underline">{value}</Link></div>
}
