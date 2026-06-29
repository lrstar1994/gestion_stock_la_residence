import { CheckCircle, Download, Edit, FileUp, Send, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getReception, refuseReception, resolveReceptionAnomaly, submitReception, uploadReceptionDocument, validateReception } from '../../api/modules/receptions.api'
import { useAuth } from '../../hooks/useAuth'
import { exportReceptionToPdf } from '../../lib/receptionExports'
import { anomalyTypeLabels, canCreateReceptions, canValidateReceptionWithAnomalies, canValidateReceptions, qualityStatusLabels, receptionStatusLabels } from '../../lib/receptions'
import type { Reception } from '../../lib/receptions'

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
    } catch {
      toast.error('Reception introuvable')
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

  const submit = async () => {
    await submitReception(reception.id, profile?.id)
    toast.success(hasAnomalies ? 'Réception validée avec succès' : 'Entrée en stock effectuée avec succès')
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
        <InfoFlat label="Receptionnaire" value={reception.receiver?.full_name || '-'} />
        {reception.purchase_orders ? <InfoLink label="Commande associee" value={reception.purchase_orders.reference} to={`/purchase-orders/${reception.purchase_order_id}`} /> : <InfoFlat label="Commande associee" value="-" />}
        <InfoFlat label="Validation" value={reception.validated_at ? `${new Date(reception.validated_at).toLocaleString('fr-FR')} - ${reception.validator?.full_name || ''}` : '-'} />
        {reception.comment && <div className="md:col-span-2"><InfoFlat label="Commentaire" value={reception.comment} /></div>}
        {reception.validation_comment && <div className="md:col-span-2"><InfoFlat label="Commentaire validation" value={reception.validation_comment} /></div>}
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_100px_100px_100px_100px_130px_140px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Commande</span><span>Livre</span><span>Accepte</span><span>Refuse</span><span>Prix reel</span><span>Qualite</span>
        </div>
        <div className="divide-y divide-slate-200">
          {reception.reception_items?.map((item) => (
            <div key={item.id} className="space-y-3 px-5 py-4">
              <div className="grid gap-3 xl:grid-cols-[1fr_100px_100px_100px_100px_130px_140px] xl:items-center">
                <span><span className="block font-semibold">{item.articles?.name}</span><span className="text-xs text-slate-500">{item.articles?.families?.name || ''}</span></span>
                <span>{Number(item.quantity_ordered ?? 0).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
                <span>{Number(item.quantity_delivered ?? 0).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
                <span>{Number(item.quantity_accepted ?? 0).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
                <span>{Number(item.quantity_refused ?? 0).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
                <span>{Number(item.unit_price_real ?? 0).toLocaleString('fr-FR')} Ar</span>
                <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1E3A8A]">{qualityStatusLabels[item.quality]}</span>
              </div>
              {item.quality_comment && <p className="text-sm text-slate-600">Qualite : {item.quality_comment}</p>}
              {(item.reception_anomalies?.length ?? 0) > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
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
          ))}
        </div>
      </section>

      <section className="surface flex flex-wrap gap-3 p-5">
        {canSubmit && <button type="button" onClick={submit} className="btn-primary"><Send className="mr-2 h-4 w-4" /> Soumettre / valider</button>}
        {canDirectionValidate && <button type="button" onClick={validate} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" /> Valider</button>}
        {canDirectionValidate && <button type="button" onClick={refuse} className="btn-secondary text-red-700"><XCircle className="mr-2 h-4 w-4" /> Refuser</button>}
        {reception.status === 'validee' && <p className="text-sm font-semibold text-blue-800">Mouvement d'entree en stock cree en attente du module Stock.</p>}
        {reception.status === 'validee_avec_anomalies' && <p className="text-sm font-semibold text-orange-800">Mouvement d'entree en stock cree avec anomalies en attente du module Stock.</p>}
        {reception.status === 'entree_stock' && <p className="text-sm font-semibold text-emerald-800">Entree en stock effectuee avec succes.</p>}
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

function InfoFlat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>
}

function InfoLink({ label, value, to }: { label: string; value: string; to: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><Link to={to} className="mt-1 inline-block font-semibold text-[#1E3A8A] hover:underline">{value}</Link></div>
}
