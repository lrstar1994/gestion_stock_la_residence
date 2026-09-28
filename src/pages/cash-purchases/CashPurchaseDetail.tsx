import { CheckCircle, HandCoins, LockKeyhole, ReceiptText, Save, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cancelCashPurchaseReceipt, CashPurchaseNotFoundError, closeCashPurchase, createCashPurchaseBuyer, getCashPurchase, getCashPurchaseReceiptPreviewUrl, giveCash, justifyDifference, listCashPurchaseBuyers, refuseCashPurchase, receiveAndControlCashPurchase, saveCashPurchaseReturn, uploadCashPurchaseReceipt, validateCashPurchase, validateDifference } from '../../api/modules/cashPurchases.api'
import { assertSensitiveAction, getSensitiveActionErrorMessage } from '../../api/modules/sensitiveActions.api'
import { createSupplierFromPurchaseControl, listSuppliers } from '../../api/modules/suppliers.api'
import { getSupplierRegularizationsForPurchase, isolateSupplierRegularization } from '../../api/modules/supplierRegularizations.api'
import type { SupplierRegularization } from '../../api/modules/supplierRegularizations.api'
import { listLocations } from '../../api/modules/catalog.api'
import { getLastNormalActualPurchasePrices } from '../../api/modules/purchasePrices.api'
import { QuickSupplierDrawer } from '../../components/suppliers/QuickSupplierDrawer'
import { SupplierSearchSelect } from '../../components/suppliers/SupplierSearchSelect'
import { useAuth } from '../../hooks/useAuth'
import { canControlCashPurchase, canEnterCashReturn, canGiveCash, canValidateCashPurchases, cashPurchaseSourceLabels, cashPurchaseStatusLabels, differenceTypeLabels } from '../../lib/cashPurchases'
import { businessOriginLabels, getPurchaseNeedIntendedUseLabel, requestingServiceLabels } from '../../lib/purchaseNeeds'
import type { CashPurchase, CashPurchaseItem, CashPurchaseReceipt } from '../../lib/cashPurchases'
import type { Supplier } from '../../lib/suppliers'
import type { Location } from '../../lib/catalog'
import type { PurchasePriceClassification } from '../../lib/purchasePrices'

