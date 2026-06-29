import { CheckCircle, Download, Edit, FileUp, PackageCheck, Send, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { attachGeneratedPurchaseOrderPdf, cancelPurchaseOrder, closePurchaseOrder, getPurchaseOrder, receivePurchaseOrder, sendPurchaseOrder, uploadPurchaseOrderDocument, validateOrderItemDifference, validatePurchaseOrder } from '../../api/modules/purchaseOrders.api'
import { useAuth } from '../../hooks/useAuth'
import { createPurchaseOrderPdfFile, exportPurchaseOrderToPdf } from '../../lib/purchaseOrderExports'
import { canEditPurchaseOrder, canReceivePurchaseOrders, canSendPurchaseOrders, canValidatePurchaseOrders, purchaseOrderStatusLabels } from '../../lib/purchaseOrders'
import { orderDifferenceTypeLabels, orderDifferenceTypes } from '../../lib/purchaseOrders'
import type { OrderDifferenceType, PurchaseOrder, PurchaseOrderItem } from '../../lib/purchaseOrders'

export function PurchaseOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [items, setItems] = useState<PurchaseOrderItem[]>([])
  const [fileUrl, setFileUrl] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentDescription, setDocumentDescription] = useState('')
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const canValidate = canValidatePurchaseOrders(profile?.role)
  const canSend = canSendPurchaseOrders(profile?.role)
  const canReceive = canReceivePurchaseOrders(profile?.role)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const loaded = await getPurchaseOrder(id)
      setOrder(loaded)
      setItems(loaded.purchase_order_items ?? [])
      setFileUrl(loaded.file_url ?? '')
    } catch {
      toast.error('Commande introuvable')
      navigate('/purchase-orders')
    }
  }, [id, navigate])

  useEffect(() => {
    load()
  }, [load])

  if (!order) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const editable = canEditPurchaseOrder(order, profile?.role)
  const needs = order.purchase_order_needs ?? []
  const canReceiveNow = canReceive && ['envoyee', 'partiellement_livree', 'reception_avec_ecart'].includes(order.status)
  const hasOpenDifference = items.some((item) => item.difference_status === 'a_justifier')
  const canClose = canValidate && ['livree', 'reception_avec_ecart'].includes(order.status) && !hasOpenDifference

  const validate = async () => {
    const comment = window.prompt('Commentaire de validation optionnel') ?? ''
    await validatePurchaseOrder(order.id, profile?.id, comment)
    toast.success('Commande validee avec succes')
    await load()
  }

  const send = async () => {
    const uploadedUrl = fileUrl || await attachGeneratedPurchaseOrderPdf(order.id, createPurchaseOrderPdfFile(order), profile?.id)
    await sendPurchaseOrder(order.id, profile?.id, uploadedUrl)
    toast.success('Commande envoyee avec succes')
    await load()
  }

  const receive = async () => {
    await receivePurchaseOrder(order.id, items, profile?.id)
    toast.success('Reception enregistree avec succes')
    await load()
  }

  const cancel = async () => {
    const reason = window.prompt("Motif d'annulation")
    if (!reason) return
    await cancelPurchaseOrder(order.id, profile?.id, reason)
    toast.success('Commande annulee')
    await load()
  }

  const close = async () => {
    try {
      await closePurchaseOrder(order.id, profile?.id)
      toast.success('Commande cloturee')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cloture impossible')
    }
  }

  const updateItem = (itemId: string | undefined, patch: Partial<PurchaseOrderItem>) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...patch } : item))
  }

  const addDocument = async () => {
    if (!documentFile) {
      toast.error('Selectionnez un document')
      return
    }
    try {
      setUploadingDocument(true)
      await uploadPurchaseOrderDocument(order.id, documentFile, documentDescription, profile?.id)
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

  const validateItemDifference = async (itemId: string | undefined) => {
    if (!itemId) return
    await validateOrderItemDifference(itemId, profile?.id)
    toast.success('Ecart valide')
    await load()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Commande fournisseur</p>
          <h1 className="page-title mt-2">{order.reference}</h1>
          <p className="mt-2 text-sm text-slate-600">{order.suppliers?.name} - {purchaseOrderStatusLabels[order.status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportPurchaseOrderToPdf(order)} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> PDF</button>
          {['envoyee', 'partiellement_livree', 'reception_avec_ecart'].includes(order.status) && <Link to={`/receptions/new?orderId=${order.id}`} className="btn-primary">Creer reception</Link>}
          {editable && <Link to={`/purchase-orders/${order.id}/edit`} className="btn-secondary"><Edit className="mr-2 h-4 w-4" /> Modifier</Link>}
          <Link to="/purchase-orders" className="btn-secondary">Retour</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Fournisseur" value={order.suppliers?.name || '-'} />
        <Info label="Date commande" value={new Date(order.order_date).toLocaleDateString('fr-FR')} />
        <Info label="Livraison prevue" value={new Date(order.delivery_date).toLocaleDateString('fr-FR')} />
        <Info label="Montant total" value={`${Number(order.total_amount ?? 0).toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <InfoFlat label="Reference fournisseur" value={order.supplier_reference || '-'} />
        <InfoFlat label="Acheteur" value={order.creator?.full_name || '-'} />
        <InfoFlat label="Conditions paiement" value={order.payment_terms || '-'} />
        <InfoFlat label="Mode livraison" value={order.delivery_mode || '-'} />
        {order.comment && <div className="md:col-span-2"><InfoFlat label="Commentaire" value={order.comment} /></div>}
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_100px_100px_110px_120px_1.2fr_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Commande</span><span>Recu</span><span>Restant</span><span>Prix</span><span>Ecart</span><span>Total</span>
        </div>
        <div className="divide-y divide-slate-200">
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_100px_100px_110px_120px_1.2fr_120px] xl:items-center">
              <span><span className="block font-semibold">{item.articles?.name}</span><span className="text-xs text-slate-500">{item.articles?.families?.name || ''}</span></span>
              <span>{Number(item.quantity_ordered).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
              {canReceiveNow ? (
                <input type="number" value={Number(item.quantity_received ?? 0)} onChange={(event) => updateItem(item.id, { quantity_received: Number(event.target.value) })} className="input" />
              ) : (
                <span>{Number(item.quantity_received ?? 0).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
              )}
              <span>{Math.max(0, Number(item.quantity_ordered ?? 0) - Number(item.quantity_received ?? 0)).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
              <span>{Number(item.unit_price ?? 0).toLocaleString('fr-FR')} Ar</span>
              <div className="space-y-2">
                {canReceiveNow ? (
                  <>
                    <select value={item.difference_type ?? ''} onChange={(event) => updateItem(item.id, { difference_type: event.target.value ? event.target.value as OrderDifferenceType : null })} className="input">
                      <option value="">Aucun ecart</option>
                      {orderDifferenceTypes.map((type) => <option key={type} value={type}>{orderDifferenceTypeLabels[type]}</option>)}
                    </select>
                    <input value={item.difference_comment ?? ''} onChange={(event) => updateItem(item.id, { difference_comment: event.target.value })} className="input" placeholder="Commentaire ecart" />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">{item.difference_type ? orderDifferenceTypeLabels[item.difference_type] : 'Aucun'}</p>
                    {item.difference_comment && <p className="text-xs text-slate-500">{item.difference_comment}</p>}
                  </>
                )}
                {item.difference_status === 'a_justifier' && <span className="inline-flex rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-bold text-yellow-800">A valider</span>}
                {item.difference_status === 'valide' && <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">Valide</span>}
                {canValidate && item.difference_status === 'a_justifier' && <button type="button" onClick={() => validateItemDifference(item.id)} className="btn-secondary">Valider ecart</button>}
              </div>
              <span>{(Number(item.quantity_ordered ?? 0) * Number(item.unit_price ?? 0)).toLocaleString('fr-FR')} Ar</span>
            </div>
          ))}
        </div>
      </section>

      {needs.length > 0 && (
        <section className="surface p-5">
          <h2 className="text-lg font-bold">Besoins associes</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {needs.map((link) => (
              <div key={link.id} className="rounded-md border border-slate-200 p-3">
                <p className="font-semibold">{link.purchase_needs?.articles?.name}</p>
                <p className="mt-1 text-sm text-slate-600">{Number(link.purchase_needs?.quantity ?? 0).toLocaleString('fr-FR')} {link.purchase_needs?.units?.abbreviation} - {link.purchase_needs?.requester?.full_name || '-'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="surface flex flex-col gap-3 p-5 lg:flex-row lg:items-end">
        {canValidate && order.status === 'brouillon' && <button type="button" onClick={validate} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" /> Valider</button>}
        {canSend && order.status === 'validee' && (
          <>
            <label className="block flex-1"><span className="field-label">Lien PDF envoye optionnel</span><input value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} className="input mt-2" placeholder="Auto genere si vide" /></label>
            <button type="button" onClick={send} className="btn-primary"><Send className="mr-2 h-4 w-4" /> Marquer envoyee</button>
          </>
        )}
        {canReceiveNow && <button type="button" onClick={receive} className="btn-primary"><PackageCheck className="mr-2 h-4 w-4" /> Enregistrer reception</button>}
        {canValidate && !['annulee', 'cloturee', 'livree'].includes(order.status) && <button type="button" onClick={cancel} className="btn-secondary text-red-700"><XCircle className="mr-2 h-4 w-4" /> Annuler</button>}
        {canValidate && ['livree', 'reception_avec_ecart'].includes(order.status) && <button type="button" onClick={close} disabled={!canClose} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle className="mr-2 h-4 w-4" /> Cloturer</button>}
        {hasOpenDifference && <p className="text-sm font-semibold text-amber-800">Cloture bloquee : validez tous les ecarts de reception.</p>}
      </section>

      {['envoyee', 'partiellement_livree', 'livree', 'reception_avec_ecart', 'cloturee'].includes(order.status) && (
        <section className="surface p-5">
          <h2 className="text-lg font-bold">Documents de reception</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input type="file" accept="image/*,.pdf" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className="input" />
            <input value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} className="input" placeholder="Description optionnelle" />
            <button type="button" onClick={addDocument} disabled={uploadingDocument} className="btn-secondary"><FileUp className="mr-2 h-4 w-4" /> {uploadingDocument ? 'Envoi...' : 'Ajouter'}</button>
          </div>
          <div className="mt-4 space-y-2">
            {order.purchase_order_documents?.map((document) => (
              <a key={document.id} href={document.file_url} target="_blank" className="block rounded-md border border-slate-200 p-3 text-sm font-semibold text-[#1E3A8A]">
                {document.file_name}
                <span className="ml-2 text-xs font-normal text-slate-500">{document.description || ''}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="surface p-5">
        <h2 className="text-lg font-bold">Historique</h2>
        <div className="mt-4 space-y-3">
          {order.purchase_order_history?.map((history) => (
            <div key={history.id} className="rounded-md border border-slate-200 p-3">
              <p className="font-semibold">{history.action}</p>
              <p className="mt-1 text-sm text-slate-600">{history.description}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(history.created_at).toLocaleString('fr-FR')} - {history.actor?.full_name || '-'}</p>
            </div>
          ))}
          {(order.purchase_order_history?.length ?? 0) === 0 && <p className="text-sm text-slate-600">Aucun historique.</p>}
        </div>
      </section>

      {order.cancellation_reason && <section className="surface border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">Annulation : {order.cancellation_reason}</section>}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function InfoFlat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>
}
