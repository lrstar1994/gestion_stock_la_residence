import { Layers, Plus, Save, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import { listArticles, listUnits } from '../../api/modules/catalog.api'
import { createPurchaseNeed, listPurchaseIntendedUses } from '../../api/modules/purchaseNeeds.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { ArticleSearchSelect } from '../../components/articles/ArticleSearchSelect'
import { QuickArticleDrawer } from '../../components/articles/QuickArticleDrawer'
import { QuickSupplierDrawer } from '../../components/suppliers/QuickSupplierDrawer'
import { SupplierSearchSelect } from '../../components/suppliers/SupplierSearchSelect'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Unit } from '../../lib/catalog'
import {
  needCalculationSourceLabels,
  needCalculationSources,
  businessOriginLabels,
  businessOrigins,
  needTypeLabels,
  needTypes,
  needUrgencies,
  needUrgencyLabels,
  requestingServiceLabels,
  requestingServices,
  taxTreatmentLabels,
  taxTreatments,
} from '../../lib/purchaseNeeds'
import { supplyDifficulties, supplyDifficultyLabels } from '../../lib/purchaseNeeds'
import type { BusinessOrigin, NeedCalculationSource, NeedType, NeedUrgency, PurchaseNeedFormValues, PurchaseIntendedUse, RequestingService, SupplyDifficulty, TaxTreatment } from '../../lib/purchaseNeeds'
import type { Supplier } from '../../lib/suppliers'

type NeedLine = {
  article_id: string
  quantity: number
  unit_id: string
  price_input_amount: number
  budget: number
  requested_date: string
  intended_use_id: string
  comment: string
  tax_treatment: TaxTreatment
  vat_rate: number
}

const emptyLine = (): NeedLine => ({
  article_id: '',
  quantity: 1,
  unit_id: '',
  price_input_amount: 0,
  budget: 0,
  requested_date: '',
  intended_use_id: '',
  comment: '',
  tax_treatment: 'ttc_included',
  vat_rate: 20,
})