export function CashPurchaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [purchase, setPurchase] = useState<CashPurchase | null>(null)
  const [items, setItems] = useState<CashPurchaseItem[]>([])
  const [regularizations, setRegularizations] = useState<SupplierRegularization[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isolationLocationIds, setIsolationLocationIds] = useState<Record<string, string>>({})
  const [isolationNotes, setIsolationNotes] = useState<Record<string, string>>({})
  const [isolatingRegularizationId, setIsolatingRegularizationId] = useState<string | null>(null)
  const [amountValidated, setAmountValidated] = useState(0)
  const [amountGiven, setAmountGiven] = useState(0)
  const [handoverBuyerId, setHandoverBuyerId] = useState('')
  const [cashPurchaseBuyers, setCashPurchaseBuyers] = useState<Array<{ id: string; full_name: string | null; role: string; kind: 'profile' | 'directory'; profile_id: string | null; directory_id: string | null }>>([])
  const [showBuyerForm, setShowBuyerForm] = useState(false)
  const [newBuyerFirstName, setNewBuyerFirstName] = useState('')
  const [newBuyerLastName, setNewBuyerLastName] = useState('')
  const [newBuyerPhone, setNewBuyerPhone] = useState('')
  const [creatingBuyer, setCreatingBuyer] = useState(false)
  const [changeReturned, setChangeReturned] = useState(0)
  const [amountPaidSupplier, setAmountPaidSupplier] = useState<number | null>(null)
  const [amountReturnedToController, setAmountReturnedToController] = useState(0)
  const [normalPrices, setNormalPrices] = useState<Record<string, { normalized_unit_price: number | null; normalized_unit_id: string | null }>>({})
  const [priceQualifications, setPriceQualifications] = useState<Record<string, { classification: PurchasePriceClassification; reason: string }>>({})
  const [overrunReason, setOverrunReason] = useState('')
  const [overrunPayer, setOverrunPayer] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptFilePreviewUrl, setReceiptFilePreviewUrl] = useState<string | null>(null)
  const [activeReceiptPreview, setActiveReceiptPreview] = useState<{ url: string; fileName: string; mimeType: string | null } | null>(null)
  const [receiptPreviewLoading, setReceiptPreviewLoading] = useState(false)
  const [receiptReference, setReceiptReference] = useState('')
  const [receiptType, setReceiptType] = useState('recu')
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiptAmount, setReceiptAmount] = useState<number | null>(null)
  const [receiptSupplierId, setReceiptSupplierId] = useState('')
  const [receiptLineIds, setReceiptLineIds] = useState<string[]>([])
  const [receiptDescription, setReceiptDescription] = useState('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [showReceiptForm, setShowReceiptForm] = useState(false)
  const [closingComment, setClosingComment] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false)
  const [quickSupplierItemId, setQuickSupplierItemId] = useState<string | undefined>()
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [validationPin, setValidationPin] = useState('')
  const [validating, setValidating] = useState(false)
  const [controlling, setControlling] = useState(false)
  const [controlError, setControlError] = useState<string | null>(null)
  const canValidate = canValidateCashPurchases(profile?.role)
  const canGive = canGiveCash(profile?.role)
  const canReturn = canEnterCashReturn(profile?.role)
  const canControl = canControlCashPurchase(profile?.role)
  const isStorekeeper = profile?.role === 'magasinier'

  const updatePriceQualification = (itemId: string | undefined, patch: Partial<{ classification: PurchasePriceClassification; reason: string }>) => {
    if (!itemId) return
    setPriceQualifications((current) => ({
      ...current,
      [itemId]: { classification: current[itemId]?.classification ?? 'normal', reason: current[itemId]?.reason ?? '', ...patch },
    }))
  }

  const load = useCallback(async (options: {
    preserveAmountPaidSupplier?: boolean
    preserveControlDraft?: boolean
  } = {}) => {
    if (!id) return false
    try {
      const loaded = await getCashPurchase(id)
      setPurchase(loaded)
      const loadedItems = loaded.cash_purchase_items ?? []
      const articleIds = [...new Set(loadedItems.map((item) => item.article_id).filter((articleId): articleId is string => Boolean(articleId)))]
      if (articleIds.length > 0) {
        try {
          const prices = await getLastNormalActualPurchasePrices(articleIds)
          setNormalPrices(Object.fromEntries(prices.map((price) => [price.article_id, { normalized_unit_price: price.normalized_unit_price, normalized_unit_id: price.normalized_unit_id }])))
        } catch (error) {
          setNormalPrices({})
          console.error('[CashPurchaseDetail] Lecture des derniers prix NORMAL échouée', error)
        }
      } else {
        setNormalPrices({})
      }
      setPriceQualifications((current) => {
        const next = { ...current }
        for (const item of loadedItems) {
          if (item.id && !next[item.id]) next[item.id] = { classification: 'normal', reason: '' }
        }
        return next
      })
      setReceiptSupplierId(loaded.supplier_id ?? '')
      setAmountValidated(Number(loaded.amount_validated || loaded.amount_requested || 0))
      setAmountGiven(Number(loaded.amount_given ?? 0))
      setHandoverBuyerId(loaded.given_at ? (loaded.buyer_directory_id ? `directory:${loaded.buyer_directory_id}` : loaded.buyer_id ? `profile:${loaded.buyer_id}` : '') : '')
      if (!options.preserveControlDraft) {
        setItems(loaded.cash_purchase_items ?? [])
        setChangeReturned(Number(loaded.change_returned || 0))
        setAmountReturnedToController(Number(loaded.amount_returned_to_controller ?? 0))
      }
      if (!options.preserveControlDraft && !options.preserveAmountPaidSupplier) {
        setAmountPaidSupplier(loaded.amount_paid_supplier == null ? null : Number(loaded.amount_paid_supplier))
      }
      try {
        setRegularizations(await getSupplierRegularizationsForPurchase(id))
      } catch (error) {
        setRegularizations([])
        toast.error('Dossier chargé, mais les régularisations sont indisponibles.')
        console.error('[CashPurchaseDetail] Lecture secondaire des régularisations échouée', describeReadError(error))
      }
      return true
    } catch (error) {
      if (error instanceof CashPurchaseNotFoundError) {
        toast.error('Dossier introuvable')
        navigate('/cash-purchases')
        return false
      }
      toast.error('Impossible de charger le dossier. Consultez les détails techniques dans la console.')
      console.error('[CashPurchaseDetail] Lecture principale du dossier échouée', describeReadError(error))
      return false
    }
  }, [id, navigate])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!receiptFile) {
      setReceiptFilePreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(receiptFile)
    setReceiptFilePreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [receiptFile])

  useEffect(() => {
    listSuppliers().then(setSuppliers).catch(() => toast.error('Impossible de charger les fournisseurs'))
  }, [])

  useEffect(() => {
    if (!canGive) return
    listCashPurchaseBuyers().then(setCashPurchaseBuyers).catch(() => toast.error('Impossible de charger les acheteurs actifs'))
  }, [canGive])

  useEffect(() => {
    if (isStorekeeper) listLocations().then(setLocations).catch(() => toast.error('Impossible de charger les emplacements'))
  }, [isStorekeeper])

  if (!purchase) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const totalReal = items.reduce((sum, item) => sum + Number(item.quantity_bought ?? 0) * Number(item.unit_price_real ?? 0), 0)
  const activeReceipts = (purchase.cash_purchase_receipts ?? []).filter((receipt) => !receipt.cancelled_at)
  const totalReceiptAmount = activeReceipts.reduce((sum, receipt) => sum + Number(receipt.document_amount ?? 0), 0)
  const receiptAmountDifference = Number(amountPaidSupplier ?? 0) - totalReceiptAmount
  const amountRemis = Number(purchase.amount_given ?? 0)
  const directionSpendingLimit = Number(purchase.amount_validated ?? 0)
  const minimumCashExpectedBack = Math.max(0, amountRemis - directionSpendingLimit)
  const previewMinimumCashExpectedBack = Math.max(0, amountGiven - directionSpendingLimit)
  const expectedChange = Math.max(0, amountRemis - Number(amountPaidSupplier ?? 0))
  const cashReturnShortage = Math.max(0, expectedChange - Number(purchase.amount_returned_to_controller ?? amountReturnedToController ?? 0))
  const cashReturnSurplus = Math.max(0, Number(purchase.amount_returned_to_controller ?? amountReturnedToController ?? 0) - expectedChange)
  const overrunAmount = Math.max(0, totalReal - amountRemis)
  const moneyDifference = Math.max(cashReturnShortage, cashReturnSurplus)
  const differenceRequiresDirection = overrunAmount > 0 || moneyDifference > amountRemis * 0.1
  const controlRegularizationAmount = (purchase.cash_purchase_differences ?? [])
    .filter((item) => item.difference_type === 'control_regularization')
    .reduce((sum, item) => sum + Math.max(0, Number(item.amount ?? 0)), 0)
  const hasReceipt = activeReceipts.some((receipt) => Boolean(receipt.file_url?.trim()))
  const hasOpenDifference = (purchase.cash_purchase_differences ?? []).some((item) => item.status !== 'valide' && Number(item.amount) > 0)
  const hasUnresolvedMoneyDifference = cashReturnShortage > 0 || cashReturnSurplus > 0 || overrunAmount > 0
  const canCloseFile = (purchase.status === 'retour_partiel' || purchase.status === 'retour_complet') && hasReceipt && !hasOpenDifference && !hasUnresolvedMoneyDifference
  const relay = getCashPurchaseRelay(purchase, hasReceipt)
  const receiptSupplierName = suppliers.find((supplier) => supplier.id === receiptSupplierId)?.name ?? ''
  const normalizedReceiptSupplier = receiptSupplierName.trim().toLocaleLowerCase('fr-FR')
  const receiptSelectableItems = [...items].sort((left, right) => {
    const leftMatches = Boolean(normalizedReceiptSupplier && left.supplier?.trim().toLocaleLowerCase('fr-FR') === normalizedReceiptSupplier)
    const rightMatches = Boolean(normalizedReceiptSupplier && right.supplier?.trim().toLocaleLowerCase('fr-FR') === normalizedReceiptSupplier)
    return Number(rightMatches) - Number(leftMatches)
  })
  const receiptSupplierMismatches = items.filter((item) => item.id && receiptLineIds.includes(item.id) && item.supplier?.trim() && normalizedReceiptSupplier && item.supplier.trim().toLocaleLowerCase('fr-FR') !== normalizedReceiptSupplier)
  const receiptWorkflowVisible = ['especes_remises', 'retour_partiel', 'retour_complet'].includes(purchase.status)
  const canAddReceipt = profile?.role === 'direction'
    ? canControl && receiptWorkflowVisible
    : profile?.role === 'controleur' && purchase.status === 'especes_remises' && !purchase.controlled_at
  const canCancelReceipt = canControl && !purchase.controlled_at

  const validate = async () => {
    setValidationPin('')
    setPinDialogOpen(true)
  }

  const confirmValidation = async () => {
    if (!validationPin.trim()) {
      toast.error('PIN Direction requis pour valider le décaissement')
      return
    }
    try {
      setValidating(true)
      await assertSensitiveAction('cash_purchases.validate', validationPin, 'cash_purchase.validate', 'cash_purchase', purchase.id)
      await validateCashPurchase(purchase.id, amountValidated, profile?.id)
      setPinDialogOpen(false)
      setValidationPin('')
      toast.success('Décaissement validé par la Direction : ' + Number(amountValidated).toLocaleString('fr-FR') + ' Ar. Relais Caisse à venir.')
      await load()
    } catch (error) {
      toast.error(getSensitiveActionErrorMessage(error))
    } finally {
      setValidating(false)
    }
  }
  const refuse = async () => {
    const reason = window.prompt('Motif du refus')
    if (!reason) return
    await refuseCashPurchase(purchase.id, profile?.id, reason)
    toast.success('Demande refusee')
    await load()
  }

  const give = async () => {
    if (!handoverBuyerId) {
      toast.error('Acheteur obligatoire : sélectionnez la personne qui reçoit effectivement les espèces')
      return
    }
    const pin = window.prompt('PIN Caisse requis')
    if (!pin) return
    try {
      const [kind, buyerId] = handoverBuyerId.split(':')
      await giveCash(purchase.id, amountGiven, pin, kind === 'directory' ? { directoryId: buyerId } : { profileId: buyerId })
      toast.success('Especes remises avec succes')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Remise refusee')
    }
  }
  const saveReturn = async () => {
    if (overrunAmount > 0 && (!overrunReason.trim() || !overrunPayer)) {
      toast.error('Motif du dépassement et prise en charge du complément obligatoires')
      return
    }
    await saveCashPurchaseReturn(purchase.id, items, changeReturned, profile?.id, overrunReason, overrunPayer)
    toast.success("Retour d'achat enregistre avec succes")
    await load({ preserveAmountPaidSupplier: true })
  }
  const controlReturn = async () => {
    const trace = (event: string, details?: Record<string, unknown>) => {
      if (import.meta.env.DEV) console.debug(`[CashPurchaseDetail] ${event}`, { purchaseId: purchase.id, ...details })
    }

    setControlError(null)
    trace('control validation started')
    const hasReceiptScan = (purchase.cash_purchase_receipts ?? []).some((receipt) => !receipt.cancelled_at && Boolean(receipt.file_url?.trim()))
    if (!hasReceiptScan) {
      const message = 'Enregistrez au moins un justificatif actif avec scan ou photo avant de confirmer le contrôle.'
      setControlError(message)
      toast.error(message)
      trace('control stopped: active scanned receipt missing')
      return
    }
    const pin = window.prompt('PIN Contrôleur requis')
    if (pin === null) {
      trace('control cancelled at PIN prompt')
      return
    }
    if (!pin.trim()) {
      const message = 'PIN Contrôleur requis pour confirmer le contrôle.'
      setControlError(message)
      toast.error(message)
      trace('control stopped: empty PIN received')
      return
    }

    trace('PIN received', { pinProvided: true })
    if (amountPaidSupplier === null || !Number.isFinite(amountPaidSupplier) || amountPaidSupplier < 0) {
      const message = 'Renseignez un montant payé aux fournisseurs valide avant le contrôle.'
      setControlError(message)
      toast.error(message)
      trace('control stopped: invalid supplier-paid amount', { amountPaidSupplier })
      return
    }
    if (!Number.isFinite(amountReturnedToController) || amountReturnedToController < 0) {
      const message = 'Renseignez un montant de monnaie remise au Contrôleur valide.'
      setControlError(message)
      toast.error(message)
      trace('control stopped: invalid returned cash amount', { amountReturnedToController })
      return
    }

    const controlItems = items.map((item) => ({
      item_id: item.id,
      quantity_bought: item.quantity_bought,
      quantity_bought_stock: item.quantity_bought_stock,
      conversion_factor: item.conversion_factor,
      unit_price_real: item.unit_price_real,
      unit_price_real_stock: item.unit_price_real_stock,
      supplier: item.supplier,
      invoice_number: item.invoice_number,
      invoice_date: item.invoice_date,
      comment: item.comment,
      quantity_accepted: item.quantity_accepted ?? item.quantity_bought,
      control_comment: item.control_comment,
      price_classification: item.article_id ? (priceQualifications[item.id ?? '']?.classification ?? 'normal') : null,
      price_qualification_reason: item.article_id ? (priceQualifications[item.id ?? '']?.reason ?? null) : null,
    }))
    if (controlItems.some((item) => !item.item_id)) {
      const message = 'Une ligne d’achat ne possède pas d’identifiant. Rechargez le dossier avant de confirmer le contrôle.'
      setControlError(message)
      toast.error(message)
      trace('control stopped: line without item id', { itemCount: controlItems.length })
      return
    }
    const missingQualificationReason = items.find((item) => {
      if (!item.article_id) return false
      const qualification = priceQualifications[item.id ?? ''] ?? { classification: 'normal' as const, reason: '' }
      return qualification.classification !== 'normal' && !qualification.reason.trim()
    })
    if (missingQualificationReason) {
      const message = 'Un motif est obligatoire pour chaque prix promotionnel ou exceptionnel.'
      setControlError(message)
      toast.error(message)
      trace('control stopped: price qualification reason missing', { itemId: missingQualificationReason.id })
      return
    }

    const payload = {
      amount_paid_supplier: amountPaidSupplier,
      amount_returned_to_controller: amountReturnedToController,
      items: controlItems,
    }
    trace('control payload built', { payload })
    try {
      setControlling(true)
      trace('RPC receive_and_control_cash_purchase started')
      const result = await receiveAndControlCashPurchase(purchase.id, payload, pin)
      trace('RPC receive_and_control_cash_purchase succeeded', { result })
      if (result.id !== purchase.id || typeof result.controlled_at !== 'string' || !result.controlled_at) {
        throw new Error('Réponse RPC incomplète : le serveur n’a pas confirmé l’enregistrement du contrôle.')
      }
      const reloaded = await load()
      if (!reloaded) {
        const message = 'Le contrôle a été enregistré, mais le dossier n’a pas pu être rechargé. Actualisez la page pour vérifier son état.'
        setControlError(message)
        toast.error(message)
        return
      }
      setControlError(null)
      toast.success('Réception et contrôle confirmés')
    } catch (error) {
      const message = getControlErrorMessage(error)
      setControlError(message)
      toast.error(`Contrôle non enregistré : ${message}`)
      trace('RPC receive_and_control_cash_purchase failed', { error: describeControlError(error) })
    } finally {
      setControlling(false)
    }
  }
  const createBuyer = async () => {
    if (!newBuyerFirstName.trim() || !newBuyerLastName.trim()) {
      toast.error('Nom et prénom de l’acheteur obligatoires')
      return
    }
    setCreatingBuyer(true)
    try {
      const directoryId = await createCashPurchaseBuyer(newBuyerFirstName, newBuyerLastName, newBuyerPhone)
      const buyers = await listCashPurchaseBuyers()
      setCashPurchaseBuyers(buyers)
      setHandoverBuyerId(`directory:${directoryId}`)
      setNewBuyerFirstName('')
      setNewBuyerLastName('')
      setNewBuyerPhone('')
      setShowBuyerForm(false)
      toast.success('Acheteur ajouté au répertoire')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’ajouter l’acheteur')
    } finally {
      setCreatingBuyer(false)
    }
  }

  const isolateRegularization = async (regularizationId: string) => {
    const locationId = isolationLocationIds[regularizationId]
    if (!locationId) {
      toast.error('Sélectionnez l’emplacement physique')
      return
    }
    try {
      setIsolatingRegularizationId(regularizationId)
      await isolateSupplierRegularization(regularizationId, locationId, isolationNotes[regularizationId])
      setRegularizations(await getSupplierRegularizationsForPurchase(purchase.id))
      toast.success('Marchandise isolée et localisée')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de localiser la marchandise')
    } finally {
      setIsolatingRegularizationId(null)
    }
  }

  const addJustificatif = async () => {
    if (!canAddReceipt) return
    if (!receiptFile) {
      toast.error('Selectionnez un justificatif')
      return
    }
    if (!receiptSupplierId) {
      toast.error('Sélectionnez le fournisseur du justificatif')
      return
    }
    if (!receiptDate) {
      toast.error('Renseignez la date du justificatif')
      return
    }
    if (receiptAmount === null || !Number.isFinite(receiptAmount) || receiptAmount < 0) {
      toast.error('Renseignez le montant du justificatif')
      return
    }
    if (receiptLineIds.length === 0) {
      toast.error('Sélectionnez au moins une ligne couverte par le justificatif')
      return
    }
    try {
      setUploadingReceipt(true)
      const nextReceiptSupplierId = receiptSupplierId
      await uploadCashPurchaseReceipt(
        purchase.id,
        receiptFile,
        receiptDescription,
        profile?.id,
        {
          documentType: receiptType,
          supplierId: receiptSupplierId,
          documentDate: receiptDate,
          documentAmount: receiptAmount,
          supplierDocumentNumber: receiptReference || null,
          lineIds: receiptLineIds,
          profileRole: profile?.role,
        },
      )
      toast.success('Justificatif enregistré. Vous pouvez en ajouter un autre.')
      setReceiptFile(null)
      setReceiptReference('')
      setReceiptDate(new Date().toISOString().slice(0, 10))
      setReceiptAmount(null)
      setReceiptLineIds([])
      setReceiptDescription('')
      await load({ preserveControlDraft: true })
      setReceiptSupplierId(nextReceiptSupplierId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d envoyer le justificatif')
    } finally {
      setUploadingReceipt(false)
    }
  }

  const cancelReceipt = async (receiptId: string) => {
    const reason = window.prompt('Motif obligatoire de l’annulation de cette pièce')
    if (reason === null) return
    if (!reason.trim()) {
      toast.error('Motif d’annulation obligatoire')
      return
    }
    try {
      await cancelCashPurchaseReceipt(receiptId, reason)
      toast.success('Pièce annulée. Elle reste visible dans l’historique.')
      await load({ preserveControlDraft: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’annuler la pièce')
    }
  }

  const openSavedReceiptPreview = async (receipt: CashPurchaseReceipt) => {
    if (!receipt.file_url?.trim()) {
      toast.error('Aucun fichier n’est enregistré pour ce justificatif.')
      return
    }
    setReceiptPreviewLoading(true)
    setActiveReceiptPreview({ url: '', fileName: receipt.file_name, mimeType: receipt.mime_type })
    try {
      const url = await getCashPurchaseReceiptPreviewUrl(receipt.file_url)
      setActiveReceiptPreview({ url, fileName: receipt.file_name, mimeType: receipt.mime_type })
    } catch (error) {
      setActiveReceiptPreview(null)
      toast.error(error instanceof Error ? error.message : 'Impossible d’ouvrir l’aperçu du justificatif.')
    } finally {
      setReceiptPreviewLoading(false)
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

  const computeReturnPatch = (item: CashPurchaseItem, patch: Partial<CashPurchaseItem>) => {
    const next = { ...item, ...patch }
    const factor = Number(next.conversion_factor ?? 1)
    const quantityBought = Number(next.quantity_bought ?? 0)
    const unitPriceReal = Number(next.unit_price_real ?? 0)

    return {
      ...patch,
      quantity_bought_stock: quantityBought * factor,
      unit_price_real_stock: factor > 0 ? unitPriceReal / factor : unitPriceReal,
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Achat en especes</p><h1 className="page-title mt-2">{purchase.reference}</h1><p className="mt-2 text-sm text-slate-600">{cashPurchaseSourceLabels[purchase.cash_source]} - {cashPurchaseStatusLabels[purchase.status]}</p></div>
        <Link to="/cash-purchases" className="btn-secondary">Retour</Link>
      </header>

      <section className="surface border-l-4 border-[#1E3A8A] p-5">
        <h2 className="text-lg font-bold">Synthèse du besoin</h2>
        <div className="mt-3 space-y-4">
          {(items.length ? items : purchase.cash_purchase_items ?? []).map((item) => {
            const need = item.purchase_needs
            return <div key={item.id} className="border-b border-slate-200 pb-3 last:border-b-0 last:pb-0"><p className="whitespace-pre-wrap break-words text-base font-bold text-slate-950">{need?.justification || 'Justification non renseignée'}</p><p className="mt-1 text-sm text-slate-600">{need?.business_origin ? businessOriginLabels[need.business_origin] : 'Origine non renseignée'} · Service demandeur : {need?.service_demandeur ? requestingServiceLabels[need.service_demandeur] : 'Non renseigné'}</p><p className="mt-1 font-semibold">Montant autorisé par la Direction : {Number(purchase.amount_validated ?? purchase.amount_requested ?? 0).toLocaleString('fr-FR')} Ar</p><p className="mt-1 text-sm font-semibold">{item.articles?.name ?? item.free_designation ?? 'Article'} · {Number(item.quantity_planned ?? 0).toLocaleString('fr-FR')} {item.units?.abbreviation ?? ''}</p></div>
          })}
          {items.length === 0 && (purchase.cash_purchase_items ?? []).length === 0 && <><p className="whitespace-pre-wrap break-words text-base font-bold text-slate-950">{purchase.reason || 'Justification non renseignée'}</p><p className="mt-1 font-semibold">Montant autorisé par la Direction : {Number(purchase.amount_validated ?? purchase.amount_requested ?? 0).toLocaleString('fr-FR')} Ar</p></>}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Acheteur" value={purchase.given_at ? (purchase.buyer_directory?.full_name || purchase.buyer?.full_name || 'Acheteur non affecté') : 'Acheteur à désigner'} />
        <Info label="Montant demande" value={`${Number(purchase.amount_requested).toLocaleString('fr-FR')} Ar`} />
        <Info label="Montant autorisé Direction" value={`${directionSpendingLimit.toLocaleString('fr-FR')} Ar`} />
        <Info label="Montant remis Caisse" value={`${amountRemis.toLocaleString('fr-FR')} Ar`} />
        <div><Info label="Monnaie minimale prévisionnelle (avant achat)" value={`${minimumCashExpectedBack.toLocaleString('fr-FR')} Ar`} /><p className="mt-1 text-xs text-slate-500">Calculée sur le montant payable estimé TTC. La monnaie réelle sera recalculée selon le montant effectivement payé.</p></div>
        <Info label="Ecart de monnaie net" value={`${(cashReturnShortage - cashReturnSurplus).toLocaleString('fr-FR')} Ar`} />
      </section>

      {regularizations.length > 0 && <section className="surface p-5"><h2 className="text-lg font-bold">RÉGULARISATIONS FOURNISSEURS</h2><div className="mt-3 space-y-3">{regularizations.map((r) => <div key={r.id} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"><p>Quantité refusée : {Number(r.quantity_refused).toLocaleString('fr-FR')} · Valeur à régulariser : {Number(r.value_to_regularize).toLocaleString('fr-FR')} Ar</p><p>Traitement : {r.treatment_type ?? 'À décider'} · Statut : {r.status === 'awaiting_isolation' ? 'En attente d’isolation' : r.status === 'awaiting_treatment_decision' ? 'Traitement à décider' : r.status} · Responsable actuel : {r.current_responsible_role === 'magasinier' ? 'Magasin' : r.current_responsible_role === 'controleur' ? 'Contrôle' : r.current_responsible_role}</p><p>Localisation physique : {r.locations?.name ?? 'Non renseignée'}{r.physical_location_note ? ` — ${r.physical_location_note}` : ''} · Ouverte le : {new Date(r.opened_at).toLocaleString('fr-FR')}</p>{isStorekeeper && r.status === 'awaiting_isolation' && r.current_responsible_role === 'magasinier' && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="field-label">Emplacement physique</span><select className="input mt-1" value={isolationLocationIds[r.id] ?? ''} onChange={(event) => setIsolationLocationIds((current) => ({ ...current, [r.id]: event.target.value }))}><option value="">Sélectionner un emplacement</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label><span className="field-label">Note de localisation (facultative)</span><input className="input mt-1" value={isolationNotes[r.id] ?? ''} onChange={(event) => setIsolationNotes((current) => ({ ...current, [r.id]: event.target.value }))} /></label><button type="button" className="btn-primary sm:col-span-2 sm:justify-self-start" disabled={isolatingRegularizationId === r.id} onClick={() => isolateRegularization(r.id)}>{isolatingRegularizationId === r.id ? 'Enregistrement…' : 'Isoler et localiser'}</button></div>}</div>)}</div></section>}

      <p className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        Le plafond de dépense reste le montant autorisé par la Direction : {directionSpendingLimit.toLocaleString('fr-FR')} Ar,
        même si la Caisse remet davantage. La monnaie minimale avant achat correspond au montant remis moins ce plafond,
        avec un minimum de 0 Ar. La monnaie réellement attendue dépendra des achats effectués.
      </p>

      <section className="surface p-5">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Relais de l'achat especes</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">{relay.currentStatus}</h2>
          </div>
          <span className="w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-[#1E3A8A]">Etape {relay.currentStep} sur 7</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <RelayInfo label="ÉTAPE ACTUELLE" value={relay.currentStage} />
          <RelayInfo label="Responsable actuel" value={relay.currentOwner} />
          <RelayInfo label="Action attendue" value={relay.expectedAction} />
          <RelayInfo label="Prochain responsable" value={relay.nextOwner} />
          <RelayInfo label="Prochain statut" value={relay.nextStatus} />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-7">
          {cashPurchaseWorkflowSteps.map((step) => {
            const state = purchase.status === 'cloture' || step.number < relay.currentStep
              ? 'done'
              : step.number === relay.currentStep
                ? 'current'
                : 'upcoming'
            return <WorkflowStep key={step.number} step={step} state={state} />
          })}
        </div>
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-900">Étapes déjà passées</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {relay.history.map((entry) => <li key={entry}>- {entry}</li>)}
          </ul>
        </div>
      </section>

      <RelayMarker title={relay.currentStep >= 4 ? "RELAIS CAISSE EFFECTUÉ" : "RELAIS CAISSE À VENIR"} value={relay.currentStep >= 4 ? `Espèces remises par la Caisse — Montant remis : ${Number(purchase.amount_given ?? 0).toLocaleString('fr-FR')} Ar` : `Espèces à remettre par la Caisse — Montant attendu : ${Number(purchase.amount_validated ?? purchase.amount_requested ?? 0).toLocaleString('fr-FR')} Ar`} detail={getCashStatusLabel(purchase)} />
      <section className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        {'Le Contr\u00f4le verifie le retour d achat avant le relais au Magasin / Stock. Un ecart de monnaie reste visible et doit etre arbitre, sans masquer le responsable ni l action attendue.'}
      </section>

      <section className="surface p-5">
        <p className="font-semibold text-slate-950">{purchase.reason}</p>
        <p className="mt-2 text-sm text-slate-600">Date demande : {new Date(purchase.request_date).toLocaleDateString('fr-FR')} / achat prevu : {purchase.purchase_date ? new Date(purchase.purchase_date).toLocaleDateString('fr-FR') : '-'}</p>
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-bold">Besoins couverts par cet achat</h2>
        <div className="mt-3 space-y-3">
          {(items.length ? items : purchase.cash_purchase_items ?? []).map((item) => {
            const need = item.purchase_needs
            return <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm"><p className="font-semibold">{item.articles?.name ?? item.free_designation ?? 'Article'} · {Number(item.quantity_planned ?? 0).toLocaleString('fr-FR')} {item.units?.abbreviation ?? ''}</p><p className="mt-1 whitespace-pre-wrap break-words text-slate-800">{need?.justification || 'Justification non renseignée'}</p><p className="mt-1 text-xs text-slate-500">{need?.business_origin ? businessOriginLabels[need.business_origin] : 'Origine non renseignée'} · Utilisation : {need ? getPurchaseNeedIntendedUseLabel(need) : '—'} · Demandeur : {need?.requester?.full_name ?? 'Demandeur non renseigné'}</p></div>
          })}
          {items.length === 0 && (purchase.cash_purchase_items ?? []).length === 0 && <p className="text-sm text-slate-500">Aucune ligne de besoin détaillée.</p>}
        </div>
      </section>

      {canValidate && purchase.status === 'en_attente' && (
        <section className="surface flex flex-col gap-3 p-5 lg:flex-row lg:items-end">
          <label className="block"><span className="field-label">Montant valide par Direction</span><input value={amountValidated} onChange={(event) => setAmountValidated(Number(event.target.value))} type="number" className="input mt-2" /></label>
          <button type="button" onClick={validate} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" /> Valider le decaissement</button>
          <button type="button" onClick={refuse} className="btn-secondary text-red-700"><XCircle className="mr-2 h-4 w-4" /> Refuser</button>
        </section>
      )}

      {pinDialogOpen && (
        <section className="surface border-2 border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-bold text-amber-950">PIN Direction requis pour valider le décaissement</h2>
          <p className="mt-2 text-sm text-amber-900">Montant à valider : {Number(amountValidated).toLocaleString('fr-FR')} Ar</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block"><span className="field-label">PIN Direction</span><input type="password" inputMode="numeric" autoComplete="off" value={validationPin} onChange={(event) => setValidationPin(event.target.value)} className="input mt-2" /></label>
            <button type="button" onClick={confirmValidation} disabled={validating} className="btn-primary">{validating ? 'Vérification...' : 'Confirmer'}</button>
            <button type="button" onClick={() => { setPinDialogOpen(false); setValidationPin('') }} disabled={validating} className="btn-secondary">Annuler</button>
          </div>
        </section>
      )}
      {canGive && purchase.status === 'valide' && (
        <section className="surface flex flex-col gap-3 p-5 lg:flex-row lg:items-end">
          <div className="block min-w-64"><span className="field-label">Acheteur / personne recevant effectivement l’argent</span><select value={handoverBuyerId} onChange={(event) => setHandoverBuyerId(event.target.value)} className="input mt-2"><option value="">Acheteur à désigner</option>{cashPurchaseBuyers.map((buyer) => <option key={`${buyer.kind}:${buyer.id}`} value={`${buyer.kind}:${buyer.kind === 'directory' ? buyer.directory_id : buyer.profile_id}`}>{buyer.full_name ?? buyer.id}</option>)}</select><button type="button" className="mt-2 text-sm font-semibold text-[#1E3A8A]" onClick={() => setShowBuyerForm((open) => !open)}>+ Ajouter un acheteur sans compte</button><span className="mt-1 block text-xs text-slate-500">La Direction autorise le montant ; la Caisse désigne l’acheteur au moment de la remise.</span>{showBuyerForm && <div className="mt-2 grid gap-2 rounded border border-slate-200 bg-white p-3"><input className="input" placeholder="Prénom" value={newBuyerFirstName} onChange={(event) => setNewBuyerFirstName(event.target.value)} /><input className="input" placeholder="Nom" value={newBuyerLastName} onChange={(event) => setNewBuyerLastName(event.target.value)} /><input className="input" placeholder="Téléphone (facultatif)" value={newBuyerPhone} onChange={(event) => setNewBuyerPhone(event.target.value)} /><button type="button" className="btn-secondary" disabled={creatingBuyer} onClick={createBuyer}>{creatingBuyer ? 'Ajout…' : 'Enregistrer l’acheteur'}</button></div>}</div>
          <label className="block"><span className="field-label">Montant remis par la caisse</span><input value={amountGiven} onChange={(event) => setAmountGiven(Number(event.target.value))} type="number" className="input mt-2" /></label>
          <button type="button" onClick={give} className="btn-primary"><HandCoins className="mr-2 h-4 w-4" /> Confirmer remise especes</button>
          <p className="text-sm text-slate-600">Pour cette saisie, monnaie minimale attendue au retour (avant achat) : {previewMinimumCashExpectedBack.toLocaleString('fr-FR')} Ar. Plafond Direction inchangé : {directionSpendingLimit.toLocaleString('fr-FR')} Ar.</p>
        </section>
      )}

      <RelayMarker title={relay.currentStep >= 5 ? "Contrôle retour achat" : "Contrôle retour achat à venir"} value={relay.currentStep >= 5 ? "En attente de Contrôle : retour achat à vérifier" : "Contrôle après remise des espèces et retour achat"} detail="L’acheteur rapporte les marchandises, justificatifs et monnaie avant le passage au Contrôle." />

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_100px_120px_100px_120px_180px_180px_180px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Quantite prevue</span><span>Prix estime</span><span>Quantite achetee</span><span>Prix reel</span><span>Valeurs déclarées / acceptées</span><span>Comparaison</span><span>Fournisseur reel</span>
        </div>
        <div className="divide-y divide-slate-200">
          {items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_100px_120px_100px_120px_180px_180px_180px] xl:items-center">
              <span className="font-semibold">
                {item.articles?.name ?? item.free_designation ?? 'Article Ã  rapprocher'}
                {item.article_match_status === 'to_create_or_match' && <span className="mt-1 block text-xs font-semibold text-amber-700">Article Ã  crÃ©er / Ã  rapprocher</span>}
              </span>
              <span>{Number(item.quantity_planned).toLocaleString('fr-FR')} {item.units?.abbreviation}</span>
              <div><span>{item.purchase_needs?.tax_treatment === 'ht_add_vat' ? 'Prix estimé HT' : item.purchase_needs?.tax_treatment === 'ttc_included' ? 'Prix estimé TTC' : item.purchase_needs?.tax_treatment === 'no_vat' ? 'Prix estimé sans TVA' : 'Prix estimé'} : {Number(item.unit_price_estimated).toLocaleString('fr-FR')} Ar</span>{item.purchase_needs?.tax_treatment === 'ht_add_vat' && <><span className="block text-xs text-slate-500">TVA : {Number(item.purchase_needs.vat_rate ?? 0).toLocaleString('fr-FR')} %</span><span className="block text-xs font-semibold text-slate-700">Prix estimé TTC : {Number(item.purchase_needs.estimated_price_ttc ?? 0).toLocaleString('fr-FR')} Ar</span><span className="block text-xs font-semibold text-slate-700">Total payable estimé TTC : {Number(item.purchase_needs.estimated_payable_amount ?? 0).toLocaleString('fr-FR')} Ar</span></>}</div>
              <label><span className="block text-xs font-bold text-slate-500">Quantité livrée</span><NumericEntry aria-label="Quantité livrée" disabled={!canControl || purchase.status !== 'especes_remises'} value={Number(item.quantity_bought ?? 0)} onChange={(value) => updateItem(item.id, computeReturnPatch(item, { quantity_bought: value ?? 0 }))} min={0} className="input" /></label>
              <label><span className="block text-xs font-bold text-slate-500">PU réel</span><NumericEntry aria-label="PU réel" disabled={!canControl || purchase.status !== 'especes_remises'} value={Number(item.unit_price_real ?? 0)} onChange={(value) => updateItem(item.id, computeReturnPatch(item, { unit_price_real: value ?? 0 }))} min={0} className="input" /></label>
              <label><span className="block text-xs font-bold text-slate-500">Quantité acceptée au contrôle</span><NumericEntry aria-label="Quantité acceptée au contrôle" disabled={!canControl} value={Number(item.quantity_accepted ?? item.quantity_bought ?? 0)} onChange={(value) => updateItem(item.id, { quantity_accepted: value ?? 0 })} min={0} className="input" /></label>
              <div><span className="block font-semibold">Valeur livrée / facturée : {(Number(item.quantity_bought ?? 0) * Number(item.unit_price_real ?? 0)).toLocaleString('fr-FR')} Ar</span><span className="block text-xs text-slate-600">Valeur acceptée au contrôle : {(Number(item.quantity_accepted ?? 0) * Number(item.unit_price_real ?? 0)).toLocaleString('fr-FR')} Ar</span><span className="block text-xs text-amber-700">Valeur à régulariser : {(Math.max(0, Number(item.quantity_bought ?? 0) - Number(item.quantity_accepted ?? 0)) * Number(item.unit_price_real ?? 0)).toLocaleString('fr-FR')} Ar</span></div>
              <div className="rounded-md bg-slate-50 px-2 py-2 text-xs text-slate-600"><p className="font-bold text-slate-700">Écart</p><p>Quantité : {(Number(item.quantity_bought ?? 0) - Number(item.quantity_planned ?? 0)).toLocaleString('fr-FR')} {item.units?.abbreviation ?? ''}</p><p>Prix de référence TTC : {Number(item.purchase_needs?.tax_treatment === 'ht_add_vat' ? (item.purchase_needs.estimated_price_ttc ?? item.unit_price_estimated) : item.unit_price_estimated).toLocaleString('fr-FR')} Ar</p><p>Prix réel payé TTC : {Number(item.unit_price_real ?? 0).toLocaleString('fr-FR')} Ar</p><p>Écart prix homogène : {(Number(item.unit_price_real ?? 0) - Number(item.purchase_needs?.tax_treatment === 'ht_add_vat' ? (item.purchase_needs.estimated_price_ttc ?? item.unit_price_estimated) : item.unit_price_estimated)).toLocaleString('fr-FR')} Ar</p><p>Montant : {(Number(item.quantity_bought ?? 0) * Number(item.unit_price_real ?? 0) - Number(item.quantity_planned ?? 0) * Number(item.purchase_needs?.tax_treatment === 'ht_add_vat' ? (item.purchase_needs.estimated_price_ttc ?? item.unit_price_estimated) : item.unit_price_estimated)).toLocaleString('fr-FR')} Ar</p></div>
              <SupplierSearchSelect
                suppliers={suppliers}
                value={suppliers.find((supplier) => supplier.name.toLowerCase() === (item.supplier ?? '').toLowerCase())?.id ?? ''}
                onChange={(supplierId) => updateItem(item.id, { supplier: suppliers.find((supplier) => supplier.id === supplierId)?.name ?? '' })}
                onCreate={() => { setQuickSupplierItemId(item.id); setQuickSupplierOpen(true) }}
                disabled={!canControl || purchase.status !== 'especes_remises'}
                emptyLabel="Fournisseur reel"
              />
              {item.article_id && <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs xl:col-span-8">
                <p className="font-semibold text-slate-700">Dernier prix NORMAL connu</p>
                <p className="mt-1 text-slate-600">{normalPrices[item.article_id]
                  ? normalPrices[item.article_id].normalized_unit_price == null
                    ? 'Prix NORMAL existant, coût normalisé indisponible'
                    : `${Number(normalPrices[item.article_id].normalized_unit_price).toLocaleString('fr-FR')} Ar`
                  : 'Aucun'}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label><span className="field-label">Qualification</span><select value={priceQualifications[item.id ?? '']?.classification ?? 'normal'} onChange={(event) => updatePriceQualification(item.id, { classification: event.target.value as PurchasePriceClassification })} disabled={!canControl || purchase.status !== 'especes_remises'} className="input mt-1"><option value="normal">NORMAL</option><option value="promotional">PROMOTIONNEL</option><option value="exceptional">EXCEPTIONNEL</option></select></label>
                  {(priceQualifications[item.id ?? '']?.classification ?? 'normal') !== 'normal' && <label><span className="field-label">Motif obligatoire</span><input value={priceQualifications[item.id ?? '']?.reason ?? ''} onChange={(event) => updatePriceQualification(item.id, { reason: event.target.value })} disabled={!canControl || purchase.status !== 'especes_remises'} className="input mt-1" /></label>}
                </div>
              </div>}
              <p className="rounded-md bg-blue-50 px-3 py-2 text-xs font-semibold text-[#1E3A8A] xl:col-span-8">
                Entrée stock à enregistrer : {(Math.max(0, Number(item.quantity_accepted ?? 0)) * Math.max(0, Number(item.conversion_factor ?? 1))).toLocaleString('fr-FR')} {item.stock_unit?.abbreviation ?? item.articles?.units?.abbreviation ?? ''} - Prix stock : {Number(item.unit_price_real_stock ?? item.unit_price_real ?? 0).toLocaleString('fr-FR')} Ar
              </p>
            </div>
          ))}
        </div>
      </section>

      {items.some((item) => Number(item.quantity_bought ?? 0) > Number(item.quantity_accepted ?? item.quantity_bought ?? 0)) && <section className="surface border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg font-bold text-amber-950">LIVRAISON À RÉGULARISER</h2>{items.filter((item) => Number(item.quantity_bought ?? 0) > Number(item.quantity_accepted ?? item.quantity_bought ?? 0)).map((item) => <p key={item.id} className="mt-2 text-sm text-amber-900">Quantité refusée : {Math.max(0, Number(item.quantity_bought ?? 0) - Number(item.quantity_accepted ?? item.quantity_bought ?? 0)).toLocaleString('fr-FR')} · Valeur refusée / à régulariser : {(Math.max(0, Number(item.quantity_bought ?? 0) - Number(item.quantity_accepted ?? item.quantity_bought ?? 0)) * Number(item.unit_price_real ?? 0)).toLocaleString('fr-FR')} Ar · Situation : À régulariser avec le fournisseur</p>)}<p className="mt-2 text-xs font-semibold text-amber-900">La quantité refusée ne doit pas entrer en stock.</p></section>}

      {['especes_remises', 'retour_partiel', 'retour_complet'].includes(purchase.status) && (
        <section className="surface p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold">Justificatifs de l'achat</h2>
            {canAddReceipt && <button type="button" onClick={() => setShowReceiptForm((shown) => !shown)} className="btn-secondary"><ReceiptText className="mr-2 h-4 w-4" /> + Ajouter une facture / reçu</button>}
          </div>
          <p className="mt-1 text-sm text-slate-600">Une facture ou un reçu appartient au dossier et peut couvrir une, plusieurs ou toutes les lignes. Le numéro interne est attribué automatiquement par la base.</p>
          {(canReturn || canControl) && <label className="mt-4 block rounded-md border border-slate-200 p-4"><span className="field-label">Montant réellement payé aux fournisseurs</span><NumericEntry value={amountPaidSupplier} onChange={setAmountPaidSupplier} allowNull min={0} placeholder={totalReal.toLocaleString('fr-FR')} className="input mt-2" /><span className="mt-1 block text-xs text-slate-500">Montant global de l’achat, à confirmer avec le contrôle final et le PIN. Il ne se saisit pas par facture.</span></label>}
          <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 sm:grid-cols-3">
            <Info label="Total justificatifs enregistrés" value={`${totalReceiptAmount.toLocaleString('fr-FR')} Ar`} />
            <Info label="Montant réellement payé aux fournisseurs" value={`${Number(amountPaidSupplier ?? purchase.amount_paid_supplier ?? 0).toLocaleString('fr-FR')} Ar`} />
            <Info label="Écart justificatifs (payé − justificatifs)" value={`${receiptAmountDifference.toLocaleString('fr-FR')} Ar`} />
            <p className="text-xs text-slate-600 sm:col-span-3">Cet écart est distinct de la monnaie, des régularisations fournisseur et des quantités refusées.</p>
          </div>
          {canAddReceipt && showReceiptForm && <div className="mt-4 space-y-4 rounded-md border border-slate-200 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label><span className="field-label">Type de pièce</span><select value={receiptType} onChange={(event) => setReceiptType(event.target.value)} className="input mt-1"><option value="facture">Facture</option><option value="recu">Reçu</option><option value="ticket">Ticket</option><option value="note_manuelle">Note manuscrite</option><option value="bon_fournisseur">Bon fournisseur</option><option value="justificatif_achat">Justificatif achat</option></select></label>
              <label><span className="field-label">Fournisseur</span><select value={receiptSupplierId} onChange={(event) => setReceiptSupplierId(event.target.value)} className="input mt-1"><option value="">Sélectionner un fournisseur</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <label><span className="field-label">N° document fournisseur</span><input value={receiptReference} onChange={(event) => setReceiptReference(event.target.value)} className="input mt-1" placeholder="Numéro facture / reçu" /></label>
              <label><span className="field-label">Date du document</span><input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} className="input mt-1" /></label>
              <label><span className="field-label">Montant du document (Ar)</span><NumericEntry aria-label="Montant du document" value={receiptAmount} onChange={setReceiptAmount} allowNull min={0} placeholder={`Ex. ${totalReal.toLocaleString('fr-FR')}`} className="input mt-1" /></label>
              <label><span className="field-label">Scan / photo</span><input type="file" accept="image/*,.pdf" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} className="input mt-1" />{receiptFile && <span className="mt-1 block text-xs text-slate-600">Fichier sélectionné : {receiptFile.name}</span>}</label>
              {receiptFile && receiptFilePreviewUrl && <div className="md:col-span-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                {isReceiptImage(receiptFile.type, receiptFile.name)
                  ? <button type="button" onClick={() => setActiveReceiptPreview({ url: receiptFilePreviewUrl, fileName: receiptFile.name, mimeType: receiptFile.type })} className="flex items-center gap-3 text-left"><img src={receiptFilePreviewUrl} alt={`Aperçu ${receiptFile.name}`} className="h-20 w-20 rounded border border-slate-300 object-cover" /><span><span className="block font-semibold">Image prête à enregistrer</span><span className="mt-1 block text-sm text-blue-700 underline">Aperçu</span></span></button>
                  : <div className="flex flex-wrap items-center justify-between gap-3"><span className="font-semibold">PDF prêt à enregistrer : {receiptFile.name}</span><button type="button" onClick={() => setActiveReceiptPreview({ url: receiptFilePreviewUrl, fileName: receiptFile.name, mimeType: receiptFile.type || 'application/pdf' })} className="btn-secondary">Aperçu</button></div>}
              </div>}
              <label className="md:col-span-3"><span className="field-label">Description facultative</span><input value={receiptDescription} onChange={(event) => setReceiptDescription(event.target.value)} className="input mt-1" placeholder="Information complémentaire" /></label>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="field-label">Lignes de l'achat couvertes</p><button type="button" className="text-sm font-semibold text-blue-700" onClick={() => setReceiptLineIds(items.flatMap((item) => item.id ? [item.id] : []))}>Sélectionner toutes les lignes</button></div>
              <div className="grid gap-2 sm:grid-cols-2">{receiptSelectableItems.filter((item) => item.id).map((item) => <label key={item.id} className="flex items-center gap-2 rounded border border-slate-200 p-2 text-sm"><input type="checkbox" checked={receiptLineIds.includes(item.id!)} onChange={(event) => setReceiptLineIds((current) => event.target.checked ? [...current, item.id!] : current.filter((lineId) => lineId !== item.id))} /><span>{item.articles?.name ?? item.free_designation ?? 'Article'} — {Number(item.quantity_planned).toLocaleString('fr-FR')} {item.units?.abbreviation ?? ''}{item.supplier ? ` · ${item.supplier}` : ''}</span></label>)}</div>
              {receiptSupplierMismatches.length > 0 && <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">Vérifiez les lignes sélectionnées : {receiptSupplierMismatches.map((item) => item.articles?.name ?? item.free_designation ?? 'Article').join(', ')} sont attribuées à un fournisseur différent de « {receiptSupplierName} ». La pièce reste enregistrable si elle couvre effectivement ces lignes.</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={addJustificatif} disabled={uploadingReceipt} className="btn-primary">{uploadingReceipt ? 'Enregistrement…' : 'Enregistrer et ajouter une autre'}</button><span className="text-xs text-slate-500">Images compressées automatiquement ; PDF conservé sans compression. Aucun PIN distinct n'est demandé pour les pièces.{receiptFile ? ` Fichier : ${receiptFile.name}` : ''}</span></div>
          </div>}
          <div className="mt-4 space-y-2">
            {(purchase.cash_purchase_receipts ?? []).map((receipt) => {
              const coveredItems = items.filter((item) => item.id && (receipt.line_ids ?? []).includes(item.id))
              const supplierName = receipt.suppliers?.name ?? suppliers.find((supplier) => supplier.id === receipt.supplier_id)?.name ?? '—'
              const receiptCard = <><span className="font-semibold">{receipt.internal_number ?? 'Numéro interne indisponible'} — {receipt.document_type ?? 'Justificatif'}{receipt.cancelled_at ? ' · ANNULÉ' : ''}</span><span className="mt-1 block text-xs text-slate-600">{supplierName} · N° fournisseur : {receipt.supplier_document_number ?? '—'} · {receipt.document_date ? new Date(receipt.document_date).toLocaleDateString('fr-FR') : 'Date —'} · {Number(receipt.document_amount ?? 0).toLocaleString('fr-FR')} Ar</span><span className="mt-1 block text-xs text-slate-600">Ligne(s) couverte(s) : {coveredItems.length ? coveredItems.map((item) => item.articles?.name ?? item.free_designation ?? 'Article').join(', ') : '—'}{receipt.file_name ? ` · ${receipt.file_name}` : ''}</span>{receipt.cancelled_at && <span className="mt-2 block rounded bg-rose-50 p-2 text-xs text-rose-800">Annulée le {new Date(receipt.cancelled_at).toLocaleString('fr-FR')} par {receipt.cancelled_by_profile?.full_name ?? receipt.cancelled_by ?? 'profil non disponible'} · Motif : {receipt.cancellation_reason ?? '—'}</span>}</>
              return <div key={receipt.id} className={`flex flex-col gap-2 rounded-md border border-slate-200 p-3 text-sm text-slate-800 ${receipt.cancelled_at ? 'opacity-70' : ''}`}><div>{receiptCard}</div><div className="flex flex-wrap gap-2">{receipt.file_url?.trim() && <button type="button" onClick={() => void openSavedReceiptPreview(receipt)} className="btn-secondary">Aperçu</button>}{canCancelReceipt && !receipt.cancelled_at && <button type="button" onClick={() => cancelReceipt(receipt.id)} className="btn-secondary text-rose-700">Annuler</button>}</div></div>
            })}
            {(purchase.cash_purchase_receipts?.length ?? 0) === 0 && <p className="text-sm text-slate-500">Aucun justificatif enregistré.</p>}
          </div>
        </section>
      )}

      {(canReturn || canControl) && ['especes_remises', 'retour_partiel', 'retour_complet'].includes(purchase.status) && (
        <section className="surface grid gap-4 p-5 md:grid-cols-4">
          <><Info label="Montant autorisé par Direction" value={`${directionSpendingLimit.toLocaleString('fr-FR')} Ar`} /><Info label="Montant remis par la Caisse" value={`${amountRemis.toLocaleString('fr-FR')} Ar`} /><Info label="Total des achats déclarés" value={`${totalReal.toLocaleString('fr-FR')} Ar`} /></>
          <Info label="Montant réellement payé aux fournisseurs" value={`${Number(amountPaidSupplier ?? 0).toLocaleString('fr-FR')} Ar`} />
          <Info label="Monnaie attendue à rendre" value={`${expectedChange.toLocaleString('fr-FR')} Ar`} />
          <label className="block"><span className="field-label">Monnaie remise au Contrôleur par l’Acheteur</span><NumericEntry value={amountReturnedToController} onChange={(value) => setAmountReturnedToController(value ?? 0)} min={0} className="input mt-2" /><span className="mt-1 block text-xs text-slate-500">Cette somme n’est pas encore confirmée comme reçue par la Caisse.</span></label>
          <Info label="Rendu de monnaie manquant" value={`${cashReturnShortage.toLocaleString('fr-FR')} Ar`} />
          {cashReturnSurplus > 0 && <Info label="Surplus de monnaie à expliquer" value={`${cashReturnSurplus.toLocaleString('fr-FR')} Ar`} />}
          {cashReturnShortage > 0 && <p className="text-sm font-semibold text-red-700 md:col-span-4">Rendu de monnaie manquant : {cashReturnShortage.toLocaleString('fr-FR')} Ar</p>}
          {cashReturnSurplus > 0 && <p className="text-sm font-semibold text-amber-800 md:col-span-4">Surplus de monnaie à expliquer : {cashReturnSurplus.toLocaleString('fr-FR')} Ar</p>}
          {controlRegularizationAmount > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 md:col-span-4">Régularisation fournisseur à traiter : {controlRegularizationAmount.toLocaleString('fr-FR')} Ar. Elle concerne la marchandise refusée déjà payée, indépendamment de la monnaie.</p>}
          {overrunAmount > 0 && <><Info label="Complément à régulariser" value={`${overrunAmount.toLocaleString('fr-FR')} Ar`} /><label className="block md:col-span-2"><span className="field-label">Motif du dépassement (obligatoire)</span><input value={overrunReason} onChange={(event) => setOverrunReason(event.target.value)} className="input mt-2" /></label><label className="block"><span className="field-label">Complément payé par</span><select value={overrunPayer} onChange={(event) => setOverrunPayer(event.target.value)} className="input mt-2"><option value="">Choisir</option><option value="acheteur">Acheteur</option><option value="fournisseur_credit">Fournisseur / crédit</option><option value="caisse">Caisse</option><option value="autre">Autre</option></select></label></>}
          {canReturn && <div><button type="button" onClick={saveReturn} className="btn-primary mt-6"><Save className="mr-2 h-4 w-4" /> Enregistrer retour</button></div>}
          {canControl && <div className="mt-6 md:col-span-4">
            <button type="button" onClick={controlReturn} disabled={controlling} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">{controlling ? 'Enregistrement du contrôle…' : 'Confirmer le contrôle de la livraison avec PIN'}</button>
            {controlError && <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">Contrôle non confirmé : {controlError}</p>}
          </div>}
          {differenceRequiresDirection && <p className="text-sm font-semibold text-red-700 md:col-span-4">{overrunAmount > 0 ? 'Le montant réel dépasse la somme remise par la Caisse. Validation Direction obligatoire avant clôture du contrôle.' : 'Écart supérieur à 10 % : validation Direction obligatoire.'}</p>}
        </section>
      )}

      <RelayMarker title={relay.currentStep >= 5 ? 'Relais Magasin / Stock' : 'Relais Magasin / Stock'} value={relay.currentStep >= 5 ? 'Entrée stock à enregistrer' : 'Stock après contrôle des marchandises'} detail={getStockStatusLabel(purchase)} />

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
            <label className="block flex-1"><span className="field-label">Commentaire de cloture</span><input value={closingComment} onChange={(event) => setClosingComment(event.target.value)} className="input mt-2" /></label>
            <button type="button" onClick={close} disabled={!canCloseFile} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"><LockKeyhole className="mr-2 h-4 w-4" /> Cloturer le dossier</button>
          </div>
          {!canCloseFile && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Cloture indisponible :
              {!hasReceipt && ' ajoutez au moins un justificatif.'}
              {hasOpenDifference && ' tous les écarts doivent être validés par la Direction.'}
              {hasUnresolvedMoneyDifference && !hasOpenDifference && ' écart de monnaie ou complément à régulariser.'}
            </div>
          )}
        </section>
      )}
      <QuickSupplierDrawer
        open={quickSupplierOpen}
        profileId={profile?.id}
        onClose={() => { setQuickSupplierOpen(false); setQuickSupplierItemId(undefined) }}
        onCreated={(supplier) => {
          setSuppliers((current) => [supplier, ...current.filter((item) => item.id !== supplier.id)])
          updateItem(quickSupplierItemId, { supplier: supplier.name })
          setQuickSupplierOpen(false)
          setQuickSupplierItemId(undefined)
        }}
        createSupplier={profile?.role === 'controleur' ? createSupplierFromPurchaseControl : undefined}
      />
      {activeReceiptPreview && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="presentation" onClick={() => setActiveReceiptPreview(null)}>
        <section role="dialog" aria-modal="true" aria-label={`Aperçu du justificatif ${activeReceiptPreview.fileName}`} className="relative flex max-h-[94vh] w-full max-w-5xl flex-col rounded-lg bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="truncate font-bold">Aperçu — {activeReceiptPreview.fileName}</h2><button type="button" onClick={() => setActiveReceiptPreview(null)} className="btn-secondary">Fermer</button></div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded bg-slate-100 p-2">
            {receiptPreviewLoading || !activeReceiptPreview.url
              ? <p className="p-8 text-sm text-slate-600">Préparation de l’aperçu…</p>
              : isReceiptImage(activeReceiptPreview.mimeType ?? '', activeReceiptPreview.fileName)
                ? <img src={activeReceiptPreview.url} alt={`Aperçu ${activeReceiptPreview.fileName}`} className="max-h-[78vh] max-w-full object-contain" />
                : <div className="flex h-[75vh] w-full flex-col gap-2"><iframe title={`PDF ${activeReceiptPreview.fileName}`} src={activeReceiptPreview.url} className="min-h-0 flex-1 rounded border border-slate-300 bg-white" /><a href={activeReceiptPreview.url} target="_blank" rel="noreferrer" className="btn-secondary self-start">Ouvrir le PDF</a></div>}
          </div>
        </section>
      </div>}
    </div>
  )
}

type WorkflowStepDefinition = { number: number; owner: string; action: string }

function describeReadError(error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  return {
    code: value.code ?? null,
    message: value.message ?? String(error),
    details: value.details ?? null,
    hint: value.hint ?? null,
  }
}

type NumericEntryProps = {
  value: number | null
  onChange: (value: number | null) => void
  allowNull?: boolean
  min?: number
  step?: number
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

function NumericEntry({ value, onChange, allowNull = false, min, step, placeholder, disabled, className, 'aria-label': ariaLabel }: NumericEntryProps) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(value == null ? '' : String(value))
  }, [focused, value])

  return <input
    type="number"
    inputMode="decimal"
    min={min}
    step={step}
    placeholder={placeholder}
    disabled={disabled}
    aria-label={ariaLabel}
    className={className}
    value={draft}
    onFocus={() => {
      setFocused(true)
      if (Number(value) === 0) setDraft('')
    }}
    onChange={(event) => {
      const next = event.target.value
      setDraft(next)
      onChange(next === '' ? (allowNull ? null : 0) : Number(next))
    }}
    onBlur={() => {
      setFocused(false)
      if (draft === '' && !allowNull) {
        setDraft('0')
        onChange(0)
      }
    }}
  />
}

