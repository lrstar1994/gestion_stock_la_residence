import { Plus, Save, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { listArticles, listLocations, listUnits } from '../../api/modules/catalog.api'
import { createReception, getReception, listDefaultReceptionLocation, listReceivableCashPurchases, listReceivableOrders, submitReception, updateReception, uploadReceptionAnomalyPhoto } from '../../api/modules/receptions.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { QuickSupplierDrawer } from '../../components/suppliers/QuickSupplierDrawer'
import { SupplierSearchSelect } from '../../components/suppliers/SupplierSearchSelect'
import { QuickArticleDrawer } from '../../components/articles/QuickArticleDrawer'
import { ArticleSearchSelect } from '../../components/articles/ArticleSearchSelect'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location, Unit } from '../../lib/catalog'
import type { PurchaseOrder } from '../../lib/purchaseOrders'
import { anomalyTypeLabels, anomalyTypes, calculateReceptionTotal, qualityStatusLabels, qualityStatuses } from '../../lib/receptions'
import type { AnomalyType, ReceptionFormValues } from '../../lib/receptions'
import type { Supplier } from '../../lib/suppliers'
import type { CashPurchase } from '../../lib/cashPurchases'
import { getUnitConversionFactor } from '../../lib/unitConversions'
import { calculateMaterialCost, invoiceTaxModeLabels, invoiceTaxModes, supplierTaxStatusLabels, supplierTaxStatuses } from '../../lib/materialCosts'
import type { InvoiceTaxMode, SupplierTaxStatus } from '../../lib/materialCosts'

const today = new Date().toISOString().slice(0, 10)

const emptyForm: ReceptionFormValues = {
  supplier_id: '',
  reception_date: today,
  invoice_number: '',
  invoice_date: today,
  location_id: '',
  comment: '',
  purchase_order_id: '',
  cash_purchase_id: '',
  handover_id: null,
  is_historical: false,
  items: [],
}

type ReceptionMode = 'order' | 'cash' | 'manual'

type ReceptionFiscalSettings = {
  supplier_tax_status: SupplierTaxStatus
  invoice_tax_mode: InvoiceTaxMode
  vat_rate: number
  vat_recoverable: boolean
  declared_extra_tax_rate: number
  declared_extra_tax_amount: number
  manual_cost_total: number
  effective_cost_note: string
}

const defaultFiscalSettings: ReceptionFiscalSettings = {
  supplier_tax_status: 'unknown',
  invoice_tax_mode: 'invoice_with_recoverable_vat',
  vat_rate: 20,
  vat_recoverable: true,
  declared_extra_tax_rate: 0,
  declared_extra_tax_amount: 0,
  manual_cost_total: 0,
  effective_cost_note: '',
}

function normalizeName(value?: string | null) {
  return value?.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? ''
}

function fiscalSettingsFromSupplier(supplier?: Supplier): ReceptionFiscalSettings {
  if (!supplier) {
    return defaultFiscalSettings
  }

  return {
    supplier_tax_status: supplier.supplier_tax_status ?? defaultFiscalSettings.supplier_tax_status,
    invoice_tax_mode: supplier.default_invoice_tax_mode ?? defaultFiscalSettings.invoice_tax_mode,
    vat_rate: Number(supplier.default_vat_rate ?? defaultFiscalSettings.vat_rate),
    vat_recoverable: supplier.default_vat_recoverable ?? defaultFiscalSettings.vat_recoverable,
    declared_extra_tax_rate: supplier.default_declared_extra_tax_enabled ? Number(supplier.default_declared_extra_tax_rate ?? 0) : 0,
    declared_extra_tax_amount: 0,
    manual_cost_total: 0,
    effective_cost_note: '',
  }
}

