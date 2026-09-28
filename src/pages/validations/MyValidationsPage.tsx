import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { listCashPurchases } from '../../api/modules/cashPurchases.api'
import { listInventoriesForFinalReview } from '../../api/modules/inventories.api'
import { listInvoices } from '../../api/modules/invoices.api'
import { applyPurchaseNeedLineDecisions, listPurchaseNeedsGlobal } from '../../api/modules/purchaseNeeds.api'
import { getSensitiveActionErrorMessage, getSensitiveActionRuntimeStatus } from '../../api/modules/sensitiveActions.api'
import { listPurchaseOrders } from '../../api/modules/purchaseOrders.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import { listReceptions } from '../../api/modules/receptions.api'
import { listRecipes } from '../../api/modules/recipes.api'
import { useAuth } from '../../hooks/useAuth'
import { nonPurchaseDisbursementStatusLabels } from '../../lib/cashDisbursements'
import { invoicePaymentStatusLabels, invoiceStatusLabels } from '../../lib/invoices'
import { purchaseOrderStatusLabels } from '../../lib/purchaseOrders'
import { receptionStatusLabels } from '../../lib/receptions'
import { businessOriginLabels, getPurchaseNeedIntendedUseLabel, type BusinessOrigin } from '../../lib/purchaseNeeds'
import { getRecipeCostStatusLabel, getRecipeWorkflowLabel } from '../../lib/recipes'

const inventoryValidationStatuses = ['en_attente', 'valide', 'corrige', 'corrections_generees'] as const

type ValidationRow = {
  id: string
  sourceId: string
  type: string
  title: string
  detail: string
  status: string
  to: string
  priority: number
  currentOwner?: string
  expectedAction?: string
  nextOwner?: string
  nextStatus?: string
  alert?: string
  workflowStatus?: string
  afterValidation?: string
  afterRefusal?: string
}

