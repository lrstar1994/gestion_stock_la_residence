import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { listArticles, listUnits } from '../../api/modules/catalog.api'
import { createCashPurchase } from '../../api/modules/cashPurchases.api'
import { createPurchaseNeed } from '../../api/modules/purchaseNeeds.api'
import { createPurchaseOrder } from '../../api/modules/purchaseOrders.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Unit } from '../../lib/catalog'
import { canCreateCashPurchases, cashPurchaseSourceLabels, cashPurchaseSources } from '../../lib/cashPurchases'
import type { CashPurchaseSource } from '../../lib/cashPurchases'
import {
  needDestinationLabels,
  needDestinations,
  needTypeLabels,
  needTypes,
  needUrgencyLabels,
  requestingServiceLabels,
  requestingServices,
} from '../../lib/purchaseNeeds'
import type { NeedDestination, NeedType, NeedUrgency, RequestingService } from '../../lib/purchaseNeeds'
import { canCreatePurchaseOrders } from '../../lib/purchaseOrders'
import type { Supplier } from '../../lib/suppliers'

type PurchaseTreatment = 'need' | 'cash' | 'order'
type PriorityReason = 'client_immediat' | 'rupture_stock' | 'oubli_prevision' | 'produit_manquant' | 'evenement_proche' | 'autre'

type WizardLine = {
  article_id: string
  quantity: number
  unit_id: string
  desired_date: string
  unit_price: number
  comment: string
  treatment: PurchaseTreatment
}

const today = new Date().toISOString().slice(0, 10)

const priorityReasonLabels: Record<PriorityReason, string> = {
  client_immediat: 'Besoin client immediat',
  rupture_stock: 'Rupture de stock',
  oubli_prevision: 'Erreur / oubli de prevision',
  produit_manquant: 'Produit refuse ou manquant',
  evenement_proche: 'Besoin evenement proche',
  autre: 'Autre a preciser',
}

const treatmentLabels: Record<PurchaseTreatment, string> = {
  need: "Besoin d'achat",
  cash: 'Achat especes',
  order: 'Commande fournisseur',
}