export function PurchaseNeedFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [intendedUses, setIntendedUses] = useState<PurchaseIntendedUse[]>([])
  const [intendedUsesError, setIntendedUsesError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false)
  const [quickArticleOpen, setQuickArticleOpen] = useState(false)
  const [quickArticleLineIndex, setQuickArticleLineIndex] = useState<number | null>(null)
  const [common, setCommon] = useState({
    origin: 'demande_manuelle' as PurchaseNeedFormValues['origin'],
    type_de_besoin: 'besoin_ponctuel' as NeedType,
    business_origin: 'mise_en_place' as BusinessOrigin,
    supply_difficulty: 'facile' as SupplyDifficulty,
    justification: '',
    source_du_calcul: 'saisie_manuelle' as NeedCalculationSource,
    service_demandeur: 'cuisine' as RequestingService,
    urgency: 'normal' as NeedUrgency,
    vat_rate: 20,
    supplier_id: '',
  })
  const [lines, setLines] = useState<NeedLine[]>([emptyLine()])
  const [draftHydrated, setDraftHydrated] = useState(false)
  const draftKey = 'purchase-needs-new-draft'

  const totalPayable = useMemo(() => lines.reduce((sum, line) => sum + calculateLine(line.price_input_amount, line.tax_treatment, line.vat_rate).payable * Number(line.quantity ?? 0), 0), [lines])

  useEffect(() => {
    Promise.allSettled([listArticles({ status: 'active', pageSize: 1000 }), listSuppliers(), listUnits(), listPurchaseIntendedUses()])
      .then(([articleResult, supplierResult, unitResult, intendedUseResult]) => {
        if (articleResult.status === 'fulfilled') setArticles([...articleResult.value.articles].sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })))
        else toast.error(`Articles indisponibles : ${toErrorMessage(articleResult.reason)}`)
        if (supplierResult.status === 'fulfilled') setSuppliers(supplierResult.value)
        else toast.error(`Fournisseurs indisponibles : ${toErrorMessage(supplierResult.reason)}`)
        if (unitResult.status === 'fulfilled') setUnits(unitResult.value)
        else toast.error(`Unités indisponibles : ${toErrorMessage(unitResult.reason)}`)
        if (intendedUseResult.status === 'fulfilled') {
          setIntendedUses(intendedUseResult.value)
          setIntendedUsesError(null)
        } else {
          const message = toErrorMessage(intendedUseResult.reason)
          setIntendedUsesError(message)
          toast.error(`Utilisations prévues indisponibles : ${message}`)
        }
      })
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft.common) setCommon((current) => ({ ...current, ...draft.common }))
        if (Array.isArray(draft.lines) && draft.lines.length > 0) setLines(draft.lines)
      }
    } catch {
      // Un brouillon corrompu ne doit pas empêcher la saisie.
    } finally {
      setDraftHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!draftHydrated) return
    window.localStorage.setItem(draftKey, JSON.stringify({ common, lines }))
  }, [common, draftHydrated, lines])

  const updateCommon = <K extends keyof typeof common>(key: K, value: (typeof common)[K]) => {
    setCommon((current) => ({ ...current, [key]: value }))
  }

  const updateLine = (index: number, patch: Partial<NeedLine>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line))
  }

  const selectArticle = (index: number, articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    const indicativePrice = Number(article?.indicative_price ?? 0)
    const suggestedInputPrice = indicativePrice > 0 ? (lines[index].tax_treatment === 'ht_add_vat' ? indicativePrice : indicativePrice * (1 + lines[index].vat_rate / 100)) : 0
    updateLine(index, { article_id: articleId, unit_id: article?.unit_id ?? '', price_input_amount: suggestedInputPrice })
  }

  const addLine = () => setLines((current) => [...current, emptyLine()])
  const removeLine = (index: number) => setLines((current) => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index))

  const save = async () => {
    try {
      if (!profile?.id) throw new Error('Profil utilisateur introuvable')
      const validLines = lines.filter((line) => line.article_id && line.quantity > 0 && line.unit_id)
      if (validLines.length === 0) throw new Error('Veuillez ajouter au moins un article')
      if (intendedUsesError) throw new Error(`Utilisations prévues indisponibles : ${intendedUsesError}`)
      if (intendedUses.length === 0) throw new Error('Aucune utilisation prévue active n’est disponible.')
      if (validLines.some((line) => !line.intended_use_id || !line.requested_date)) throw new Error('Chaque ligne doit préciser une utilisation prévue et une date de besoin.')
      if (validLines.some((line) => Number(line.budget ?? 0) < 0)) throw new Error('Le budget ne peut pas etre negatif')

      setSaving(true)
      const createdIds: string[] = []
      for (const line of validLines) {
        createdIds.push(await createPurchaseNeed(toNeedValues(line), profile.id))
      }

      toast.success(`${createdIds.length} besoin(s) cree(s) avec succes`)

      window.localStorage.removeItem(draftKey)
      navigate('/purchase-needs')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Erreur technique inconnue.'
      toast.error(`L’enregistrement a échoué. Vos lignes sont conservées. ${reason}`)
    } finally {
      setSaving(false)
    }
  }

  const toNeedValues = (line: NeedLine): PurchaseNeedFormValues => {
    const estimatedPriceHt = calculateLine(line.price_input_amount, line.tax_treatment, line.vat_rate).ht
    return {
      article_id: line.article_id,
      quantity: Number(line.quantity),
      unit_id: line.unit_id,
      origin: common.origin,
      type_de_besoin: common.type_de_besoin,
      destination_prevue: 'stock_general',
      source_du_calcul: common.source_du_calcul,
      service_demandeur: common.service_demandeur,
      urgency: common.urgency,
      estimated_price: estimatedPriceHt,
      price_input_amount: Number(line.price_input_amount ?? 0),
      price_input_is_tax_excluded: line.tax_treatment === 'ht_add_vat',
      tax_treatment: line.tax_treatment,
      vat_rate: line.vat_rate,
      budget: Number(line.budget ?? 0),
      requested_date: line.requested_date,
      comment: line.comment,
      supplier_id: common.supplier_id,
      business_origin: common.business_origin,
      intended_use_id: line.intended_use_id,
      supply_difficulty: common.supply_difficulty,
      justification: common.justification,
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Achats</p>
        <h1 className="page-title mt-2">Nouveau besoin d'achat</h1>
        <p className="mt-2 text-sm text-slate-600">Ajoutez une ou plusieurs lignes. Chaque ligne créera un besoin séparé ; l’utilisation prévue et la date de besoin restent propres à chaque ligne.</p>
      </header>

      <section className="surface grid gap-5 p-5 lg:grid-cols-2">
        <Field label="Type de besoin"><select value={common.type_de_besoin} onChange={(event) => updateCommon('type_de_besoin', event.target.value as NeedType)} className="input mt-2">{needTypes.map((type) => <option key={type} value={type}>{needTypeLabels[type]}</option>)}</select></Field>
        <Field label="Origine du besoin"><select value={common.business_origin} onChange={(event) => updateCommon('business_origin', event.target.value as BusinessOrigin)} className="input mt-2">{businessOrigins.map((origin) => <option key={origin} value={origin}>{businessOriginLabels[origin]}</option>)}</select></Field>
        <Field label="Source du calcul"><select value={common.source_du_calcul} onChange={(event) => updateCommon('source_du_calcul', event.target.value as NeedCalculationSource)} className="input mt-2">{needCalculationSources.map((source) => <option key={source} value={source}>{needCalculationSourceLabels[source]}</option>)}</select></Field>
        <Field label="Service demandeur"><select value={common.service_demandeur} onChange={(event) => updateCommon('service_demandeur', event.target.value as RequestingService)} className="input mt-2">{requestingServices.map((service) => <option key={service} value={service}>{requestingServiceLabels[service]}</option>)}</select></Field>
        <Field label="Urgence"><select value={common.urgency} onChange={(event) => updateCommon('urgency', event.target.value as NeedUrgency)} className="input mt-2">{needUrgencies.map((urgency) => <option key={urgency} value={urgency}>{needUrgencyLabels[urgency]}</option>)}</select></Field>
        <Field label="Difficulté d’approvisionnement"><select value={common.supply_difficulty} onChange={(event) => updateCommon('supply_difficulty', event.target.value as SupplyDifficulty)} className="input mt-2">{supplyDifficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{supplyDifficultyLabels[difficulty]}</option>)}</select></Field>
        <Field label="Justification du besoin"><textarea value={common.justification} onChange={(event) => updateCommon('justification', event.target.value)} className="input mt-2 min-h-24" placeholder="À quoi servira cet achat ? Ex. Pour mariage du 12/08" /></Field>
        <Field label="Fournisseur suggéré (optionnel)"><div className="mt-2"><SupplierSearchSelect suppliers={suppliers} value={common.supplier_id} onChange={(supplierId) => updateCommon('supplier_id', supplierId)} onCreate={() => setQuickSupplierOpen(true)} /></div><p className="mt-1 text-xs text-slate-500">Suggestion uniquement : la Direction pourra choisir ou modifier le fournisseur lors de l’orientation.</p></Field>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
          <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-[#1E3A8A]">
            Le prix sert uniquement a estimer et valider le besoin. Le cout matiere reel sera confirme a la reception ou a la facture.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <p className="text-sm text-slate-600 md:col-span-2">Le traitement TVA et le taux sont choisis séparément pour chaque article.</p>
          </div>
        </div>
      </section>

      {intendedUsesError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">Impossible de charger les utilisations prévues : {intendedUsesError}</p>}
      <section className="surface border-l-4 border-blue-500 p-4 text-sm text-slate-700">
        {common.business_origin === 'renouvellement_stock' && <p><strong>Renouvellement de stock :</strong> le seuil minimum de l’article est affiché sur sa ligne lorsqu’il est disponible. Le stock actuel et une quantité suggérée nécessitent une source stock dédiée et ne sont pas recalculés ici.</p>}
        {common.business_origin === 'production_fiche' && <p><strong>Production / fiche technique :</strong> les liens événement ou fiche technique restent portés par les parcours spécialisés. Aucun ordre de production n’est créé automatiquement.</p>}
        {common.business_origin === 'mise_en_place' && <p><strong>Mise en place :</strong> aucune information technique supplémentaire n’est obligatoire à ce stade.</p>}
        {common.business_origin === 'opportunite_achat' && <p><strong>Opportunité d’achat :</strong> le fournisseur suggéré et le prix proposé peuvent être renseignés par ligne. Aucune date limite dédiée n’est inventée.</p>}
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold">Articles demandes</h2>
            <p className="mt-1 text-sm text-slate-600">Si un fournisseur commun est choisi, la Direction pourra valider et regrouper ces lignes directement.</p>
          </div>
          <button type="button" onClick={addLine} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter une ligne</button>
        </div>

        <div className="divide-y divide-slate-200">
          {lines.map((line, index) => {
            const selectedArticle = articles.find((article) => article.id === line.article_id)
            const calculated = calculateLine(line.price_input_amount, line.tax_treatment, line.vat_rate)
            const lineHt = calculated.ht * Number(line.quantity ?? 0)
            const lineTtc = calculated.ttc * Number(line.quantity ?? 0)
            const linePayable = calculated.payable * Number(line.quantity ?? 0)
            return (
              <div key={index} className="grid gap-3 px-5 py-4 xl:grid-cols-[1.5fr_110px_120px_150px_140px_140px_1fr_44px] xl:items-end">
                <label className="block">
                  <span className="field-label">Article</span>
                  <div className="mt-2"><ArticleSearchSelect articles={articles} value={line.article_id} onChange={(articleId) => selectArticle(index, articleId)} onCreate={() => { setQuickArticleLineIndex(index); setQuickArticleOpen(true) }} /></div>
                  {selectedArticle?.min_stock ? <p className="mt-1 text-xs font-semibold text-[#1E3A8A]">Seuil minimum : {selectedArticle.min_stock}</p> : null}
                  {selectedArticle?.default_supplier ? <p className="mt-1 text-xs text-slate-500">Fournisseur suggéré : {selectedArticle.default_supplier}</p> : null}
                </label>
                <Field label="Unite d achat (stock par defaut)"><select value={line.unit_id} onChange={(event) => updateLine(index, { unit_id: event.target.value })} className="input mt-2"><option value="">Unite non definie</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}</select>{selectedArticle?.units?.abbreviation && <p className="mt-1 text-xs text-slate-500">Unite de stock liee : {selectedArticle.units.abbreviation}</p>}</Field>
                <Field label="Quantite"><input value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} type="number" min="0" step="0.01" className="input mt-2" /></Field>
                <Field label="Prix unitaire estime"><input value={line.price_input_amount} onChange={(event) => updateLine(index, { price_input_amount: Number(event.target.value) })} type="number" min="0" step="0.01" className="input mt-2" /></Field>
                <Field label="Traitement TVA"><select value={line.tax_treatment} onChange={(event) => updateLine(index, { tax_treatment: event.target.value as TaxTreatment })} className="input mt-2">{taxTreatments.map((treatment) => <option key={treatment} value={treatment}>{taxTreatmentLabels[treatment]}</option>)}</select></Field>
                <Field label="Taux TVA"><input disabled={line.tax_treatment === 'no_vat'} value={line.tax_treatment === 'no_vat' ? 0 : line.vat_rate} onChange={(event) => updateLine(index, { vat_rate: Number(event.target.value) })} type="number" min="0" step="0.01" className="input mt-2" /></Field>
                <Field label="Montant estimé à payer"><input value={linePayable} readOnly className="input mt-2 bg-slate-100" /></Field>
                <Field label="Utilisation prévue"><select value={line.intended_use_id} onChange={(event) => updateLine(index, { intended_use_id: event.target.value })} className="input mt-2" disabled={Boolean(intendedUsesError)}><option value="">Choisir</option>{intendedUses.map((use) => <option key={use.id} value={use.id}>{use.label}</option>)}</select></Field>
                <Field label="Date de besoin"><input value={line.requested_date} onChange={(event) => updateLine(index, { requested_date: event.target.value })} type="date" className="input mt-2" /></Field>
                <label className="block">
                  <span className="field-label">Commentaire</span>
                  <input value={line.comment} onChange={(event) => updateLine(index, { comment: event.target.value })} className="input mt-2" />
                  <p className="mt-1 text-xs text-slate-500">HT {lineHt.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Ar / TVA {(lineTtc - lineHt).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Ar / TTC {lineTtc.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Ar</p>
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
          <p className="mt-1 text-2xl font-black text-[#1E3A8A]">{totalPayable.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Ar</p>
          <p className="text-sm font-semibold text-slate-500">Montant total estimé à payer</p>
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
      <QuickSupplierDrawer
        open={quickSupplierOpen}
        profileId={profile?.id}
        onClose={() => setQuickSupplierOpen(false)}
        onCreated={(supplier) => {
          setSuppliers((current) => [supplier, ...current.filter((item) => item.id !== supplier.id)])
          updateCommon('supplier_id', supplier.id)
          setQuickSupplierOpen(false)
        }}
      />
      <QuickArticleDrawer
        open={quickArticleOpen}
        profileId={profile?.id}
        defaultSupplierId={common.supplier_id}
        onClose={() => { setQuickArticleOpen(false); setQuickArticleLineIndex(null) }}
        onCreated={(article) => {
          setArticles((current) => [article, ...current.filter((item) => item.id !== article.id)])
          if (quickArticleLineIndex !== null) updateLine(quickArticleLineIndex, { article_id: article.id, unit_id: article.unit_id })
        }}
      />
    </div>
  )
}

function calculateLine(amount: number, treatment: TaxTreatment, vatRate: number) {
  const input = Number(amount ?? 0)
  const rate = treatment === 'no_vat' ? 0 : Number(vatRate ?? 0)
  const ht = treatment === 'ht_add_vat' ? input : treatment === 'ttc_included' ? input / (1 + rate / 100) : input
  const ttc = treatment === 'ht_add_vat' ? input * (1 + rate / 100) : input
  return { ht, ttc, payable: treatment === 'ht_add_vat' ? ttc : input }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String((error as { message?: unknown }).message ?? 'Erreur inconnue')
  return 'Erreur technique inconnue.'
}