export function MyValidationsPage() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const focusedNeedId = searchParams.get('focus') ?? ''
  const [rows, setRows] = useState<ValidationRow[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [typeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [runtimeDiagnostic, setRuntimeDiagnostic] = useState<Record<string, string | boolean | null>>({})
  type NeedLineForDecision = { id: string; quantity?: number; estimated_cost?: number; estimated_payable_amount?: number | null; requested_date?: string | null; created_at?: string; justification?: string | null; business_origin?: BusinessOrigin | null; intended_uses?: { id: string; code: string; label: string } | null; articles?: { name?: string }; units?: { abbreviation?: string }; requester?: { full_name?: string }}
  const [needLines, setNeedLines] = useState<NeedLineForDecision[]>([])
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [decisions, setDecisions] = useState<Record<string, { decision?: 'cash' | 'supplier' | 'supplier_delivery' | 'refused'; supplierId: string; supplierName: string; supplierPhone: string; reason: string; comment: string }>>({})

  useEffect(() => {
    let ignore = false

    async function load() {
      if (profile?.role !== 'direction') {
        setRows([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const safe = <T,>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback)
        const loaded = await Promise.all([
          safe(listPurchaseNeedsGlobal({ status: 'a_faire', pageSize: 10 }), { needs: [], total: 0 }),
          safe(listCashPurchases({ status: 'all', pageSize: 15 }), { purchases: [], total: 0 }),
          safe(listPurchaseOrders({ status: 'all', pageSize: 15 }), { orders: [], total: 0 }),
          safe(listReceptions({ status: 'all', pageSize: 15 }), { receptions: [], total: 0 }),
          safe(listInvoices({ status: 'all', pageSize: 15 }), { invoices: [], total: 0 }),
          safe(listInventoriesForFinalReview(), { inventories: [], total: 0 }),
          Promise.resolve([] as Array<{ id: string; status: string; reference: string; metadata: { beneficiary?: string }; amount_requested: number }>),
          safe(listRecipes({ status: 'all', page: 1, pageSize: 500 }), { recipes: [], total: 0 }),
        ])
        const needs = loaded[0] as Awaited<ReturnType<typeof listPurchaseNeedsGlobal>>
        setNeedLines(needs.needs.map((need) => ({ id: need.id, quantity: need.quantity, estimated_cost: need.estimated_cost, estimated_payable_amount: need.estimated_payable_amount, requested_date: need.requested_date, created_at: need.created_at, justification: need.justification, business_origin: need.business_origin, intended_uses: need.intended_uses, articles: need.articles, units: need.units, requester: need.requester })))
        const cash = loaded[1] as Awaited<ReturnType<typeof listCashPurchases>>
        const orders = loaded[2] as Awaited<ReturnType<typeof listPurchaseOrders>>
        const receptions = loaded[3] as Awaited<ReturnType<typeof listReceptions>>
        const invoices = loaded[4] as Awaited<ReturnType<typeof listInvoices>>
        const inventories = loaded[5] as Awaited<ReturnType<typeof listInventoriesForFinalReview>>
        const disbursements = loaded[6] as Array<{ id: string; status: string; reference: string; metadata: { beneficiary?: string }; amount_requested: number }>
        const recipes = loaded[7] as Awaited<ReturnType<typeof listRecipes>>

        if (ignore) return
        const nextRows: ValidationRow[] = [
          ...cash.purchases
            .filter((purchase) => purchase.status === 'en_attente' || Number(purchase.difference ?? 0) !== 0 || purchase.cash_purchase_differences?.some((difference) => difference.status !== 'valide'))
            .map((purchase) => ({
              id: `cash-${purchase.id}`,
              sourceId: purchase.id,
              type: 'Achat especes',
              title: purchase.reference,
              detail: `${purchase.reason} - ${Number(purchase.amount_requested ?? 0).toLocaleString('fr-FR')} Ar`,
              status: purchase.status === 'en_attente' ? 'Demande d’espèces en attente de décision' : 'Écart achat espèces à arbitrer',
              afterValidation: 'En attente Caisse — espèces à remettre', afterRefusal: 'Décaissement refusé',
              to: `/cash-purchases/${purchase.id}`,
              priority: purchase.status === 'en_attente' ? 1 : 3,
            })),
          ...disbursements
            .filter((item) => item.status === 'pending_direction')
            .map((item) => ({
              id: `non-purchase-disbursement-${item.id}`, sourceId: item.id, type: 'Decaissement hors achat',
              title: item.reference, detail: `${item.metadata.beneficiary} - ${Number(item.amount_requested).toLocaleString('fr-FR')} Ar`,
              status: nonPurchaseDisbursementStatusLabels[item.status as keyof typeof nonPurchaseDisbursementStatusLabels], to: '/cash-purchases/report#hors-achat', priority: 1,
            })),
          ...inventories.inventories
            .filter((inventory) => inventoryValidationStatuses.includes(inventory.status as (typeof inventoryValidationStatuses)[number]))
            .map((inventory) => ({
              id: `inventory-${inventory.id}`,
              sourceId: inventory.id,
              type: 'Inventaire',
              title: inventory.reference,
              detail: `${inventory.locations?.name ?? 'Localisation non renseignee'} - ${new Date(inventory.inventory_date).toLocaleDateString('fr-FR')}`,
              status: ['valide', 'corrige', 'corrections_generees'].includes(inventory.status) ? 'Contrôle final — clôture requise' : 'Inventaire soumis à validation',
              workflowStatus: inventory.status,
              afterValidation: ['valide', 'corrige', 'corrections_generees'].includes(inventory.status) ? 'Inventaire clôturé' : 'Stock initial confirmé', afterRefusal: 'Inventaire à reprendre',
              to: `/inventories/${inventory.id}`,
              priority: 1,
            })),
          ...orders.orders
            .filter((order) => order.status === 'reception_avec_ecart')
            .map((order) => ({
              id: `order-${order.id}`,
              sourceId: order.id,
              type: 'Commande fournisseur',
              title: order.reference,
              detail: `${order.suppliers?.name ?? 'Fournisseur non renseigne'} - ${Number(order.total_amount ?? 0).toLocaleString('fr-FR')} Ar`,
              status: purchaseOrderStatusLabels[order.status],
              to: `/purchase-orders/${order.id}`,
              priority: 1,
            })),
          ...receptions.receptions
            .filter((reception) => ['validee_avec_anomalies', 'refusee'].includes(reception.status))
            .map((reception) => ({
              id: `reception-${reception.id}`,
              sourceId: reception.id,
              type: 'Reception marchandises',
              title: reception.reference,
              detail: reception.suppliers?.name ?? 'Fournisseur non renseigne',
              status: receptionStatusLabels[reception.status],
              to: `/receptions/${reception.id}`,
              priority: 1,
            })),
          ...invoices.invoices
            .filter((invoice) => invoice.status === 'conteste' || (invoice.status === 'a_verifier' && !invoice.file_url))
            .map((invoice) => ({
              id: `invoice-${invoice.id}`,
              sourceId: invoice.id,
              type: 'Facture fournisseur',
              title: invoice.reference,
              detail: `${invoice.suppliers?.name ?? invoice.invoice_number} - ${Number(invoice.amount_ttc ?? 0).toLocaleString('fr-FR')} Ar`,
              status: invoiceStatusLabels[invoice.status],
              to: `/invoices/${invoice.id}`,
              priority: invoice.status === 'conteste' ? 1 : 3,
            })),
          ...invoices.invoices.flatMap((invoice) => (invoice.invoice_payments ?? [])
            .filter((payment) => payment.status === 'a_valider_direction')
            .map((payment) => ({
              id: `invoice-payment-${payment.id}`,
              sourceId: payment.id,
              type: 'Paiement fournisseur',
              title: invoice.reference,
              detail: `${invoice.suppliers?.name ?? invoice.invoice_number} - ${Number(payment.amount ?? 0).toLocaleString('fr-FR')} Ar`,
              status: invoicePaymentStatusLabels[payment.status ?? 'a_valider_direction'],
              to: `/invoices/${invoice.id}`,
              priority: 4,
            }))),
          ...recipes.recipes
            .filter((recipe) => recipe.status === 'en_attente' && recipe.workflow_status === 'chef_validated' && !recipe.direction_validated_at)
            .map((recipe) => ({
              id: `recipe-${recipe.id}`,
              sourceId: recipe.id,
              type: 'Fiche technique',
              title: recipe.name,
              detail: `v${recipe.version} · soumise le ${recipe.submitted_at ? new Date(recipe.submitted_at).toLocaleDateString('fr-FR') : '—'} · Coût ${getRecipeCostStatusLabel(recipe.cost_status)}`,
              status: getRecipeWorkflowLabel(recipe),
              to: `/recipes/${recipe.id}`,
              priority: 1,
            })),
        ]

        setRows(nextRows.map((row) => ({
          ...row,
          currentOwner: row.type === 'Inventaire' && ['valide', 'corrige', 'corrections_generees'].includes(row.workflowStatus ?? '') ? 'Direction / Contrôle final' : 'Direction',
          expectedAction: validationAction(row),
          nextOwner: validationNextOwner(row),
          nextStatus: validationNextStatus(row),
          alert: row.priority === 1 && !['Besoin d’achat', 'Inventaire', 'Achat especes'].includes(row.type) ? 'À arbitrer Direction' : undefined,
        })).sort((a, b) => a.priority - b.priority || a.type.localeCompare(b.type)))
      } catch {
        if (!ignore) setError('Impossible de charger les validations.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [profile?.role, reloadToken])

  useEffect(() => {
    if (!focusedNeedId) return
    const row = document.getElementById(`purchase-need-validation-${focusedNeedId}`)
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusedNeedId, needLines])

  useEffect(() => {
    listSuppliers().then((loaded) => setSuppliers(loaded.map((supplier) => ({ id: supplier.id, name: supplier.name })))).catch(() => setSuppliers([]))
  }, [])

  useEffect(() => {
    getSensitiveActionRuntimeStatus('purchase_need.validate').then((status) => setRuntimeDiagnostic({
      projectRef: new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split('.')[0],
      profileId: profile?.id ?? null,
      role: profile?.role ?? null,
      profileStatus: profile?.status ?? null,
      ...status,
    })).catch((error) => setRuntimeDiagnostic({ error: getSensitiveActionErrorMessage(error) }))
  }, [profile?.id, profile?.role, profile?.status])

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, ValidationRow[]>>((groups, row) => {
      groups[row.type] = [...(groups[row.type] ?? []), row]
      return groups
    }, {})
  }, [rows])

  const visibleRows = useMemo(
    () => rows.filter((row) => typeFilter === 'all' || row.type === typeFilter),
    [rows, typeFilter],
  )
  const selectedRows = useMemo(() => rows.filter((row) => row.type !== 'Besoin d’achat' && selectedIds.includes(row.id)), [rows, selectedIds])
  const selectedNeedLines = useMemo(() => needLines.filter((need) => selectedIds.includes(`need-${need.id}`)), [needLines, selectedIds])
  const isReady = (need: NeedLineForDecision) => {
    const value = decisions[need.id]
    if (!value?.decision) return false
    if (value.decision === 'refused') return Boolean(value.reason.trim())
    if (value.decision === 'supplier' || value.decision === 'supplier_delivery') return Boolean(value.supplierId || value.supplierName.trim())
    return true
  }
  const readyNeedLines = useMemo(() => needLines.filter(isReady), [needLines, decisions])
  const allReadySelected = readyNeedLines.length > 0 && readyNeedLines.every((need) => selectedIds.includes(`need-${need.id}`))
  const toggleAllReady = () => {
    const readyIds = readyNeedLines.map((need) => `need-${need.id}`)
    setSelectedIds((current) => allReadySelected
      ? current.filter((id) => !readyIds.includes(id))
      : [...new Set([...current, ...readyIds])])
  }

  const toggleRow = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    setNotice(null)
  }
  const toggleNeed = (need: NeedLineForDecision) => {
    if (!isReady(need)) return
    toggleRow(`need-${need.id}`)
  }

  if (profile?.role !== 'direction') {
    return (
      <div className="surface p-6">
        <p className="eyebrow">Validations</p>
        <h1 className="page-title mt-2">Mes validations</h1>        <p className="mt-2 text-xs text-slate-500">Diagnostic runtime : {runtimeDiagnostic.error || [runtimeDiagnostic.projectRef, runtimeDiagnostic.email, runtimeDiagnostic.profileId, runtimeDiagnostic.role, runtimeDiagnostic.hasPermission, runtimeDiagnostic.pinDefined ? 'PIN defini' : 'PIN non defini'].map(String).join(' | ')}</p>
        <p className="mt-2 text-sm text-slate-600">Cette page est reservee a la Direction.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="surface p-6">
        <p className="eyebrow">Direction</p>
        <h1 className="page-title mt-2">Mes validations</h1>        <p className="mt-2 text-xs text-slate-500">Diagnostic runtime : {runtimeDiagnostic.error || [runtimeDiagnostic.projectRef, runtimeDiagnostic.email, runtimeDiagnostic.profileId, runtimeDiagnostic.role, runtimeDiagnostic.hasPermission, runtimeDiagnostic.pinDefined ? 'PIN defini' : 'PIN non defini'].map(String).join(' | ')}</p>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Cette page regroupe uniquement les decisions a approuver ou refuser par l'utilisateur connecte. Le flux standard reste : soumission a validation, selection claire, recapitulatif, puis PIN saisi une seule fois pour le lot selectionne. Aucune session PIN temporaire n'est prevue.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <Metric label="A valider" value={rows.length + needLines.length} />
        <Metric label="Inventaires" value={grouped.Inventaire?.length ?? 0} />
        <Metric label="Achats especes" value={grouped['Achat especes']?.length ?? 0} />
        <Metric label="Commandes" value={grouped['Commande fournisseur']?.length ?? 0} />
        <Metric label="Factures" value={grouped['Facture fournisseur']?.length ?? 0} />
        <Metric label="FT Direction" value={grouped['Fiche technique']?.length ?? 0} />
      </section>

      {loading && <div className="surface p-5 text-sm text-slate-600">Chargement des validations...</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      {!loading && !error && (
        <>
          <section className="surface p-4"><h2 className="font-black text-slate-950">Résumé des décisions à confirmer</h2><p className="text-sm text-slate-600">{needLines.length} décision(s) en attente · {selectedNeedLines.length} sélectionnée(s)</p><p className="mt-1 text-sm text-slate-600">Le regroupement espèces/fournisseur est réalisé automatiquement par la RPC.</p><button type="button" className="btn-primary mt-3" disabled={selectedNeedLines.length === 0} onClick={() => { setPinOpen(true); setNotice(null) }}>Confirmer {selectedNeedLines.length} décision{selectedNeedLines.length > 1 ? 's' : ''} avec PIN</button></section>

          {notice && <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{notice}</div>}
          {pinOpen && <div className="rounded-md border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-900">PIN Direction requis pour confirmer les décisions</p><div className="mt-3 flex gap-2"><input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value)} className="input max-w-xs" placeholder="Saisir le PIN" aria-label="PIN Direction" /><button type="button" className="btn-primary" disabled={pinBusy} onClick={async () => {
            const needRows = selectedNeedLines.filter((need) => isReady(need))
            const payload = needRows.map((need) => { const value = decisions[need.id]; const decision = value?.decision; return { purchase_need_id: need.id, decision: decision as 'cash' | 'supplier' | 'supplier_delivery' | 'refused', supplier_id: (decision === 'supplier' || decision === 'supplier_delivery') ? value?.supplierId || null : null, supplier_name: (decision === 'supplier' || decision === 'supplier_delivery') ? value?.supplierName || null : null, supplier_phone: (decision === 'supplier' || decision === 'supplier_delivery') ? value?.supplierPhone || null : null, refused_reason: decision === 'refused' ? value?.reason : null, direction_comment: value?.comment || null } })
            if (payload.some((item) => !item.decision) || payload.some((item) => item.decision === 'refused' && !item.refused_reason) || payload.some((item) => (item.decision === 'supplier' || item.decision === 'supplier_delivery') && !item.supplier_id && !item.supplier_name)) { setNotice('Chaque refus doit avoir un motif et chaque circuit fournisseur doit avoir un fournisseur.'); return }
            if (payload.length !== needRows.length) { setNotice('Chaque ligne doit recevoir une décision.'); return }
            try { setPinBusy(true); const result = await applyPurchaseNeedLineDecisions(pin, payload); const confirmedIds = new Set(needRows.map((need) => need.id)); setPin(''); setPinOpen(false); setNeedLines((current) => current.filter((need) => !confirmedIds.has(need.id))); setSelectedIds((current) => current.filter((id) => ![...confirmedIds].some((needId) => id === `need-${needId}`))); setLoading(true); setReloadToken((token) => token + 1); setNotice(`Décisions appliquées : ${result.refused_count ?? 0} ligne(s) refusée(s), ${result.cash_purchases?.length ?? 0} achat(s) espèces, ${result.purchase_orders?.length ?? 0} commande(s).`) } catch (error) { setNotice(error instanceof Error ? error.message : 'Erreur RPC de décision ligne par ligne.') } finally { setPinBusy(false) }
          }}>Confirmer les décisions avec PIN</button><button type="button" className="btn-secondary" onClick={() => { setPin(''); setPinOpen(false) }}>Annuler</button></div></div>}

          {needLines.length > 0 && <section className="surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-black text-slate-950">Décisions à valider</h2><button type="button" className="btn-secondary" onClick={toggleAllReady} disabled={readyNeedLines.length === 0}>{allReadySelected ? 'Tout désélectionner' : 'Sélectionner toutes les lignes prêtes'}</button></div><div className="mt-4 space-y-3">{needLines.map((need) => { const value = decisions[need.id] ?? { decision: undefined, supplierId: '', supplierName: '', supplierPhone: '', reason: '', comment: '' }; const isFocused = focusedNeedId === need.id; return <div key={need.id} id={`purchase-need-validation-${need.id}`} className={`rounded-md border p-4 ${isFocused ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200' : 'border-slate-200'}`}><div className="flex gap-3"><input type="checkbox" checked={selectedIds.includes(`need-${need.id}`)} disabled={!isReady(need)} onChange={() => toggleNeed(need)} className="mt-1 h-4 w-4" aria-label={`Confirmer ${need.articles?.name ?? 'besoin'}`} /><div className="min-w-0 flex-1"><p className="font-bold">{need.articles?.name ?? 'Article'} — {Number(need.quantity ?? 0).toLocaleString('fr-FR')} {need.units?.abbreviation ?? ''}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{need.justification?.trim() || 'Justification non renseignée'}</p><p className="mt-1 text-xs text-slate-500">{need.business_origin && businessOriginLabels[need.business_origin] ? businessOriginLabels[need.business_origin] : 'Origine historique'} · Utilisation : {getPurchaseNeedIntendedUseLabel(need)} · Date de demande : {need.created_at ? new Date(need.created_at).toLocaleDateString('fr-FR') : '—'}</p><p className="text-xs text-slate-600">Demandeur : {need.requester?.full_name ?? '-'} · Montant estimé à payer : {Number(need.estimated_payable_amount ?? need.estimated_cost ?? 0).toLocaleString('fr-FR')} Ar</p><div className="mt-3 flex flex-wrap gap-2"><select value={value.decision} onChange={(event) => setDecisions((current) => ({ ...current, [need.id]: { ...value, decision: event.target.value as 'cash' | 'supplier' | 'supplier_delivery' | 'refused' } }))} className="input"><option value="">Quelle décision prend la Direction ?</option><option value="cash">Achat direct</option><option value="supplier_delivery">Livraison fournisseur au comptant</option><option value="supplier">Commande fournisseur</option><option value="refused">Refuser</option></select>{(value.decision === 'supplier' || value.decision === 'supplier_delivery') && <><select value={value.supplierId} onChange={(event) => setDecisions((current) => ({ ...current, [need.id]: { ...value, supplierId: event.target.value } }))} className="input"><option value="">Choisir un fournisseur</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select><input value={value.supplierName} onChange={(event) => setDecisions((current) => ({ ...current, [need.id]: { ...value, supplierName: event.target.value } }))} className="input" placeholder="Nom fournisseur si non référencé" /></>}{value.decision === 'refused' && <input value={value.reason} onChange={(event) => setDecisions((current) => ({ ...current, [need.id]: { ...value, reason: event.target.value } }))} className="input" placeholder="Motif du refus obligatoire" />}</div><input value={value.comment} onChange={(event) => setDecisions((current) => ({ ...current, [need.id]: { ...value, comment: event.target.value } }))} className="input mt-2" placeholder="Commentaire Direction (optionnel)" /><p className="mt-2 text-xs text-slate-600">Après validation : {value.decision === 'cash' ? 'Achat direct autorisé → à traiter' : value.decision === 'refused' ? 'Achat refusé' : value.decision ? 'Orientation fournisseur enregistrée' : 'Compléter la décision avant sélection'}</p></div></div></div> })}</div></section>}
          {selectedRows.length > 0 && (
            <section className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-bold">{selectedRows.length} element(s) selectionne(s)</p>
              <p className="mt-1">
                Le serveur devra auditer chaque element separement avec batch_id, utilisateur, date, action, dossier concerne et mention PIN verifie, sans stocker ni afficher le PIN.
              </p>
            </section>
          )}

          <section className="surface overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-black text-slate-950">Autres validations en attente</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {visibleRows.filter((row) => row.type !== 'Besoin d’achat').map((row) => (
                <div key={row.id} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[32px_150px_1fr_120px_190px_170px_190px_90px] xl:items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleRow(row.id)}
                    aria-label={`Selectionner ${row.title}`}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-bold text-[#1E3A8A]">{row.type}</span>
                  <span>
                    <span className="block font-bold text-slate-950">{row.title}</span>
                    <span className="mt-1 block text-sm text-slate-600">{row.detail}</span>
                  </span>
                  <ValidationCell label="Responsable actuel" value={row.currentOwner ?? 'Direction'} />
                  <ValidationCell label="Action attendue" value={row.expectedAction ?? 'Valider ou refuser'} />
                  <ValidationCell label="Prochain responsable" value={row.nextOwner ?? 'Service concerne'} />
                  <span><span className="block text-xs font-bold uppercase text-slate-400">Après validation</span><span className="mt-1 block text-xs font-bold text-amber-700">{row.afterValidation ?? row.nextStatus ?? row.status}</span><span className="mt-2 block text-xs font-bold text-slate-600">Après refus : {row.afterRefusal ?? 'Dossier refusé ou à régulariser'}</span>{row.alert && <span className="mt-1 block text-xs font-bold text-red-700">{row.alert}</span>}</span>
                  <Link to={row.to} className="text-sm font-bold text-[#1E3A8A]">Ouvrir</Link>
                </div>
              ))}
              {visibleRows.filter((row) => row.type !== 'Besoin d’achat').length === 0 && <p className="px-5 py-4 text-sm text-slate-600">Aucune autre validation en attente.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value.toLocaleString('fr-FR')}</p>
    </div>
  )
}

function ValidationCell({ label, value }: { label: string; value: string }) {
  return <span className="text-sm text-slate-700"><span className="block text-xs font-bold uppercase text-slate-400">{label}</span>{value}</span>
}

function validationAction(row: ValidationRow) {
  if (row.type === 'Fiche technique') return 'Valider ou renvoyer à corriger avec PIN'
  if (row.type === 'Inventaire' && ['valide', 'corrige', 'corrections_generees'].includes(row.workflowStatus ?? '')) return 'Vérifier les mouvements générés puis clôturer avec PIN'
  if (row.type === 'Achat especes' && row.status.includes('ecart')) return 'Arbitrer et valider ou refuser l ecart'
  if (row.type === 'Reception marchandises') return 'Arbitrer le refus ou l ecart de reception marchandises'
  if (row.type === 'Facture fournisseur') return 'Arbitrer la facture ou exiger le justificatif'
  if (row.type === 'Inventaire') return 'Valider ou refuser l inventaire avec PIN'
  return 'Valider ou refuser la decision'
}

function validationNextOwner(row: ValidationRow) {
  if (row.type === 'Fiche technique') return 'Direction'
  if (row.type === 'Inventaire' && ['valide', 'corrige', 'corrections_generees'].includes(row.workflowStatus ?? '')) return '-'
  if (row.type === 'Inventaire' && ['valide', 'corrige', 'corrections_generees'].includes(row.workflowStatus ?? '')) return 'Direction / Contrôle final'
  if (row.type === 'Achat especes') return row.status.includes('decaissement') ? 'Caisse' : 'Controle / Caisse'
  if (row.type === 'Reception marchandises') return 'Magasin / Stock ou Controle'
  if (row.type === 'Facture fournisseur' || row.type === 'Paiement fournisseur') return 'Comptabilite / Caisse'
  if (row.type === 'Inventaire') return 'Magasin / Stock'
  return 'Service demandeur'
}

function validationNextStatus(row: ValidationRow) {
  if (row.type === 'Fiche technique') return 'Validée par Direction ou à corriger'
  if (row.type === 'Inventaire' && ['valide', 'corrige', 'corrections_generees'].includes(row.workflowStatus ?? '')) return 'Inventaire clôturé'
  if (row.type === 'Achat especes') return row.status.includes('decaissement') ? 'En attente Caisse : especes a remettre' : 'Ecart arbitre Direction'
  if (row.type === 'Reception marchandises') return 'Reception marchandises arbitree'
  if (row.type === 'Facture fournisseur') return 'Facture fournisseur validee ou a regulariser'
  if (row.type === 'Inventaire') return 'Inventaire valide Direction'
  return 'Decision Direction enregistree'
}