export function PurchaseWizardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [treatment, setTreatment] = useState<PurchaseTreatment>('need')
  const [supplierId, setSupplierId] = useState('')
  const [cashSource, setCashSource] = useState<CashPurchaseSource>('caisse_principale')
  const [needType, setNeedType] = useState<NeedType>('besoin_ponctuel')
  const [destination, setDestination] = useState<NeedDestination>('stock_general')
  const [service, setService] = useState<RequestingService>('cuisine')
  const [urgency, setUrgency] = useState<NeedUrgency>('normal')
  const [priorityReason, setPriorityReason] = useState<PriorityReason>('rupture_stock')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<WizardLine[]>([emptyLine('need')])
  const canCreateCash = canCreateCashPurchases(profile?.role)
  const canCreateOrder = canCreatePurchaseOrders(profile?.role)
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity ?? 0) * Number(line.unit_price ?? 0), 0), [lines])

  useEffect(() => {
    Promise.all([listArticles({ status: 'active', pageSize: 1000 }), listUnits(), listSuppliers()])
      .then(([articleResult, loadedUnits, loadedSuppliers]) => {
        setArticles([...articleResult.articles].sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })))
        setUnits(loadedUnits)
        setSuppliers(loadedSuppliers)
      })
      .catch(() => toast.error('Impossible de charger les donnees.'))
  }, [])

  const applyTreatmentToAll = (next: PurchaseTreatment) => {
    setTreatment(next)
    setLines((current) => current.map((line) => ({ ...line, treatment: next })))
  }

  const addLine = () => setLines((current) => [...current, emptyLine(treatment)])
  const updateLine = (index: number, patch: Partial<WizardLine>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }
  const removeLine = (index: number) => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))

  const selectArticle = (index: number, articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    updateLine(index, { article_id: articleId, unit_id: article?.unit_id ?? '' })
  }

  const submit = async () => {
    try {
      if (!profile?.id) throw new Error('Profil utilisateur introuvable')
      const validLines = lines.filter((line) => line.article_id && line.quantity > 0 && line.unit_id)
      if (validLines.length === 0) throw new Error('Veuillez ajouter au moins un article')
      if (urgency === 'urgent' && !reason.trim()) throw new Error('Veuillez renseigner le motif de priorite')

      const needLines = validLines.filter((line) => line.treatment === 'need')
      const cashLines = validLines.filter((line) => line.treatment === 'cash')
      const orderLines = validLines.filter((line) => line.treatment === 'order')
      if (cashLines.length > 0 && !canCreateCash) throw new Error("Votre role ne permet pas de creer un achat en especes")
      if (orderLines.length > 0 && !canCreateOrder) throw new Error("Votre role ne permet pas de creer une commande fournisseur")

      for (const line of needLines) {
        await createPurchaseNeed({
          article_id: line.article_id,
          quantity: line.quantity,
          unit_id: line.unit_id,
          origin: 'demande_manuelle',
          type_de_besoin: needType,
          destination_prevue: destination,
          source_du_calcul: 'saisie_manuelle',
          service_demandeur: service,
          urgency: urgency === 'urgent' ? 'urgent' : 'normal',
          estimated_price: line.unit_price,
          price_input_amount: line.unit_price,
          price_input_is_tax_excluded: true,
          vat_rate: 20,
          budget: line.quantity * line.unit_price,
          requested_date: line.desired_date,
          comment: buildLineComment(line),
          supplier_id: supplierId,
        }, profile.id)
      }

      let cashId: string | null = null
      if (cashLines.length > 0) {
        cashId = await createCashPurchase({
          buyer_id: profile.id,
          cash_source: cashSource,
          reason: buildGlobalReason('Achat especes'),
          request_date: today,
          purchase_date: firstDesiredDate(cashLines),
          items: cashLines.map((line) => ({
            article_id: line.article_id,
            quantity_planned: line.quantity,
            unit_id: line.unit_id,
            unit_price_estimated: line.unit_price,
          })),
        }, profile.id)
      }

      let orderId: string | null = null
      if (orderLines.length > 0) {
        if (!supplierId) throw new Error('Veuillez choisir un fournisseur pour la commande')
        orderId = await createPurchaseOrder({
          supplier_id: supplierId,
          order_date: today,
          delivery_date: firstDesiredDate(orderLines) || today,
          supplier_reference: '',
          payment_terms: '',
          delivery_mode: '',
          comment: buildGlobalReason('Commande fournisseur'),
          group_id: '',
          need_ids: [],
          items: orderLines.map((line) => ({
            article_id: line.article_id,
            quantity_ordered: line.quantity,
            unit_id: line.unit_id,
            unit_price: line.unit_price,
            comment: buildLineComment(line),
          })),
        }, profile.id)
      }

      toast.success('Traitement achat cree avec succes')
      if (orderId) navigate(`/purchase-orders/${orderId}`)
      else if (cashId) navigate(`/cash-purchases/${cashId}`)
      else navigate('/purchase-needs')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  const buildGlobalReason = (label: string) => {
    const priority = urgency === 'urgent' ? `Urgent - ${priorityReasonLabels[priorityReason]}` : 'Priorite normale'
    return `${label}. ${priority}${reason.trim() ? ` - ${reason.trim()}` : ''}`
  }

  const buildLineComment = (line: WizardLine) => {
    return [line.comment, urgency === 'urgent' ? `Urgent : ${priorityReasonLabels[priorityReason]}` : ''].filter(Boolean).join(' - ')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Achats</p>
          <h1 className="page-title mt-2">Assistant achat</h1>
          <p className="mt-2 text-sm text-slate-600">Saisissez les articles une seule fois, puis choisissez le bon traitement.</p>
        </div>
        <button type="button" onClick={submit} className="btn-primary"><ArrowRight className="mr-2 h-4 w-4" /> Creer le traitement</button>
      </header>

      <section className="surface grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Traitement principal">
          <select value={treatment} onChange={(event) => applyTreatmentToAll(event.target.value as PurchaseTreatment)} className="input mt-2">
            <option value="need">A prevoir : besoin d'achat</option>
            {canCreateCash && <option value="cash">A acheter maintenant en especes</option>}
            {canCreateOrder && <option value="order">A commander a un fournisseur</option>}
          </select>
        </Field>
        <Field label="Fournisseur">
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="input mt-2">
            <option value="">A choisir plus tard</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </Field>
        <Field label="Paiement especes">
          <select value={cashSource} onChange={(event) => setCashSource(event.target.value as CashPurchaseSource)} className="input mt-2">
            {cashPurchaseSources.map((source) => <option key={source} value={source}>{cashPurchaseSourceLabels[source]}</option>)}
          </select>
        </Field>
        <Field label="Priorite">
          <select value={urgency} onChange={(event) => setUrgency(event.target.value as NeedUrgency)} className="input mt-2">
            <option value="normal">{needUrgencyLabels.normal}</option>
            <option value="urgent">{needUrgencyLabels.urgent}</option>
          </select>
        </Field>
        {urgency === 'urgent' && (
          <>
            <Field label="Motif de priorite">
              <select value={priorityReason} onChange={(event) => setPriorityReason(event.target.value as PriorityReason)} className="input mt-2">
                {Object.entries(priorityReasonLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </Field>
            <label className="block xl:col-span-3">
              <span className="field-label">Precision obligatoire</span>
              <input value={reason} onChange={(event) => setReason(event.target.value)} className="input mt-2" placeholder="Expliquez pourquoi c'est urgent" />
            </label>
          </>
        )}
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Type de besoin">
          <select value={needType} onChange={(event) => setNeedType(event.target.value as NeedType)} className="input mt-2">
            {needTypes.map((type) => <option key={type} value={type}>{needTypeLabels[type]}</option>)}
          </select>
        </Field>
        <Field label="Destination prevue">
          <select value={destination} onChange={(event) => setDestination(event.target.value as NeedDestination)} className="input mt-2">
            {needDestinations.map((item) => <option key={item} value={item}>{needDestinationLabels[item]}</option>)}
          </select>
        </Field>
        <Field label="Service demandeur">
          <select value={service} onChange={(event) => setService(event.target.value as RequestingService)} className="input mt-2">
            {requestingServices.map((item) => <option key={item} value={item}>{requestingServiceLabels[item]}</option>)}
          </select>
        </Field>
        <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase text-[#1E3A8A]">Total estime</p>
          <p className="mt-2 text-2xl font-black text-[#10285f]">{total.toLocaleString('fr-FR')} Ar</p>
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold">Panier achat</h2>
          <button type="button" onClick={addLine} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button>
        </div>
        <div className="divide-y divide-slate-200">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-3 px-5 py-4 xl:grid-cols-[1.4fr_110px_110px_130px_140px_1fr_170px_44px] xl:items-center">
              <select value={line.article_id} onChange={(event) => selectArticle(index, event.target.value)} className="input">
                <option value="">Article</option>
                {articles.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}
              </select>
              <input value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} type="number" min="0" step="0.01" className="input" />
              <select value={line.unit_id} onChange={(event) => updateLine(index, { unit_id: event.target.value })} className="input">
                <option value="">Unite</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.abbreviation}</option>)}
              </select>
              <input value={line.unit_price} onChange={(event) => updateLine(index, { unit_price: Number(event.target.value) })} type="number" min="0" step="0.01" className="input" placeholder="Prix" />
              <input value={line.desired_date} onChange={(event) => updateLine(index, { desired_date: event.target.value })} type="date" className="input" />
              <input value={line.comment} onChange={(event) => updateLine(index, { comment: event.target.value })} className="input" placeholder="Commentaire" />
              <select value={line.treatment} onChange={(event) => updateLine(index, { treatment: event.target.value as PurchaseTreatment })} className="input">
                <option value="need">{treatmentLabels.need}</option>
                {canCreateCash && <option value="cash">{treatmentLabels.cash}</option>}
                {canCreateOrder && <option value="order">{treatmentLabels.order}</option>}
              </select>
              <button type="button" onClick={() => removeLine(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function emptyLine(treatment: PurchaseTreatment): WizardLine {
  return {
    article_id: '',
    quantity: 1,
    unit_id: '',
    desired_date: '',
    unit_price: 0,
    comment: '',
    treatment,
  }
}

function firstDesiredDate(lines: WizardLine[]) {
  return lines.find((line) => line.desired_date)?.desired_date || ''
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}