export function ReceptionFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isEdit = Boolean(id)
  const [values, setValues] = useState<ReceptionFormValues>(emptyForm)
  const [receptionMode, setReceptionMode] = useState<ReceptionMode>(searchParams.get('orderId') ? 'order' : searchParams.get('cashPurchaseId') ? 'cash' : 'manual')
  const [handoverMode, setHandoverMode] = useState(Boolean(searchParams.get('cashPurchaseId')))
  const [articles, setArticles] = useState<Article[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [cashPurchases, setCashPurchases] = useState<CashPurchase[]>([])
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false)
  const [quickArticleIndex, setQuickArticleIndex] = useState<number | null>(null)
  const [quickArticleOpen, setQuickArticleOpen] = useState(false)
  const [fiscalSettings, setFiscalSettings] = useState<ReceptionFiscalSettings>(defaultFiscalSettings)
  const isCashReception = Boolean(values.cash_purchase_id)
  const selectedCashPurchase = cashPurchases.find((purchase) => purchase.id === values.cash_purchase_id)
  const isCashHandover = Boolean(handoverMode && selectedCashPurchase?.controlled_at)
  const total = useMemo(() => calculateReceptionTotal(values.items), [values.items])
  const fiscalVatAmount = ['invoice_with_recoverable_vat', 'invoice_ttc_vat_not_recoverable'].includes(fiscalSettings.invoice_tax_mode)
    ? total * Number(fiscalSettings.vat_rate ?? 0) / 100
    : 0
  const fiscalPreview = useMemo(() => calculateMaterialCost({
    amountHt: total,
    vatAmount: fiscalVatAmount,
    amountTtc: total + fiscalVatAmount,
    quantityStock: 1,
    invoiceTaxMode: fiscalSettings.invoice_tax_mode,
    vatRate: fiscalSettings.vat_rate,
    vatRecoverable: fiscalSettings.vat_recoverable,
    declaredExtraTaxRate: fiscalSettings.declared_extra_tax_rate,
    declaredExtraTaxAmount: fiscalSettings.declared_extra_tax_amount,
    manualCostTotal: fiscalSettings.manual_cost_total,
  }), [fiscalSettings, fiscalVatAmount, total])

  const selectOrder = useCallback((order: PurchaseOrder, fallbackLocationId = '', supplierSource = suppliers) => {
    const supplier = supplierSource.find((item) => item.id === order.supplier_id)
    setFiscalSettings(fiscalSettingsFromSupplier(supplier))
    setValues((current) => ({
      ...current,
      supplier_id: order.supplier_id,
      purchase_order_id: order.id,
      cash_purchase_id: '',
      handover_id: null,
      location_id: current.location_id || fallbackLocationId,
      items: order.purchase_order_items?.map((item) => {
        const remaining = Math.max(0, Number(item.quantity_ordered ?? 0) - Number(item.quantity_received ?? 0))
        const stockUnitId = item.articles?.unit_id ?? item.unit_id
        const factor = Number((item.conversion_factor ?? (item.unit_id === stockUnitId ? 1 : 0)) || 1)
        const stockRemaining = remaining * factor
        return {
          article_id: item.article_id,
          quantity_ordered: remaining,
          quantity_delivered: stockRemaining,
          quantity_accepted: stockRemaining,
          unit_id: stockUnitId,
          unit_display_id: item.unit_id,
          conversion_factor: factor,
          quantity_delivered_display: remaining,
          quantity_accepted_display: remaining,
          unit_price_planned: Number(item.unit_price ?? 0),
          unit_price_real: Number(item.unit_price_stock ?? (factor > 0 ? Number(item.unit_price ?? 0) / factor : item.unit_price) ?? 0),
          unit_price_display: Number(item.unit_price ?? 0),
          quality: 'conforme',
          quality_comment: '',
          has_anomaly: false,
          anomalies: [],
        }
      }) ?? [],
    }))
  }, [suppliers])

  const selectCashPurchase = useCallback((cashPurchase: CashPurchase, fallbackLocationId = '', supplierSource = suppliers) => {
    const controlled = Boolean(cashPurchase.controlled_at)
    const supplierName = cashPurchase.cash_purchase_items?.map((item) => item.supplier).find(Boolean)
    const matchedSupplier = supplierSource.find((supplier) => normalizeName(supplier.name) === normalizeName(supplierName))
    if (matchedSupplier) {
      setFiscalSettings(fiscalSettingsFromSupplier(matchedSupplier))
    }

    setValues((current) => ({
      ...current,
      cash_purchase_id: cashPurchase.id,
      handover_id: current.handover_id ?? (controlled ? crypto.randomUUID() : null),
      purchase_order_id: '',
      supplier_id: cashPurchase.supplier_id ?? matchedSupplier?.id ?? current.supplier_id,
      location_id: current.location_id || fallbackLocationId,
      invoice_number: cashPurchase.cash_purchase_items?.[0]?.invoice_number ?? current.invoice_number,
      invoice_date: cashPurchase.cash_purchase_items?.[0]?.invoice_date ?? current.invoice_date,
      items: cashPurchase.cash_purchase_items?.filter((item) => item.article_id).map((item) => ({
        article_id: item.article_id as string,
        quantity_ordered: controlled ? Number(item.quantity_accepted ?? 0) : Number(item.quantity_planned ?? 0),
        unit_id: item.articles?.unit_id ?? item.unit_id,
        unit_display_id: item.unit_id,
        conversion_factor: Number((item.conversion_factor ?? (item.unit_id === (item.articles?.unit_id ?? item.unit_id) ? 1 : 0)) || 1),
        quantity_delivered: controlled ? Number(item.quantity_accepted ?? 0) : Number(item.quantity_bought_stock ?? item.quantity_bought ?? 0),
        quantity_accepted: controlled ? Number(item.quantity_accepted ?? 0) : Number(item.quantity_bought_stock ?? item.quantity_bought ?? 0),
        controller_quantity_accepted: controlled ? Number(item.quantity_accepted ?? 0) : null,
        handover_quantity_received: controlled ? Number(item.quantity_accepted ?? 0) : null,
        stock_quantity_accepted: controlled ? Number(item.quantity_accepted ?? 0) : null,
        quantity_delivered_display: controlled ? Number(item.quantity_accepted ?? 0) : Number(item.quantity_bought ?? 0),
        quantity_accepted_display: controlled ? Number(item.quantity_accepted ?? 0) : Number(item.quantity_bought ?? 0),
        unit_price_planned: Number(item.unit_price_estimated ?? 0),
        unit_price_real: Number(item.unit_price_real_stock ?? item.unit_price_real ?? 0),
        unit_price_display: Number(item.unit_price_real ?? 0),
        quality: 'conforme',
        quality_comment: '',
        has_anomaly: false,
        anomalies: [],
      })) ?? [],
    }))
  }, [suppliers])

  const changeSupplier = (supplierId: string) => {
    const supplier = suppliers.find((item) => item.id === supplierId)
    setFiscalSettings(fiscalSettingsFromSupplier(supplier))
    setValues((current) => ({ ...current, supplier_id: supplierId }))
  }

  const changeReceptionMode = (mode: ReceptionMode) => {
    setReceptionMode(mode)
    setHandoverMode(false)
    setValues((current) => ({
      ...current,
      purchase_order_id: '',
      cash_purchase_id: '',
      handover_id: null,
      items: [],
    }))
  }

  const load = useCallback(async () => {
    const [articlesResult, suppliersResult, locationsResult, unitsResult, ordersResult, cashPurchasesResult, defaultLocationResult] = await Promise.allSettled([
      listArticles({ page: 1, pageSize: 1000, status: 'active' }),
      listSuppliers(),
      listLocations(),
      listUnits(),
      listReceivableOrders(),
      listReceivableCashPurchases(),
      listDefaultReceptionLocation(),
    ])
    const loadedArticles = articlesResult.status === 'fulfilled' ? articlesResult.value.articles : []
    const loadedSuppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value : []
    const loadedLocations = locationsResult.status === 'fulfilled' ? locationsResult.value : []
    const loadedUnits = unitsResult.status === 'fulfilled' ? unitsResult.value : []
    const loadedOrders = ordersResult.status === 'fulfilled' ? ordersResult.value : []
    const loadedCashPurchases = cashPurchasesResult.status === 'fulfilled' ? cashPurchasesResult.value : []
    const defaultLocation = defaultLocationResult.status === 'fulfilled' ? defaultLocationResult.value : null
    setArticles([...loadedArticles].sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })))
    setSuppliers(loadedSuppliers)
    setLocations(loadedLocations)
    setUnits(loadedUnits)
    setOrders(loadedOrders)
    setCashPurchases(loadedCashPurchases as CashPurchase[])

    const requestedCashPurchaseId = searchParams.get('cashPurchaseId')
    if (!id && requestedCashPurchaseId) {
      const requestedPurchase = loadedCashPurchases.find((purchase) => purchase.id === requestedCashPurchaseId) as CashPurchase | undefined
      if (!requestedPurchase) throw new Error('Achat contrôle introuvable ou déjà pris en charge')
      if (!defaultLocation) throw new Error('Localisation Magasin principal introuvable')
      setReceptionMode('cash')
      setHandoverMode(true)
      selectCashPurchase(requestedPurchase, defaultLocation.id, loadedSuppliers)
    }

    if (id) {
      const reception = await getReception(id)
      const firstItem = reception.reception_items?.[0]
      setValues({
        supplier_id: reception.supplier_id,
        reception_date: reception.reception_date,
        invoice_number: reception.invoice_number,
        invoice_date: reception.invoice_date,
        location_id: reception.location_id ?? '',
        comment: reception.comment ?? '',
        purchase_order_id: reception.purchase_order_id ?? '',
        cash_purchase_id: reception.cash_purchase_id ?? '',
        handover_id: reception.handover_id ?? null,
        is_historical: Boolean(reception.is_historical),
        items: reception.reception_items?.map((item) => ({
          article_id: item.article_id,
          quantity_ordered: Number(item.quantity_ordered ?? 0),
          quantity_delivered: Number(item.quantity_delivered ?? 0),
          quantity_accepted: Number(item.quantity_accepted ?? 0),
          controller_quantity_accepted: item.controller_quantity_accepted ?? null,
          handover_quantity_received: item.handover_quantity_received ?? null,
          stock_quantity_accepted: item.stock_quantity_accepted ?? null,
          unit_id: item.unit_id,
          unit_display_id: item.unit_display_id ?? item.unit_id,
          conversion_factor: Number(item.conversion_factor ?? 1),
          quantity_delivered_display: Number(item.quantity_delivered_display ?? item.quantity_delivered ?? 0),
          quantity_accepted_display: Number(item.quantity_accepted_display ?? item.quantity_accepted ?? 0),
          unit_price_planned: Number(item.unit_price_planned ?? 0),
          unit_price_real: Number(item.unit_price_real ?? 0),
          unit_price_display: Number(item.unit_price_display ?? item.unit_price_real ?? 0),
          quality: item.quality,
          quality_comment: item.quality_comment ?? '',
          has_anomaly: item.has_anomaly,
          anomalies: item.reception_anomalies?.map((anomaly) => ({
            anomaly_type: anomaly.anomaly_type,
            description: anomaly.description,
            photo_url: anomaly.photo_url ?? '',
          })) ?? [],
        })) ?? [],
      })
      if (firstItem) {
        setFiscalSettings({
          supplier_tax_status: firstItem.supplier_tax_status ?? 'unknown',
          invoice_tax_mode: firstItem.invoice_tax_mode ?? 'invoice_with_recoverable_vat',
          vat_rate: Number(firstItem.vat_rate ?? 20),
          vat_recoverable: firstItem.vat_recoverable ?? true,
          declared_extra_tax_rate: Number(firstItem.declared_extra_tax_rate ?? 0),
          declared_extra_tax_amount: Number(firstItem.declared_extra_tax_amount ?? 0),
          manual_cost_total: firstItem.invoice_tax_mode === 'manual_validated'
            ? (reception.reception_items ?? []).reduce((sum, item) => sum + Number(item.effective_material_cost_total ?? 0), 0)
            : 0,
          effective_cost_note: firstItem.effective_cost_note ?? '',
        })
      }
    } else {
      setValues((current) => ({ ...current, location_id: defaultLocation?.id ?? loadedLocations[0]?.id ?? '' }))
      const orderId = searchParams.get('orderId')
      if (orderId) {
        const order = loadedOrders.find((item) => item.id === orderId)
        if (order) {
          setReceptionMode('order')
          selectOrder(order, defaultLocation?.id ?? loadedLocations[0]?.id ?? '', loadedSuppliers)
        }
      }
    }
  }, [id, searchParams, selectOrder, selectCashPurchase])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger le formulaire.'))
  }, [load])

  const addItem = () => {
    const article = articles[0]
    setValues((current) => ({
      ...current,
      items: [...current.items, {
        article_id: article?.id ?? '',
        quantity_ordered: 0,
        quantity_delivered: 1,
        quantity_accepted: 1,
        unit_id: article?.unit_id ?? '',
        unit_display_id: article?.unit_id ?? '',
        conversion_factor: 1,
        quantity_delivered_display: 1,
        quantity_accepted_display: 1,
        unit_price_planned: 0,
        unit_price_real: 0,
        unit_price_display: 0,
        quality: 'conforme',
        quality_comment: '',
        has_anomaly: false,
        anomalies: [],
      }],
    }))
  }

  const updateItem = (index: number, patch: Partial<ReceptionFormValues['items'][number]>) => {
    setValues((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  }

  const computeConversionPatch = (item: ReceptionFormValues['items'][number], patch: Partial<ReceptionFormValues['items'][number]> = {}) => {
    const next = { ...item, ...patch }
    const article = articles.find((row) => row.id === next.article_id)
    const displayUnit = units.find((unit) => unit.id === (next.unit_display_id || next.unit_id))
    const stockUnit = units.find((unit) => unit.id === (article?.unit_id || next.unit_id))
    const autoFactor = getUnitConversionFactor(displayUnit, stockUnit)
    const factor = Number(next.conversion_factor ?? autoFactor ?? 1)
    const deliveredDisplay = Number(next.quantity_delivered_display ?? next.quantity_delivered ?? 0)
    const acceptedDisplay = Number(next.quantity_accepted_display ?? next.quantity_accepted ?? 0)
    const displayPrice = Number(next.unit_price_display ?? next.unit_price_real ?? 0)

    return {
      ...patch,
      unit_id: article?.unit_id ?? next.unit_id,
      conversion_factor: factor,
      quantity_delivered: deliveredDisplay * factor,
      quantity_accepted: acceptedDisplay * factor,
      unit_price_real: factor > 0 ? displayPrice / factor : displayPrice,
    }
  }

  const changeArticle = (index: number, articleId: string) => {
    const article = articles.find((item) => item.id === articleId)
    const current = values.items[index]
    updateItem(index, computeConversionPatch(current, {
      article_id: articleId,
      unit_id: article?.unit_id ?? '',
      unit_display_id: article?.unit_id ?? '',
      conversion_factor: 1,
    }))
  }

  const openQuickArticle = (index: number) => {
    setQuickArticleIndex(index)
    setQuickArticleOpen(true)
  }

  const addAnomaly = (index: number) => {
    const item = values.items[index]
    updateItem(index, { has_anomaly: true, anomalies: [...(item.anomalies ?? []), { anomaly_type: 'quantite_manquante', description: '', photo_url: '' }] })
    toast.success('Anomalie enregistrÃ©e')
  }

  const updateAnomaly = (itemIndex: number, anomalyIndex: number, patch: Partial<ReceptionFormValues['items'][number]['anomalies'][number]>) => {
    const item = values.items[itemIndex]
    updateItem(itemIndex, { anomalies: (item.anomalies ?? []).map((anomaly, index) => index === anomalyIndex ? { ...anomaly, ...patch } : anomaly) })
  }

  const uploadPhoto = async (itemIndex: number, anomalyIndex: number, file?: File) => {
    if (!file) return
    try {
      const url = await uploadReceptionAnomalyPhoto(file)
      updateAnomaly(itemIndex, anomalyIndex, { photo_url: url })
      toast.success('Photo ajoutee')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload impossible')
    }
  }

  const removeItem = (index: number) => setValues((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))

  const applyFiscalSettingsToValues = (source: ReceptionFormValues): ReceptionFormValues => {
    const baseTotal = calculateReceptionTotal(source.items)
    return {
      ...source,
      items: source.items.map((item) => {
        const lineAmount = Number(item.quantity_accepted ?? 0) * Number(item.unit_price_real ?? 0)
        const share = baseTotal > 0 ? lineAmount / baseTotal : 0
        return {
          ...item,
          supplier_tax_status: fiscalSettings.supplier_tax_status,
          invoice_tax_mode: fiscalSettings.invoice_tax_mode,
          vat_rate: fiscalSettings.vat_rate,
          vat_recoverable: fiscalSettings.vat_recoverable,
          declared_extra_tax_rate: fiscalSettings.declared_extra_tax_rate,
          declared_extra_tax_amount: Number(fiscalSettings.declared_extra_tax_amount ?? 0) > 0 ? Number(fiscalSettings.declared_extra_tax_amount) * share : 0,
          manual_cost_total: fiscalSettings.invoice_tax_mode === 'manual_validated' ? Number(fiscalSettings.manual_cost_total ?? 0) * share : undefined,
          effective_cost_note: fiscalSettings.effective_cost_note,
        }
      }),
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (fiscalSettings.invoice_tax_mode === 'manual_validated') {
        if (Number(fiscalSettings.manual_cost_total ?? 0) <= 0) throw new Error('Veuillez saisir un cout manuel total')
        if (!fiscalSettings.effective_cost_note.trim()) throw new Error('Veuillez saisir une note pour le cout manuel')
      }
      const payload = applyFiscalSettingsToValues(isCashHandover ? {
        ...values,
        items: values.items.map((item) => {
          const expected = Number(item.quantity_accepted ?? 0)
          const physical = Number(item.quantity_delivered_display ?? item.quantity_delivered ?? 0)
          if (physical === expected) return { ...item, quantity_ordered: expected, quantity_delivered: physical, quantity_accepted: expected, controller_quantity_accepted: expected, handover_quantity_received: physical, stock_quantity_accepted: expected }
          return {
            ...item,
            quantity_ordered: expected,
            quantity_delivered: physical,
            controller_quantity_accepted: expected,
            handover_quantity_received: physical,
            stock_quantity_accepted: 0,
            quantity_accepted: 0,
            quality: 'non_conforme' as const,
            has_anomaly: true,
            quality_comment: `Ecart de passation : attendu ${expected}, reçu ${physical}`,
            anomalies: [...(item.anomalies ?? []), { anomaly_type: 'livraison_partielle' as const, description: `Passation physique différente de la quantité acceptée : attendu ${expected}, reçu ${physical}`, photo_url: '' }],
          }
        }),
      } : values)
      if (id) {
        await updateReception(id, payload, profile?.id)
        toast.success('Reception marchandises mise a jour avec succes')
        navigate(`/receptions/${id}`)
      } else {
        const receptionId = await createReception(payload, profile?.id)
        if (isCashHandover) await submitReception(receptionId, profile?.id)
        toast.success('RÃ©ception crÃ©Ã©e avec succÃ¨s')
        navigate(`/receptions/${receptionId}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Reception marchandises</p><h1 className="page-title mt-2">{isEdit ? 'Modifier la reception marchandises' : 'Nouvelle reception marchandises'}</h1></div>
        <div className="flex gap-2"><Link to="/receptions" className="btn-secondary">Annuler</Link><button type="submit" className="btn-primary"><Save className="mr-2 h-4 w-4" /> Enregistrer</button></div>
      </header>

      {!isEdit && (
        <section className="surface space-y-4 p-5">
          <div>
            <p className="field-label">Mode de reception marchandises</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <button type="button" onClick={() => changeReceptionMode('order')} className={`rounded-md border px-4 py-3 text-left text-sm font-semibold transition ${receptionMode === 'order' ? 'border-[#1E3A8A] bg-blue-50 text-[#1E3A8A]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                Depuis une commande fournisseur
                <span className="mt-1 block text-xs font-normal text-slate-500">Pour receptionner une commande envoyee.</span>
              </button>
              <button type="button" onClick={() => changeReceptionMode('cash')} className={`rounded-md border px-4 py-3 text-left text-sm font-semibold transition ${receptionMode === 'cash' ? 'border-[#1E3A8A] bg-blue-50 text-[#1E3A8A]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                Depuis un achat en especes
                <span className="mt-1 block text-xs font-normal text-slate-500">Pour controler un achat cash dont le retour d'achat est saisi.</span>
              </button>
              <button type="button" onClick={() => changeReceptionMode('manual')} className={`rounded-md border px-4 py-3 text-left text-sm font-semibold transition ${receptionMode === 'manual' ? 'border-[#1E3A8A] bg-blue-50 text-[#1E3A8A]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                Reception marchandises sans commande
                <span className="mt-1 block text-xs font-normal text-slate-500">Pour une reception exceptionnelle saisie manuellement.</span>
              </button>
            </div>
          </div>

          {receptionMode === 'order' && (
            <label className="block">
              <span className="field-label">Commande fournisseur</span>
              <select value={values.purchase_order_id} onChange={(event) => { const order = orders.find((item) => item.id === event.target.value); if (order) selectOrder(order); else setValues((current) => ({ ...current, purchase_order_id: '', items: [] })) }} className="input mt-2">
                <option value="">Selectionner une commande</option>
                {orders.map((order) => <option key={order.id} value={order.id}>{order.reference} - {order.suppliers?.name}</option>)}
              </select>
            </label>
          )}

          {receptionMode === 'cash' && (
            <div className="space-y-3">
              <label className="block">
                <span className="field-label">Achat en especes</span>
              <select value={values.cash_purchase_id} onChange={(event) => { const cashPurchase = cashPurchases.find((item) => item.id === event.target.value); if (cashPurchase) { setHandoverMode(Boolean(cashPurchase.controlled_at)); selectCashPurchase(cashPurchase, values.location_id) } else setValues((current) => ({ ...current, cash_purchase_id: '', handover_id: null, items: [] })) }} className="input mt-2" disabled={handoverMode}>
                  <option value="">Selectionner un achat en especes</option>
                  {cashPurchases.map((purchase) => <option key={purchase.id} value={purchase.id}>{purchase.reference} - {purchase.reason}</option>)}
                </select>
              </label>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                La reception est disponible des que le retour d'achat est saisi avec les lignes a controler. Un ecart de monnaie ou une caisse non cloturee ne bloque pas le controle marchandise ni l'entree en stock.
              </div>
              {isCashHandover && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Passation physique : les quantités contrôlées, le prix réel et les articles sont verrouillés. Saisissez uniquement la quantité physiquement reçue au Magasin principal.</div>}
            </div>
          )}

          {receptionMode === 'manual' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Reception marchandises sans commande : utilisez ce mode uniquement pour une reception exceptionnelle non liee a une commande fournisseur ou a un achat en especes. Les articles, quantites et prix doivent etre saisis manuellement.
            </div>
          )}
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            Ordre de controle : creer la reception marchandises, relever son numero interne de classement, l ecrire sur la facture papier, scanner ou photographier la facture avec le numero visible, joindre la piece au dossier, puis transmettre au Magasin / Stock.
          </div>
        </section>
      )}

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label className="block"><span className="field-label">Fournisseur</span><div className="mt-2"><SupplierSearchSelect suppliers={suppliers} value={values.supplier_id} onChange={changeSupplier} onCreate={() => setSupplierDrawerOpen(true)} disabled={isCashReception && Boolean(values.supplier_id)} emptyLabel="Selectionner un fournisseur" /></div></label>
        <label className="block"><span className="field-label">Localisation reception marchandises</span><select value={values.location_id} onChange={(event) => setValues((current) => ({ ...current, location_id: event.target.value }))} className="input mt-2" disabled={isCashHandover}><option value="">Selectionner une localisation active</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><span className="mt-1 block text-xs text-slate-500">{isCashHandover ? 'Destination verrouillée : Magasin principal.' : 'Liste limitee aux localisations actives.'}</span></label>
        <label className="block"><span className="field-label">Date reception marchandises</span><input type="date" value={values.reception_date} onChange={(event) => setValues((current) => ({ ...current, reception_date: event.target.value }))} className="input mt-2" readOnly={isCashHandover} /></label>
        <label className="block"><span className="field-label">Numero facture fournisseur / recu</span><input value={values.invoice_number} onChange={(event) => setValues((current) => ({ ...current, invoice_number: event.target.value }))} readOnly={isCashReception && Boolean(values.invoice_number)} className="input mt-2 read-only:bg-slate-100" /></label>
        <label className="block"><span className="field-label">Date facture</span><input type="date" value={values.invoice_date} onChange={(event) => setValues((current) => ({ ...current, invoice_date: event.target.value }))} readOnly={isCashReception && Boolean(values.invoice_date)} className="input mt-2 read-only:bg-slate-100" /></label>
        <label className="block"><span className="field-label">Commentaire</span><input value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2" /></label>
        <label className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 md:col-span-2">
          <input type="checkbox" checked={values.is_historical} onChange={(event) => setValues((current) => ({ ...current, is_historical: event.target.checked }))} className="mt-1 h-4 w-4" />
          <span>
            <span className="block font-bold text-amber-900">Reception marchandises historique sans entree en stock</span>
            <span className="mt-1 block text-sm text-amber-800">A utiliser uniquement pour integrer d'anciennes factures deja traitees avant l'utilisation du logiciel. Cette reception pourra etre facturee, mais ne modifiera pas le stock.</span>
          </span>
        </label>
      </section>

      {isCashReception ? (
        <section className="surface grid gap-4 p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="eyebrow">Achat especes</p>
            <h2 className="mt-2 text-lg font-bold text-slate-950">Informations administratives reprises du retour d'achat</h2>
            <p className="mt-1 text-sm text-slate-600">
              Ces informations servent a comprendre le dossier. La reception controle uniquement les marchandises livrees, acceptees, refusees et les anomalies.
            </p>
          </div>
          <Info label="Fournisseur du justificatif" value={suppliers.find((supplier) => supplier.id === values.supplier_id)?.name ?? 'A confirmer'} />
          <Info label="Justificatif" value={values.invoice_number || 'Non renseigne'} />
          <Info label="Date justificatif" value={values.invoice_date || '-'} />
          <Info label="Mode fiscal applique" value={invoiceTaxModeLabels[fiscalSettings.invoice_tax_mode]} />
          <Info label="TVA recuperable" value={fiscalSettings.vat_recoverable ? 'Oui' : 'Non'} />
          <Info label="Charge declarative" value={`${Number(fiscalSettings.declared_extra_tax_rate ?? 0).toLocaleString('fr-FR')} %`} />
          <div className="rounded-md border border-[#D4AF37]/30 bg-amber-50 p-4 text-sm text-slate-800 md:col-span-2">
            <p>Total recu saisi : <strong>{total.toLocaleString('fr-FR')} Ar</strong></p>
            <p>Valeur d'entree stock estimee : <strong>{Number(fiscalPreview.effective_material_cost_total ?? 0).toLocaleString('fr-FR')} Ar</strong></p>
            <p className="mt-2 text-xs text-slate-600">Les ecarts caisse restent suivis dans le dossier d'achat especes et n'empechent pas la reception.</p>
          </div>
        </section>
      ) : (
      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="eyebrow">Fiscalite et valeur d'entree stock</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">Valorisation stock de la reception</h2>
          <p className="mt-1 text-sm text-slate-600">Ces reglages sont appliques aux lignes recues au moment de l'enregistrement.</p>
        </div>
        <label className="block">
          <span className="field-label">Statut fiscal fournisseur</span>
          <select value={fiscalSettings.supplier_tax_status} onChange={(event) => setFiscalSettings((current) => ({ ...current, supplier_tax_status: event.target.value as SupplierTaxStatus }))} className="input mt-2">
            {supplierTaxStatuses.map((status) => <option key={status} value={status}>{supplierTaxStatusLabels[status]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Mode fiscal</span>
          <select value={fiscalSettings.invoice_tax_mode} onChange={(event) => setFiscalSettings((current) => ({ ...current, invoice_tax_mode: event.target.value as InvoiceTaxMode }))} className="input mt-2">
            {invoiceTaxModes.map((mode) => <option key={mode} value={mode}>{invoiceTaxModeLabels[mode]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Taux TVA reception</span>
          <input type="number" value={fiscalSettings.vat_rate} onChange={(event) => setFiscalSettings((current) => ({ ...current, vat_rate: Number(event.target.value) }))} className="input mt-2" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={fiscalSettings.vat_recoverable} onChange={(event) => setFiscalSettings((current) => ({ ...current, vat_recoverable: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]" />
          TVA recuperable par La Residence
        </label>
        <label className="block">
          <span className="field-label">Charge declarative %</span>
          <input type="number" value={fiscalSettings.declared_extra_tax_rate} onChange={(event) => setFiscalSettings((current) => ({ ...current, declared_extra_tax_rate: Number(event.target.value) }))} className="input mt-2" />
        </label>
        <label className="block">
          <span className="field-label">Charge declarative montant</span>
          <input type="number" value={fiscalSettings.declared_extra_tax_amount} onChange={(event) => setFiscalSettings((current) => ({ ...current, declared_extra_tax_amount: Number(event.target.value) }))} className="input mt-2" />
        </label>
        {fiscalSettings.invoice_tax_mode === 'manual_validated' && (
          <label className="block md:col-span-2">
            <span className="field-label">Cout manuel total retenu</span>
            <input type="number" value={fiscalSettings.manual_cost_total} onChange={(event) => setFiscalSettings((current) => ({ ...current, manual_cost_total: Number(event.target.value) }))} className="input mt-2" />
          </label>
        )}
        <label className="block md:col-span-2">
          <span className="field-label">Note valeur d'entree stock</span>
          <input value={fiscalSettings.effective_cost_note} onChange={(event) => setFiscalSettings((current) => ({ ...current, effective_cost_note: event.target.value }))} className="input mt-2" placeholder="Motif ou precision si cout exceptionnel" />
        </label>
        <div className="rounded-md border border-[#D4AF37]/30 bg-amber-50 p-4 text-sm text-slate-800 md:col-span-2">
          <p>Total recu saisi : <strong>{total.toLocaleString('fr-FR')} Ar</strong></p>
          <p>TVA recuperable estimee : <strong>{fiscalPreview.recoverable_vat_amount.toLocaleString('fr-FR')} Ar</strong></p>
          <p>TVA non recuperable estimee : <strong>{fiscalPreview.non_recoverable_vat_amount.toLocaleString('fr-FR')} Ar</strong></p>
          <p>Charge declarative estimee : <strong>{fiscalPreview.declared_extra_tax_amount.toLocaleString('fr-FR')} Ar</strong></p>
          <p>Valeur d'entree stock estimee : <strong>{Number(fiscalPreview.effective_material_cost_total ?? 0).toLocaleString('fr-FR')} Ar</strong></p>
        </div>
      </section>
      )}

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Articles recus et valorisation stock</h2>
            {receptionMode === 'manual' && <p className="mt-1 text-sm text-slate-600">Reception marchandises sans commande : saisissez les lignes une par une, recherchez un article ou creez-le s il est absent.</p>}
          </div>
          {receptionMode === 'manual' && (
            <button type="button" onClick={addItem} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter un article reçu</button>
          )}
        </div>
        <div className="divide-y divide-slate-200">
          {values.items.map((item, index) => {
            const selectedArticle = articles.find((article) => article.id === item.article_id)
            const controlledItem = isCashHandover ? selectedCashPurchase?.cash_purchase_items?.find((cashItem) => cashItem.article_id === item.article_id) : undefined
            const displayUnit = units.find((unit) => unit.id === (item.unit_display_id || item.unit_id))
            const stockUnit = units.find((unit) => unit.id === item.unit_id)
            const autoFactor = getUnitConversionFactor(displayUnit, stockUnit)
            const needsManualFactor = Boolean(displayUnit && stockUnit && !autoFactor && displayUnit.id !== stockUnit.id)
            const refused = Math.max(0, Number(item.quantity_delivered_display ?? item.quantity_delivered) - Number(item.quantity_accepted_display ?? item.quantity_accepted))
            const plannedTotal = Number(item.quantity_ordered ?? 0) * Number(item.unit_price_planned ?? 0)
            const acceptedTotal = Number(item.quantity_accepted ?? 0) * Number(item.unit_price_real ?? 0)
            const priceDifference = Number(item.unit_price_display ?? item.unit_price_real ?? 0) - Number(item.unit_price_planned ?? 0)
            const totalDifference = acceptedTotal - plannedTotal
            return (
              <div key={`${item.article_id}-${index}`} className="space-y-4 px-5 py-4">
                  <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="block">
                      <span className="field-label">Article</span>
                      <div className="mt-2"><ArticleSearchSelect articles={articles} value={item.article_id} onChange={(articleId) => changeArticle(index, articleId)} onCreate={() => openQuickArticle(index)} disabled={receptionMode !== 'manual'} /></div>
                    </label>
                  {receptionMode === 'manual' && (
                    <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-red-700"><Trash2 className="h-4 w-4" /></button>
                  )}
                  </div>
                {controlledItem && <p className="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Contrôle Contrôleur — livré : {Number(controlledItem.quantity_bought ?? 0).toLocaleString('fr-FR')} · accepté : {Number(controlledItem.quantity_accepted ?? 0).toLocaleString('fr-FR')} · refusé : {Math.max(0, Number(controlledItem.quantity_bought ?? 0) - Number(controlledItem.quantity_accepted ?? 0)).toLocaleString('fr-FR')} · PU réel : {Number(controlledItem.unit_price_real ?? 0).toLocaleString('fr-FR')} Ar</p>}
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[100px_120px_120px_100px_130px_130px_130px] xl:items-end">
                    <Info label="Commande" value={`${Number(item.quantity_ordered).toLocaleString('fr-FR')} ${displayUnit?.abbreviation ?? ''}`} />
                    <label className="block">
                      <span className="field-label">Unite recue</span>
                        <select value={item.unit_display_id || item.unit_id} disabled={isCashHandover} onChange={(event) => updateItem(index, computeConversionPatch(item, { unit_display_id: event.target.value, conversion_factor: undefined }))} className="input mt-2 disabled:bg-slate-100">
                        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.abbreviation}</option>)}
                      </select>
                    </label>
                      <label className="block"><span className="field-label">{isCashHandover ? 'Quantite physiquement reçue' : 'Quantite livree'}</span><input type="number" min="0" value={item.quantity_delivered_display ?? item.quantity_delivered} onChange={(event) => updateItem(index, isCashHandover ? { quantity_delivered_display: Number(event.target.value), quantity_delivered: Number(event.target.value) } : computeConversionPatch(item, { quantity_delivered_display: Number(event.target.value) }))} className="input mt-2" /></label>
                    <label className="block"><span className="field-label">{isCashHandover ? 'Quantite attendue (Contrôleur)' : 'Quantite acceptee'}</span><input type="number" value={item.quantity_accepted_display ?? item.quantity_accepted} readOnly={isCashHandover} onChange={(event) => updateItem(index, computeConversionPatch(item, { quantity_accepted_display: Number(event.target.value) }))} className="input mt-2 read-only:bg-slate-100" /></label>
                    <Info label="Quantite refusee" value={`${refused.toLocaleString('fr-FR')} ${displayUnit?.abbreviation ?? ''}`} />
                    <Info label="Prix prevu saisi" value={`${Number(item.unit_price_planned ?? 0).toLocaleString('fr-FR')} Ar / ${displayUnit?.abbreviation ?? ''}`} />
                    <label className="block"><span className="field-label">Prix reel saisi</span><input type="number" value={item.unit_price_display ?? item.unit_price_real} readOnly={isCashHandover} onChange={(event) => updateItem(index, computeConversionPatch(item, { unit_price_display: Number(event.target.value) }))} className="input mt-2 read-only:bg-slate-100" /></label>
                    <Info label="Total prevu" value={`${plannedTotal.toLocaleString('fr-FR')} Ar`} />
                    <Info label="Total recu saisi" value={`${acceptedTotal.toLocaleString('fr-FR')} Ar`} />
                    <Info label="Ecart prix" value={`${priceDifference >= 0 ? '+' : ''}${priceDifference.toLocaleString('fr-FR')} Ar`} />
                    <Info label="Ecart total" value={`${totalDifference >= 0 ? '+' : ''}${totalDifference.toLocaleString('fr-FR')} Ar`} />
                  </div>
                  <div className="grid gap-3 rounded-md bg-white p-3 text-sm md:grid-cols-3">
                    <label className="block">
                      <span className="field-label">Facteur conversion vers stock</span>
                      <input type="number" min="0" step="0.0001" value={item.conversion_factor ?? 1} disabled={isCashHandover} onChange={(event) => updateItem(index, computeConversionPatch(item, { conversion_factor: Number(event.target.value) }))} className="input mt-2 disabled:bg-slate-100" />
                    </label>
                    <Info label="Entree stock" value={`${Number(item.quantity_accepted ?? 0).toLocaleString('fr-FR')} ${stockUnit?.abbreviation ?? selectedArticle?.units?.abbreviation ?? ''}`} />
                    <Info label="Valeur entree stock" value={`${Number(item.unit_price_real ?? 0).toLocaleString('fr-FR')} Ar / ${stockUnit?.abbreviation ?? selectedArticle?.units?.abbreviation ?? ''}`} />
                    {needsManualFactor && <p className="font-semibold text-amber-700 md:col-span-3">Conversion manuelle requise : indiquez combien vaut 1 {displayUnit?.abbreviation} en {stockUnit?.abbreviation}.</p>}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
                  <label className="block"><span className="field-label">Controle qualite</span><select value={item.quality} disabled={isCashHandover} onChange={(event) => updateItem(index, { quality: event.target.value as typeof item.quality, has_anomaly: event.target.value !== 'conforme' || item.has_anomaly })} className="input mt-2 disabled:bg-slate-100">{qualityStatuses.map((quality) => <option key={quality} value={quality}>{qualityStatusLabels[quality]}</option>)}</select></label>
                  <label className="block"><span className="field-label">Motif refus / commentaire qualite</span><input value={item.quality_comment} readOnly={isCashHandover} onChange={(event) => updateItem(index, { quality_comment: event.target.value })} className="input mt-2 read-only:bg-slate-100" placeholder={Number(item.quantity_accepted_display ?? item.quantity_accepted) < Number(item.quantity_delivered_display ?? item.quantity_delivered) ? 'Motif obligatoire si refus' : 'Facultatif si tout est accepte'} /></label>
                  <button type="button" onClick={() => addAnomaly(index)} className="btn-secondary">Ajouter anomalie</button>
                </div>
                {(item.anomalies ?? []).map((anomaly, anomalyIndex) => (
                  <div key={anomalyIndex} className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 md:grid-cols-[190px_1fr_180px]">
                    <label className="block"><span className="field-label">Type anomalie</span><select value={anomaly.anomaly_type} onChange={(event) => updateAnomaly(index, anomalyIndex, { anomaly_type: event.target.value as AnomalyType })} className="input mt-2">{anomalyTypes.map((type) => <option key={type} value={type}>{anomalyTypeLabels[type]}</option>)}</select></label>
                    <label className="block"><span className="field-label">Description anomalie</span><input value={anomaly.description} onChange={(event) => updateAnomaly(index, anomalyIndex, { description: event.target.value })} className="input mt-2" /></label>
                    <div className="block"><span className="field-label">Photo anomalie</span><label className="btn-secondary mt-2 cursor-pointer"><Upload className="mr-2 h-4 w-4" /> Photo<input type="file" accept="image/*" onChange={(event) => uploadPhoto(index, anomalyIndex, event.target.files?.[0])} className="hidden" /></label></div>
                    {anomaly.photo_url && <a href={anomaly.photo_url} target="_blank" className="text-sm font-semibold text-[#1E3A8A] md:col-span-3">Photo ajoutee</a>}
                  </div>
                ))}
                <p className="text-xs font-semibold text-slate-500">Tous les articles sont acceptes par defaut. Modifiez la quantite acceptee pour un refus partiel ou total et indiquez le motif.</p>
              </div>
            )
          })}
          {values.items.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun article.</p>}
        </div>
      </section>

      <section className="surface flex items-center justify-between p-5"><span className="text-sm text-slate-600">Total recu saisi</span><span className="text-2xl font-black text-[#1E3A8A]">{total.toLocaleString('fr-FR')} Ar</span></section>

      <QuickSupplierDrawer
        open={supplierDrawerOpen}
        profileId={profile?.id}
        onClose={() => setSupplierDrawerOpen(false)}
        onCreated={(supplier) => {
          setSuppliers((current) => [...current, supplier].sort((left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })))
          setFiscalSettings(fiscalSettingsFromSupplier(supplier))
          setValues((current) => ({ ...current, supplier_id: supplier.id }))
          setSupplierDrawerOpen(false)
        }}
      />

      <QuickArticleDrawer
        open={quickArticleOpen}
        profileId={profile?.id}
        defaultLocationId={values.location_id}
        defaultSupplierId={values.supplier_id}
        onClose={() => { setQuickArticleOpen(false); setQuickArticleIndex(null) }}
        onCreated={(article) => {
          setArticles((current) => [article, ...current.filter((item) => item.id !== article.id)])
          if (quickArticleIndex !== null) {
            setValues((current) => ({
              ...current,
              items: current.items.map((item, index) => index === quickArticleIndex ? { ...item, article_id: article.id, unit_id: article.unit_id, unit_display_id: article.unit_id, conversion_factor: 1 } : item),
            }))
          }
        }}
      />
    </form>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="field-label">{label}</span><p className="mt-2 font-bold">{value}</p></div>
}
