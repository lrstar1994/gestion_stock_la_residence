import { Layers, Plus, Save, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles, listUnits } from '../../api/modules/catalog.api'
import { createPurchaseNeed, groupPurchaseNeeds, validatePurchaseNeeds } from '../../api/modules/purchaseNeeds.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Unit } from '../../lib/catalog'
import {
  needCalculationSourceLabels,
  needCalculationSources,
  needDestinationLabels,
  needDestinations,
  needTypeLabels,
  needTypes,
  needUrgencies,
  needUrgencyLabels,
  requestingServiceLabels,
  requestingServices,
} from '../../lib/purchaseNeeds'
import type { NeedCalculationSource, NeedDestination, NeedType, NeedUrgency, PurchaseNeedFormValues, RequestingService } from '../../lib/purchaseNeeds'
import type { Supplier } from '../../lib/suppliers'

type NeedLine = {
  article_id: string
  quantity: number
  unit_id: string
  price_input_amount: number
  budget: number
  requested_date: string
  comment: string
}

const emptyLine = (): NeedLine => ({
  article_id: '',
  quantity: 1,
  unit_id: '',
  price_input_amount: 0,
  budget: 0,
  requested_date: '',
  comment: '',
})

export function PurchaseNeedFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [common, setCommon] = useState({
    origin: 'demande_manuelle' as PurchaseNeedFormValues['origin'],
    type_de_besoin: 'besoin_ponctuel' as NeedType,
    destination_prevue: 'stock_general' as NeedDestination,
    source_du_calcul: 'saisie_manuelle' as NeedCalculationSource,
    service_demandeur: 'cuisine' as RequestingService,
    urgency: 'normal' as NeedUrgency,
    price_input_is_tax_excluded: false,
    vat_rate: 20,
    supplier_id: '',
  })
  const [lines, setLines] = useState<NeedLine[]>([emptyLine()])

  const filteredArticles = useMemo(() => articles.filter((article) => article.name.toLowerCase().includes(search.toLowerCase())), [articles, search])
  const totalHt = useMemo(() => lines.reduce((sum, line) => sum + estimateHt(line.price_input_amount, common.price_input_is_tax_excluded, common.vat_rate) * Number(line.quantity ?? 0), 0), [common.price_input_is_tax_excluded, common.vat_rate, lines])
  const totalTtc = useMemo(() => lines.reduce((sum, line) => sum + estimateTtc(line.price_input_amount, common.price_input_is_tax_excluded, common.vat_rate) * Number(line.quantity ?? 0), 0), [common.price_input_is_tax_excluded, common.vat_rate, lines])

  useEffect(() => {
    Promise.all([listArticles({ status: 'active', pageSize: 1000 }), listSuppliers(), listUnits()])
      .then(([articleResult, loadedSuppliers, loadedUnits]) => {
        setArticles([...articleResult.articles].sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })))
        setSuppliers(loadedSuppliers)
        setUnits(loadedUnits)
      })
      .catch(() => toast.error('Impossible de charger les articles.'))
  }, [])

  const updateCommon = <K extends keyof typeof common>(key: K, value: (typeof common)[K]) => {
    setCommon((current) => ({ ...current, [key]: value }))
  }

  const updateLine = (index: number, patch: Partial<NeedLine>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }

  const selectArticle = (index: number, articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    const supplier = suppliers.find((item) => item.name.toLowerCase() === (article?.default_supplier ?? '').toLowerCase())
    updateLine(index, { article_id: articleId, unit_id: article?.unit_id ?? '' })
    if (!common.supplier_id && supplier?.id) updateCommon('supplier_id', supplier.id)
  }

  const addLine = () => setLines((current) => [...current, emptyLine()])
  const removeLine = (index: number) => setLines((current) => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index))

  const save = async () => {
    try {
      if (!profile?.id) throw new Error('Profil utilisateur introuvable')
      const validLines = lines.filter((line) => line.article_id && line.quantity > 0 && line.unit_id)
      if (validLines.length === 0) throw new Error('Veuillez ajouter au moins un article')
      if (validLines.some((line) => Number(line.budget ?? 0) < 0)) throw new Error('Le budget ne peut pas etre negatif')

      setSaving(true)
      const createdIds: string[] = []
      for (const line of validLines) {
        createdIds.push(await createPurchaseNeed(toNeedValues(line), profile.id))
      }

      toast.success(`${createdIds.length} besoin(s) cree(s) avec succes`)

      if (createdIds.length > 1 && common.supplier_id) {
        if (profile.role === 'direction' && window.confirm('Ces besoins ont le meme fournisseur. Voulez-vous les valider et les regrouper maintenant ?')) {
          await validatePurchaseNeeds(createdIds, profile.id)
          await groupPurchaseNeeds(createdIds, common.supplier_id, profile.id)
          toast.success('Besoins valides et regroupes avec succes')
        } else if (profile.role !== 'direction') {
          toast.success('Regroupement possible apres validation Direction.')
        }
      }

      navigate('/purchase-needs')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    } finally {
      setSaving(false)
    }
  }

  const toNeedValues = (line: NeedLine): PurchaseNeedFormValues => {
    const estimatedPriceHt = estimateHt(line.price_input_amount, common.price_input_is_tax_excluded, common.vat_rate)
    return {
      article_id: line.article_id,
      quantity: Number(line.quantity),
      unit_id: line.unit_id,
      origin: common.origin,
      type_de_besoin: common.type_de_besoin,
      destination_prevue: common.destination_prevue,
      source_du_calcul: common.source_du_calcul,
      service_demandeur: common.service_demandeur,
      urgency: common.urgency,
      estimated_price: estimatedPriceHt,
      price_input_amount: Number(line.price_input_amount ?? 0),
      price_input_is_tax_excluded: common.price_input_is_tax_excluded,
      vat_rate: common.vat_rate,
      budget: Number(line.budget ?? 0),
      requested_date: line.requested_date,
      comment: line.comment,
      supplier_id: common.supplier_id,
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Achats</p>
        <h1 className="page-title mt-2">Nouveau besoin d'achat</h1>
        <p className="mt-2 text-sm text-slate-600">Ajoutez une ou plusieurs lignes. Chaque ligne creera un besoin separe, avec les informations communes ci-dessous.</p>
      </header>

      <section className="surface grid gap-5 p-5 lg:grid-cols-2">
        <Field label="Type de besoin"><select value={common.type_de_besoin} onChange={(event) => updateCommon('type_de_besoin', event.target.value as NeedType)} className="input mt-2">{needTypes.map((type) => <option key={type} value={type}>{needTypeLabels[type]}</option>)}</select></Field>
        <Field label="Destination prevue"><select value={common.destination_prevue} onChange={(event) => updateCommon('destination_prevue', event.target.value as NeedDestination)} className="input mt-2">{needDestinations.map((destination) => <option key={destination} value={destination}>{needDestinationLabels[destination]}</option>)}</select></Field>
        <Field label="Source du calcul"><select value={common.source_du_calcul} onChange={(event) => updateCommon('source_du_calcul', event.target.value as NeedCalculationSource)} className="input mt-2">{needCalculationSources.map((source) => <option key={source} value={source}>{needCalculationSourceLabels[source]}</option>)}</select></Field>
        <Field label="Service demandeur"><select value={common.service_demandeur} onChange={(event) => updateCommon('service_demandeur', event.target.value as RequestingService)} className="input mt-2">{requestingServices.map((service) => <option key={service} value={service}>{requestingServiceLabels[service]}</option>)}</select></Field>
        <Field label="Urgence"><select value={common.urgency} onChange={(event) => updateCommon('urgency', event.target.value as NeedUrgency)} className="input mt-2">{needUrgencies.map((urgency) => <option key={urgency} value={urgency}>{needUrgencyLabels[urgency]}</option>)}</select></Field>
        <Field label="Fournisseur cible commun"><select value={common.supplier_id} onChange={(event) => updateCommon('supplier_id', event.target.value)} className="input mt-2"><option value="">Aucun</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
          <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-[#1E3A8A]">
            Le prix sert uniquement a estimer et valider le besoin. Le cout matiere reel sera confirme a la reception ou a la facture.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input checked={common.price_input_is_tax_excluded} onChange={(event) => updateCommon('price_input_is_tax_excluded', event.target.checked)} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]" />
              Les prix saisis sont hors taxe
            </label>
            <Field label="Taux TVA estime"><input value={common.vat_rate} onChange={(event) => updateCommon('vat_rate', Number(event.target.value))} type="number" min="0" step="0.01" className="input mt-2" /></Field>
          </div>
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold">Articles demandes</h2>
            <p className="mt-1 text-sm text-slate-600">Si un fournisseur commun est choisi, la Direction pourra valider et regrouper ces lignes directement.</p>
          </div>
          <button type="button" onClick={addLine} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter une ligne</button>
        </div>

        <div className="border-b border-slate-200 px-5 py-4">
          <label className="block">
            <span className="field-label">Recherche article</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="input mt-2" placeholder="Rechercher un article" />
          </label>
        </div>

        <div className="divide-y divide-slate-200">
          {lines.map((line, index) => {
            const selectedArticle = articles.find((article) => article.id === line.article_id)
            const lineHt = estimateHt(line.price_input_amount, common.price_input_is_tax_excluded, common.vat_rate) * Number(line.quantity ?? 0)
            const lineTtc = estimateTtc(line.price_input_amount, common.price_input_is_tax_excluded, common.vat_rate) * Number(line.quantity ?? 0)
            return (
              <div key={index} className="grid gap-3 px-5 py-4 xl:grid-cols-[1.5fr_110px_120px_150px_140px_140px_1fr_44px] xl:items-end">
                <label className="block">
                  <span className="field-label">Article</span>
                  <select value={line.article_id} onChange={(event) => selectArticle(index, event.target.value)} className="input mt-2">
                    <option value="">Selectionner un article</option>
                    {filteredArticles.map((article) => <option key={article.id} value={article.id}>{article.name} - {article.families?.name}</option>)}
                  </select>
                  {selectedArticle?.min_stock ? <p className="mt-1 text-xs font-semibold text-[#1E3A8A]">Seuil minimum : {selectedArticle.min_stock}</p> : null}
                </label>
                <Field label="Quantite"><input value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} type="number" min="0" step="0.01" className="input mt-2" /></Field>
                <Field label="Unite d'achat"><select value={line.unit_id} onChange={(event) => updateLine(index, { unit_id: event.target.value })} className="input mt-2"><option value="">Unite</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.abbreviation}</option>)}</select>{selectedArticle?.units?.abbreviation && <p className="mt-1 text-xs text-slate-500">Stock : {selectedArticle.units.abbreviation}</p>}</Field>
                <Field label="Prix unitaire estime"><input value={line.price_input_amount} onChange={(event) => updateLine(index, { price_input_amount: Number(event.target.value) })} type="number" min="0" step="0.01" className="input mt-2" /></Field>
                <Field label="Budget prevu"><input value={line.budget} onChange={(event) => updateLine(index, { budget: Number(event.target.value) })} type="number" min="0" step="0.01" className="input mt-2" /></Field>
                <Field label="Date souhaitee"><input value={line.requested_date} onChange={(event) => updateLine(index, { requested_date: event.target.value })} type="date" className="input mt-2" /></Field>
                <label className="block">
                  <span className="field-label">Commentaire</span>
                  <input value={line.comment} onChange={(event) => updateLine(index, { comment: event.target.value })} className="input mt-2" />
                  <p className="mt-1 text-xs text-slate-500">HT {lineHt.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Ar / TTC {lineTtc.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Ar</p>
                </label>
                <button type="button" onClick={() => removeLine(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="surface flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-600">Total estime des lignes</p>
          <p className="mt-1 text-2xl font-black text-[#1E3A8A]">{totalHt.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Ar HT</p>
          <p className="text-sm font-semibold text-slate-500">{totalTtc.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Ar TTC estime</p>
        </div>
        {lines.length > 1 && common.supplier_id && (
          <div className="rounded-md border border-[#D4AF37]/30 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            <Layers className="mr-2 inline h-4 w-4" />
            Meme fournisseur cible : le regroupement sera propose apres creation.
          </div>
        )}
      </section>

      <div className="flex gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn-primary disabled:opacity-60"><Save className="mr-2 h-4 w-4" /> {saving ? 'Enregistrement...' : 'Enregistrer les besoins'}</button>
        <Link to="/purchase-needs" className="btn-secondary">Annuler</Link>
      </div>
    </div>
  )
}

function estimateHt(amount: number, isHt: boolean, vatRate: number) {
  const value = Number(amount ?? 0)
  return isHt ? value : value / (1 + Number(vatRate ?? 0) / 100)
}

function estimateTtc(amount: number, isHt: boolean, vatRate: number) {
  const value = Number(amount ?? 0)
  return isHt ? value * (1 + Number(vatRate ?? 0) / 100) : value
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}
