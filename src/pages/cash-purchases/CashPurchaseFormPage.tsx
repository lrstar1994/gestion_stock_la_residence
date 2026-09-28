import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { listArticles, listUnits } from '../../api/modules/catalog.api'
import { createCashPurchase } from '../../api/modules/cashPurchases.api'
import { listPurchaseNeedsGlobal } from '../../api/modules/purchaseNeeds.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { QuickSupplierDrawer } from '../../components/suppliers/QuickSupplierDrawer'
import { ArticleSearchSelect } from '../../components/articles/ArticleSearchSelect'
import { QuickArticleDrawer } from '../../components/articles/QuickArticleDrawer'
import { useAuth } from '../../hooks/useAuth'
import { calculateCashTotals, cashPurchaseSourceLabels, cashPurchaseSources } from '../../lib/cashPurchases'
import type { CashPurchaseFormValues, CashPurchaseItemFormValues, CashPurchaseSource } from '../../lib/cashPurchases'
import type { Article, Unit } from '../../lib/catalog'
import type { PurchaseNeedGlobal } from '../../lib/purchaseNeeds'
import type { Supplier } from '../../lib/suppliers'
import { getUnitConversionFactor } from '../../lib/unitConversions'

export function CashPurchaseFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [articles, setArticles] = useState<Article[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [needs, setNeeds] = useState<PurchaseNeedGlobal[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false)
  const [quickArticleOpen, setQuickArticleOpen] = useState(false)
  const [quickArticleIndex, setQuickArticleIndex] = useState<number | null>(null)
  const [articlesLoaded, setArticlesLoaded] = useState(false)
  const [values, setValues] = useState<CashPurchaseFormValues>({
    buyer_id: profile?.id ?? '',
    supplier_id: '',
    cash_source: 'caisse_principale',
    reason: '',
    request_date: new Date().toISOString().slice(0, 10),
    purchase_date: '',
    items: [],
  })
  const total = useMemo(() => calculateCashTotals(values.items), [values.items])

  useEffect(() => {
    setValues((current) => ({ ...current, buyer_id: profile?.id ?? current.buyer_id }))
  }, [profile?.id])

  useEffect(() => {
    Promise.allSettled([
      listArticles({ status: 'active', pageSize: 1000 }),
      listUnits(),
      listPurchaseNeedsGlobal({ status: 'valide', pageSize: 1000 }),
      listSuppliers(),
    ])
      .then(([articleResult, unitsResult, needsResult, suppliersResult]) => {
        if (articleResult.status === 'fulfilled') {
          setArticles([...articleResult.value.articles].sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })))
        } else {
          toast.error('Impossible de charger les articles.')
        }
        setArticlesLoaded(true)
        if (unitsResult.status === 'fulfilled') setUnits(unitsResult.value)
        else toast.error('Impossible de charger les unites.')
        if (needsResult.status === 'fulfilled') setNeeds(needsResult.value.needs)
        else toast.error("Impossible de charger les besoins d'achat.")
        if (suppliersResult.status === 'fulfilled') setSuppliers(suppliersResult.value)
        else toast.error('Impossible de charger les fournisseurs.')
      })
  }, [])

  useEffect(() => {
    if (!supplierSearch.trim()) return
    const timer = window.setTimeout(() => {
      listSuppliers(supplierSearch).then(setSuppliers).catch(() => toast.error('Recherche fournisseur impossible.'))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [supplierSearch])

  useEffect(() => {
    const requestedIds = (searchParams.get('needIds') ?? '').split(',').map((value) => value.trim()).filter(Boolean)
    if (requestedIds.length === 0 || needs.length === 0) return
    setValues((current) => {
      const existingIds = new Set(current.items.map((item) => item.purchase_need_id).filter(Boolean))
      const imported = needs.filter((need) => requestedIds.includes(need.id) && !existingIds.has(need.id)).map((need) => {
        const quantity = Number(need.quantity) > 0 ? Number(need.quantity) : Number(need.quantity_needed ?? 0)
        const unitPrice = Number(need.estimated_price) > 0
          ? Number(need.estimated_price)
          : Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0) / Math.max(1, quantity)
        return {
          article_mode: 'catalog' as const,
          purchase_need_id: need.id,
          article_id: need.article_id,
          free_designation: '',
          quantity_planned: quantity,
          unit_id: need.unit_id,
          stock_unit_id: articles.find((article) => article.id === need.article_id)?.unit_id ?? need.unit_id,
          conversion_factor: 1,
          quantity_planned_stock: quantity,
          unit_price_estimated: unitPrice,
          unit_price_estimated_stock: unitPrice,
        }
      })
      if (imported.length === 0) return current
      return {
        ...current,
        supplier_id: current.supplier_id || needs.find((need) => requestedIds.includes(need.id))?.supplier_id || '',
        reason: current.reason || 'Achat espèces depuis besoins validés',
        items: [...current.items, ...imported],
      }
    })
  }, [articles, needs, searchParams])

  const addItem = () => {
    const article = articles[0]
    setValues((current) => ({
      ...current,
      items: [...current.items, {
        article_mode: article ? 'catalog' : 'free',
        article_id: article?.id ?? '',
        free_designation: '',
        quantity_planned: 1,
        unit_id: article?.unit_id ?? '',
        stock_unit_id: article?.unit_id ?? '',
        conversion_factor: 1,
        quantity_planned_stock: 1,
        unit_price_estimated: 0,
        unit_price_estimated_stock: 0,
      }],
    }))
  }

  const addNeed = (need: PurchaseNeedGlobal) => {
    if (values.items.some((item) => item.purchase_need_id === need.id)) return
    setValues((current) => ({
      ...current,
      items: [...current.items, {
        article_mode: 'catalog',
        purchase_need_id: need.id,
        article_id: need.article_id,
        free_designation: '',
        quantity_planned: Number(need.quantity) > 0 ? Number(need.quantity) : Number(need.quantity_needed ?? 0),
        unit_id: need.unit_id,
        stock_unit_id: articles.find((article) => article.id === need.article_id)?.unit_id ?? need.unit_id,
        conversion_factor: 1,
        quantity_planned_stock: Number(need.quantity) > 0 ? Number(need.quantity) : Number(need.quantity_needed ?? 0),
        unit_price_estimated: Number(need.estimated_price) > 0 ? Number(need.estimated_price) : Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0) / Math.max(1, Number(need.quantity) || Number(need.quantity_needed) || 1),
        unit_price_estimated_stock: Number(need.estimated_price) > 0 ? Number(need.estimated_price) : Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0) / Math.max(1, Number(need.quantity) || Number(need.quantity_needed) || 1),
      }],
    }))
  }

  const updateItem = (index: number, patch: Partial<CashPurchaseItemFormValues>) => {
    setValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }))
  }

  const selectArticle = (index: number, selectedValue: string) => {
    if (selectedValue === '__free__') {
      updateItem(index, computeConversionPatch(values.items[index], {
        article_mode: 'free',
        article_id: '',
        free_designation: '',
        stock_unit_id: values.items[index].unit_id,
        conversion_factor: 1,
      }))
      return
    }
    const articleId = selectedValue
    const article = articles.find((item) => item.id === articleId)
    updateItem(index, computeConversionPatch(values.items[index], {
      article_mode: 'catalog',
      article_id: articleId,
      free_designation: '',
      unit_id: article?.unit_id ?? '',
      stock_unit_id: article?.unit_id ?? '',
      conversion_factor: undefined,
    }))
  }

  const computeConversionPatch = (item: CashPurchaseItemFormValues, patch: Partial<CashPurchaseItemFormValues> = {}) => {
    const next = { ...item, ...patch }
    const article = articles.find((row) => row.id === next.article_id)
    const purchaseUnit = units.find((unit) => unit.id === next.unit_id)
    const stockUnit = units.find((unit) => unit.id === (article?.unit_id ?? next.stock_unit_id ?? next.unit_id))
    const autoFactor = getUnitConversionFactor(purchaseUnit, stockUnit)
    const factor = Number(next.conversion_factor ?? autoFactor ?? 1)
    const quantity = Number(next.quantity_planned ?? 0)
    const unitPrice = Number(next.unit_price_estimated ?? 0)

    return {
      ...patch,
      stock_unit_id: article?.unit_id ?? next.stock_unit_id ?? next.unit_id,
      conversion_factor: factor,
      quantity_planned_stock: quantity * factor,
      unit_price_estimated_stock: factor > 0 ? unitPrice / factor : unitPrice,
    }
  }

  const removeItem = (index: number) => setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))

  const save = async () => {
    try {
      if (!profile?.id) throw new Error('Profil introuvable')
      if (total <= 0) throw new Error('Le montant demande doit etre superieur a 0')
      if (values.items.length === 0) throw new Error('Veuillez ajouter au moins un article')
      const id = await createCashPurchase(values, profile.id)
      toast.success("Demande d'achat creee avec succes")
      navigate(`/cash-purchases/${id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Caisse</p><h1 className="page-title mt-2">Nouvelle demande d'achat en especes</h1></header>

      <section className="surface grid gap-5 p-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <Field label="Rechercher fournisseur">
              <input
                value={supplierSearch}
                onChange={(event) => setSupplierSearch(event.target.value)}
                className="input mt-2"
                placeholder="Nom, alias, mots-cles, raison sociale..."
              />
            </Field>
            <Field label="Fournisseur pressenti">
              <select value={values.supplier_id ?? ''} onChange={(event) => { if (event.target.value === '__new__') setQuickSupplierOpen(true); else setValues((current) => ({ ...current, supplier_id: event.target.value })) }} className="input mt-2">
                <option value="">Non renseigne / a confirmer</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                <option value="__new__">+ Nouveau fournisseur</option>
              </select>
            </Field>
            <button type="button" onClick={() => setQuickSupplierOpen(true)} className="btn-secondary">Creer fournisseur</button>
          </div>
          {values.supplier_id && suppliers.find((supplier) => supplier.id === values.supplier_id)?.notes?.includes('Fiche fournisseur a completer') && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              Fiche fournisseur a completer.
            </p>
          )}
        </div>
        <Field label="Caisse source"><select value={values.cash_source} onChange={(event) => setValues((current) => ({ ...current, cash_source: event.target.value as CashPurchaseSource }))} className="input mt-2">{cashPurchaseSources.map((source) => <option key={source} value={source}>{cashPurchaseSourceLabels[source]}</option>)}</select></Field>
        <Field label="Date demande"><input value={values.request_date} onChange={(event) => setValues((current) => ({ ...current, request_date: event.target.value }))} type="date" className="input mt-2" /></Field>
        <Field label="Date achat prevue"><input value={values.purchase_date} onChange={(event) => setValues((current) => ({ ...current, purchase_date: event.target.value }))} type="date" className="input mt-2" /></Field>
        <div className="surface border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-bold uppercase text-[#1E3A8A]">Montant demande</p><p className="mt-2 text-2xl font-bold text-[#10285f]">{total.toLocaleString('fr-FR')} Ar</p></div>
        <label className="block lg:col-span-2"><span className="field-label">Motif</span><textarea value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} className="input mt-2 min-h-24 resize-none" /></label>
      </section>

      {needs.length > 0 && (
        <section className="surface p-5">
          <h2 className="text-lg font-bold">Importer depuis les besoins valides</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {needs.slice(0, 9).map((need) => (
              <button key={need.id} type="button" onClick={() => addNeed(need)} className="rounded-md border border-slate-200 p-3 text-left transition hover:bg-slate-50">
                <span className="block font-semibold">{need.articles?.name}</span>
                <span className="text-xs text-slate-500">{Number(need.quantity ?? need.quantity_needed).toLocaleString('fr-FR')} {need.units?.abbreviation} - {Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0).toLocaleString('fr-FR')} Ar</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="surface p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Articles a acheter</h2><button type="button" onClick={addItem} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter</button></div>
        {articlesLoaded && articles.length === 0 && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Aucun article actif n'est disponible dans le catalogue. Vous pouvez tout de même saisir une désignation libre.
          </p>
        )}
        <div className="mt-4 space-y-3">
          {values.items.map((item, index) => {
            return (
              <div key={index} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_120px_120px_140px_120px_130px_80px] lg:items-end">
                <label className="block"><span className="field-label">Article a acheter</span><div className="mt-2"><ArticleSearchSelect articles={articles} value={item.article_mode === 'free' ? '__free__' : item.article_id} onChange={(articleId) => selectArticle(index, articleId)} onCreate={() => { setQuickArticleIndex(index); setQuickArticleOpen(true) }} extraOptions={[{ value: '__free__', label: 'Article non reference - designation libre' }]} /></div></label>
                {item.article_mode === 'free' && (
                  <label className="block lg:col-span-7"><span className="field-label">Désignation libre</span><input value={item.free_designation ?? ''} onChange={(event) => updateItem(index, { free_designation: event.target.value })} className="input mt-2" maxLength={200} placeholder="Nom précis de l'article à créer ou à rapprocher" /></label>
                )}
                <label className="block"><span className="field-label">Unite d achat (stock par defaut)</span><select value={item.unit_id} onChange={(event) => updateItem(index, computeConversionPatch(item, { unit_id: event.target.value, conversion_factor: undefined }))} className="input mt-2"><option value="">Unite non definie</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}</select></label>
                <label className="block"><span className="field-label">Quantite prevue</span><input value={item.quantity_planned} onChange={(event) => updateItem(index, computeConversionPatch(item, { quantity_planned: Number(event.target.value) }))} type="number" min="0" step="0.01" className="input mt-2" /></label>
                <label className="block"><span className="field-label">Prix unitaire estime</span><input value={item.unit_price_estimated} onChange={(event) => updateItem(index, computeConversionPatch(item, { unit_price_estimated: Number(event.target.value) }))} type="number" min="0" step="0.01" className="input mt-2" /></label>
                <label className="block"><span className="field-label">Facteur conversion</span><input value={item.conversion_factor ?? 1} onChange={(event) => updateItem(index, computeConversionPatch(item, { conversion_factor: Number(event.target.value) }))} type="number" min="0" step="0.0001" className="input mt-2" /></label>
                <div><span className="field-label">Total estime ligne</span><p className="mt-2 rounded-md bg-white px-3 py-2 text-sm font-bold">{(item.quantity_planned * item.unit_price_estimated).toLocaleString('fr-FR')} Ar</p></div>
                <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-red-700" title="Supprimer la ligne"><Trash2 className="h-4 w-4" /></button>
                <p className="rounded-md bg-blue-50 px-3 py-2 text-xs font-semibold text-[#1E3A8A] lg:col-span-7">
                  {item.article_mode === 'free' ? 'Article à créer / à rapprocher' : 'Article du catalogue'} — Stock prévu : {Number(item.quantity_planned_stock ?? item.quantity_planned).toLocaleString('fr-FR')} {articles.find((article) => article.id === item.article_id)?.units?.abbreviation ?? units.find((unit) => unit.id === item.unit_id)?.abbreviation ?? ''} - Prix stock estimé : {Number(item.unit_price_estimated_stock ?? item.unit_price_estimated).toLocaleString('fr-FR')} Ar
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex gap-3"><button type="button" onClick={save} className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button><Link to="/cash-purchases" className="btn-secondary">Annuler</Link></div>
      <QuickSupplierDrawer
        open={quickSupplierOpen}
        profileId={profile?.id}
        onClose={() => setQuickSupplierOpen(false)}
        onCreated={(supplier) => {
          setSuppliers((current) => [supplier, ...current.filter((item) => item.id !== supplier.id)])
          setValues((current) => ({ ...current, supplier_id: supplier.id }))
          setQuickSupplierOpen(false)
        }}
      />
      <QuickArticleDrawer
        open={quickArticleOpen}
        profileId={profile?.id}
        defaultSupplierId={values.supplier_id}
        onClose={() => { setQuickArticleOpen(false); setQuickArticleIndex(null) }}
        onCreated={(article) => {
          setArticles((current) => [article, ...current.filter((item) => item.id !== article.id)])
          if (quickArticleIndex !== null) {
            setValues((current) => ({
              ...current,
              items: current.items.map((item, index) => index === quickArticleIndex ? {
                ...item,
                article_mode: 'catalog',
                article_id: article.id,
                free_designation: '',
                unit_id: article.unit_id,
                stock_unit_id: article.unit_id,
                conversion_factor: 1,
              } : item),
            }))
          }
        }}
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}