const cashPurchaseWorkflowSteps: WorkflowStepDefinition[] = [
  { number: 1, owner: 'Demandeur / acheteur', action: 'Préparer et soumettre la demande.' },
  { number: 2, owner: 'Direction', action: 'Valider ou refuser le décaissement.' },
  { number: 3, owner: 'Caisse', action: 'Remettre les espèces.' },
  { number: 4, owner: 'Achat terrain', action: 'Acheteur — hors application : effectuer l’achat et présenter marchandises, justificatifs et monnaie au Contrôleur.' },
  { number: 5, owner: 'Contrôle', action: 'Réceptionner, saisir et contrôler le retour d’achat.' },
  { number: 6, owner: 'Magasin / Stock', action: 'Accepter ou refuser les marchandises.' },
  { number: 7, owner: 'Direction / Contrôle final', action: 'Arbitrer les écarts et classer.' },
]
function getCashPurchaseRelay(purchase: CashPurchase, hasReceipt: boolean) {
  const step = purchase.status === 'en_attente' ? 2 : purchase.status === 'valide' ? 3 : purchase.status === 'especes_remises' ? 5 : purchase.stock_entry_status === 'non_entre_stock' ? 6 : 7
  const current = cashPurchaseWorkflowSteps[step - 1]
  return { currentStep: step, currentStage: current.owner, currentOwner: current.owner, currentStatus: current.action, expectedAction: current.action, nextOwner: step < 7 ? cashPurchaseWorkflowSteps[step].owner : 'Aucun', nextStatus: step < 7 ? cashPurchaseWorkflowSteps[step].action : 'Dossier classé', history: getCashPurchaseHistory(purchase, hasReceipt) }
}
function getCashPurchaseHistory(purchase: CashPurchase, hasReceipt: boolean): string[] {
  const history: string[] = ['Demande préparée et soumise']
  if (purchase.validated_at) history.push('Décision Direction enregistrée')
  if (purchase.given_at) history.push('Espèces remises par la Caisse')
  if (hasReceipt) history.push('Justificatif d’achat enregistré')
  return history
}function getCashStatusLabel(purchase: CashPurchase) {
  if (!purchase.given_at && purchase.status === 'valide') return 'Relais Caisse à venir : espèces non remises'
  if (purchase.cash_status === 'rendu_monnaie_a_suivre') return 'En attente Caisse : monnaie à recevoir'
  if (purchase.cash_status === 'ecart_a_valider') return 'En attente Direction : écart à arbitrer'
  return purchase.given_at ? 'Espèces remises par la Caisse' : 'Espèces non remises'
}
function getStockStatusLabel(purchase: CashPurchase) { return purchase.stock_entry_status === 'entree_stock_faite' ? 'Marchandises acceptées et entrées en stock' : 'Entrée stock à enregistrer' }
function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function describeControlError(error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  return {
    code: value.code ?? null,
    message: value.message ?? String(error),
    details: value.details ?? null,
    hint: value.hint ?? null,
  }

}

function getControlErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return 'Contrôle refusé par le serveur. Consultez les détails techniques, puis réessayez.'
}

function isReceiptImage(mimeType: string, fileName: string) {
  return mimeType.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(fileName)
}

function RelayMarker({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <section className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-amber-800">{title}</p><p className="mt-1 text-base font-black text-amber-950">{value}</p><p className="mt-1 text-sm text-amber-900">{detail}</p></section>
}

function RelayInfo({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold text-slate-950">{value}</p></div>
}

function WorkflowStep({ step, state }: { step: WorkflowStepDefinition; state: 'done' | 'current' | 'upcoming' }) {
  const style = state === 'current'
    ? 'border-blue-300 bg-blue-50 text-[#1E3A8A]'
    : state === 'done'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-white text-slate-500'
  return (
    <div className={`rounded-md border p-3 ${style}`}>
      <p className="text-xs font-black uppercase">Etape {step.number}</p>
      <p className="mt-1 text-sm font-bold">{step.owner}</p>
      <p className="mt-1 text-xs leading-5">{step.action}</p>
    </div>
  )
}



