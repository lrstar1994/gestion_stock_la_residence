import { listArticles } from './catalog.api'
import { getCashPurchase, listCashPurchases } from './cashPurchases.api'
import { listNonPurchaseDisbursements } from './cashDisbursements.api'
import { listInventories, listInitialInventoryStatus } from './inventories.api'
import { listInvoices } from './invoices.api'
import { listReceptions } from './receptions.api'
import { listSuppliers } from './suppliers.api'
import { listPurchaseNeedsGlobal } from './purchaseNeeds.api'
import { listSupplierRegularizations } from './supplierRegularizations.api'
import { listStockTransferWorkflow } from './stock.api'
import { listRecipes } from './recipes.api'
import type { UserTask } from '../../lib/tasks'
import { sortUserTasks } from '../../lib/tasks'
import type { UserRole } from '../../lib/validation'
import { businessOriginLabels, getPurchaseNeedIntendedUseLabel, requestingServiceLabels } from '../../lib/purchaseNeeds'

export type CashierCashPurchaseData = {
  toGive: Awaited<ReturnType<typeof listCashPurchases>>['purchases']
  givenOpen: Awaited<ReturnType<typeof listCashPurchases>>['purchases']
  givenToday: Awaited<ReturnType<typeof listCashPurchases>>['purchases']
  recentGiven: Awaited<ReturnType<typeof listCashPurchases>>['purchases']
}

async function listAllCashPurchases() {
  const pageSize = 200
  const first = await listCashPurchases({ status: 'all', page: 1, pageSize })
  const pages = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(first.total / pageSize) - 1) }, (_, index) =>
    listCashPurchases({ status: 'all', page: index + 2, pageSize })))
  return [first, ...pages].flatMap((page) => page.purchases)
}

export async function listCashierCashPurchaseData(): Promise<CashierCashPurchaseData> {
  const purchases = await listAllCashPurchases()
  const detailed = await Promise.all(purchases.map(async (purchase) => {
    try { return await getCashPurchase(purchase.id) } catch { return purchase }
  }))
  const today = new Date().toISOString().slice(0, 10)
  const toGive = detailed.filter((item) => item.status === 'valide')
  const givenOpen = detailed.filter((item) => item.given_at && !['cloture', 'refuse'].includes(item.status))
  const givenToday = detailed.filter((item) => item.given_at && item.given_at.slice(0, 10) === today)
  const recentGiven = detailed
    .filter((item) => item.given_at)
    .sort((a, b) => String(b.given_at).localeCompare(String(a.given_at)))
  return { toGive, givenOpen, givenToday, recentGiven }
}

function cashPurchaseTaskDescription(item: CashierCashPurchaseData['toGive'][number]) {
  const lines = (item.cash_purchase_items ?? []).map((line) => {
    const need = line.purchase_needs
    const article = `${line.articles?.name ?? line.free_designation ?? 'Article'} · ${Number(line.quantity_planned ?? 0).toLocaleString('fr-FR')} ${line.units?.abbreviation ?? ''}`.trim()
    return [
      `Justification : ${need?.justification || 'Non renseignée'}`,
      `Origine : ${need?.business_origin ? businessOriginLabels[need.business_origin] : 'Non renseignée'}`,
      `Service demandeur : ${need?.service_demandeur ? requestingServiceLabels[need.service_demandeur] : 'Non renseigné'}`,
      `Montant autorisé par la Direction : ${Number(item.amount_validated ?? 0).toLocaleString('fr-FR')} Ar`,
      `Article : ${article}`,
      `Utilisation prévue : ${need ? getPurchaseNeedIntendedUseLabel(need) : '—'}`,
    ].join('\n')
  })
  return lines.length > 0 ? lines.join('\n\n') : [`Justification : ${item.reason || 'Non renseignée'}`, `Montant autorisé par la Direction : ${Number(item.amount_validated ?? 0).toLocaleString('fr-FR')} Ar`].join('\n')
}

export async function listMyTasks(role?: UserRole, profileId?: string): Promise<UserTask[]> {
  if (!role || role === 'consultation') return []

  const safe = <T,>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback)

  const [cashResult, cashierDataResult, receptionsResult, invoicesResult, inventoriesResult, initialRows, articlesResult, disbursements, suppliers, needsResult, decisionNeedsResult, regularizations, transfers] = await Promise.all([
    ['direction', 'caisse', 'acheteur', 'comptabilite', 'controleur', 'magasinier'].includes(role) ? safe(listCashPurchases({ status: 'all', pageSize: 100 }), { purchases: [], total: 0 }) : Promise.resolve({ purchases: [], total: 0 }),
    role === 'caisse' ? safe(listCashierCashPurchaseData(), { toGive: [], givenOpen: [], givenToday: [], recentGiven: [] }) : Promise.resolve({ toGive: [], givenOpen: [], givenToday: [], recentGiven: [] }),
    ['direction', 'magasinier'].includes(role) ? safe(listReceptions({ status: 'all', pageSize: 100 }), { receptions: [], total: 0 }) : Promise.resolve({ receptions: [], total: 0 }),
    ['direction', 'comptabilite', 'caisse'].includes(role) ? safe(listInvoices({ status: 'all', pageSize: 100 }), { invoices: [], total: 0 }) : Promise.resolve({ invoices: [], total: 0 }),
    ['direction', 'magasinier'].includes(role) ? safe(listInventories({ status: 'all', pageSize: 100 }), { inventories: [], total: 0 }) : Promise.resolve({ inventories: [], total: 0 }),
    ['direction', 'magasinier'].includes(role) ? safe(listInitialInventoryStatus(), []) : Promise.resolve([]),
    ['direction', 'chef_cuisine', 'fiche_technique'].includes(role) ? safe(listArticles({ page: 1, pageSize: 1000, status: 'active' }), { articles: [], total: 0 }) : Promise.resolve({ articles: [], total: 0 }),
    ['direction', 'caisse', 'comptabilite'].includes(role) ? safe(listNonPurchaseDisbursements(), []) : Promise.resolve([]),
    ['direction', 'acheteur'].includes(role) ? safe(listSuppliers(), []) : Promise.resolve([]),
    ['direction', 'acheteur'].includes(role) ? safe(listPurchaseNeedsGlobal({ status: 'valide', pageSize: 100 }), { needs: [], total: 0 }) : Promise.resolve({ needs: [], total: 0 }),
    role === 'direction' ? safe(listPurchaseNeedsGlobal({ status: 'a_faire', pageSize: 100 }), { needs: [], total: 0 }) : Promise.resolve({ needs: [], total: 0 }),
    ['direction','caisse','controleur','magasinier'].includes(role) ? listSupplierRegularizations() : Promise.resolve([]),
    ['direction','magasinier','chef_cuisine','point_vente'].includes(role) ? safe(listStockTransferWorkflow(), []) : Promise.resolve([]),
  ])
  const recipeCostResult = role === 'direction' ? await safe(listRecipes({ status: 'all', page: 1, pageSize: 200 }), { recipes: [], total: 0 }) : { recipes: [], total: 0 }

  const tasks: UserTask[] = []
  const add = (task: UserTask) => tasks.push(task)
  transfers.forEach((transfer) => {
    const batchItems = transfer.stock_transfer_batch_items ?? []
    const handoffs = transfer.stock_transfer_handoffs ?? []
    const remainingToDispatch = batchItems.some((item) => {
      const dispatched = handoffs.flatMap((handoff) => handoff.stock_transfer_handoff_items ?? [])
        .filter((line) => line.batch_item_id === item.id)
        .reduce((sum, line) => sum + Number(line.dispatched_quantity ?? 0), 0)
      return Math.max(0, Number(item.authorized_quantity ?? item.quantity ?? 0) - dispatched) > 0
    })
    if (role === 'magasinier' && remainingToDispatch && ['prepared','awaiting_dispatch','in_transit','partially_received'].includes(transfer.status)) add({
      id: `stock-transfer-dispatch-${transfer.id}`, category: 'stock', title: 'Transfert à remettre',
      description: `${transfer.from_location_name_snapshot ?? ''} → ${transfer.to_location_name_snapshot ?? ''}`,
      status: transfer.status, priority: 'haute', targetUrl: '/stock/transfer', source: 'Transfert physique',
      reference: transfer.reference ?? transfer.id, responsible: 'Magasin', expectedAction: 'Confirmer les quantités remises avec PIN',
      nextResponsible: 'Responsable destination', nextStatus: 'Réception à confirmer',
    })
    if (['magasinier','chef_cuisine','point_vente'].includes(role)) {
      handoffs.forEach((handoff) => {
        const transit = handoff.stock_transfer_handoff_items?.reduce((sum, line) => {
          const received = (line.stock_transfer_receipt_items ?? []).reduce((value, receipt) => value + Number(receipt.received_quantity ?? 0), 0)
          const settled = (line.stock_transfer_discrepancies ?? []).filter((item) => item.status === 'resolved').reduce((value, item) => value + Number(item.quantity ?? 0), 0)
          return sum + Math.max(0, Number(line.dispatched_quantity ?? 0) - received - settled)
        }, 0) ?? 0
        if (transit > 0 && handoff.dispatched_by !== profileId && transfer.status !== 'discrepancy_pending') add({
          id: `stock-transfer-receive-${handoff.id}`, category: 'stock', title: 'Réception de transfert à confirmer',
          description: `${transfer.from_location_name_snapshot ?? ''} → ${transfer.to_location_name_snapshot ?? ''} · ${transit.toLocaleString('fr-FR')}`,
          status: transfer.status, priority: 'haute', targetUrl: '/stock/transfer', source: 'Transfert physique',
          reference: handoff.reference, responsible: 'Responsable destination', expectedAction: 'Saisir les quantités reçues et confirmer avec PIN',
          nextResponsible: 'Magasin / Stock', nextStatus: 'Réception enregistrée',
        })
      })
    }
    if (role === 'magasinier') handoffs.flatMap((handoff) => handoff.stock_transfer_handoff_items ?? []).forEach((line) => {
      (line.stock_transfer_discrepancies ?? []).filter((entry) => entry.status === 'awaiting_magasinier').forEach((entry) => add({
        id: `stock-transfer-discrepancy-${entry.id}`, category: 'stock', title: 'Écart de transfert à confirmer',
        description: `${transfer.reference ?? ''} · ${Number(entry.quantity).toLocaleString('fr-FR')} · ${entry.reason}`,
        status: 'discrepancy_pending', priority: 'haute', targetUrl: '/stock/transfer', source: 'Transfert physique',
        reference: transfer.reference ?? transfer.id, responsible: 'Magasin', expectedAction: 'Confirmer l’écart définitif avec PIN',
        nextResponsible: 'Direction', nextStatus: 'Transfert clôturable',
      }))
    })
    if (role === 'direction' && transfer.status === 'received') add({
      id: `stock-transfer-close-${transfer.id}`, category: 'stock', title: 'Transfert reçu à clôturer',
      description: `${transfer.from_location_name_snapshot ?? ''} → ${transfer.to_location_name_snapshot ?? ''}`,
      status: 'received', priority: 'normale', targetUrl: '/stock/transfer', source: 'Transfert physique',
      reference: transfer.reference ?? transfer.id, responsible: 'Direction', expectedAction: 'Vérifier la traçabilité puis clôturer avec PIN',
      nextResponsible: 'Archives', nextStatus: 'closed',
    })
  })
  regularizations.forEach((item) => {
    const isolationPending = item.status === 'awaiting_isolation' && item.current_responsible_role === 'magasinier'
    const treatmentDecisionPending = item.status === 'awaiting_treatment_decision' && item.current_responsible_role === 'controleur'
    const isResponsible = item.current_responsible_role === role
    const responsibleLabel = item.current_responsible_role === 'magasinier' ? 'Magasin' : 'Contrôle'
    const title = isolationPending
      ? isResponsible ? 'Isoler et localiser la marchandise refusée' : 'En attente d’isolation par le Magasin'
      : treatmentDecisionPending
        ? isResponsible ? 'Décider du traitement de la marchandise refusée' : 'En attente de décision du Contrôle'
        : `Régularisation fournisseur — En attente d’action ${responsibleLabel}`
    const expectedAction = isolationPending && isResponsible
      ? 'Isoler et localiser la marchandise refusée'
      : treatmentDecisionPending && isResponsible
        ? 'Choisir ultérieurement : remboursement, remplacement, avoir ou arbitrage Direction'
        : 'Suivi uniquement'
    add({ id: `supplier-reg-${item.id}`, category: 'achats', title, description: `${item.cash_purchases?.reference ?? ''} · ${item.cash_purchase_items?.articles?.name ?? ''} · ${Number(item.quantity_refused ?? 0).toLocaleString('fr-FR')} · ${Number(item.value_to_regularize ?? 0).toLocaleString('fr-FR')} Ar`, status: item.status, priority: 'haute', targetUrl: `/cash-purchases/${item.cash_purchase_id}`, source: 'Régularisation fournisseur', reference: item.cash_purchases?.reference ?? item.cash_purchase_id, responsible: responsibleLabel, expectedAction, nextResponsible: responsibleLabel, nextStatus: item.status })
  })
  if (role === 'direction') {
    decisionNeedsResult.needs
      .filter((need) => need.status === 'a_faire' && !need.processing)
      .forEach((need) => add({
        id: `purchase-need-decision-${need.id}`, category: 'achats', title: 'Décision Direction à valider',
        description: `${need.articles?.name ?? 'Article'} · ${Number(need.quantity ?? 0).toLocaleString('fr-FR')} ${need.units?.abbreviation ?? ''} · ${need.justification ?? 'Justification non renseignée'}`,
        status: need.workflow_status ?? need.status, priority: 'haute', targetUrl: `/validations/my?focus=${need.id}`, source: "Besoin d'achat", reference: need.id,
        responsible: 'Direction', expectedAction: 'Décider du traitement du besoin', nextResponsible: 'Achats', nextStatus: 'Besoin orienté ou refusé',
      }))
    recipeCostResult.recipes.filter((recipe) => recipe.cost_status === 'A_REVOIR' && recipe.cost_review_task_opened_at).forEach((recipe) => add({
      id: `recipe-cost-review-${recipe.id}`, category: 'achats', title: 'Coût FT à revoir',
      description: `${recipe.code ?? recipe.name} · écart de coût matière significatif`, status: 'A_REVOIR', priority: 'haute',
      targetUrl: `/recipes/${recipe.id}`, source: 'Fiche technique', reference: recipe.code ?? recipe.id,
      responsible: 'Direction', expectedAction: 'Revoir le coût matière et décider de la suite', nextResponsible: 'Direction', nextStatus: 'Décision coût à enregistrer',
    }))
  }

  if (['direction', 'acheteur'].includes(role)) {
    needsResult.needs.filter((need) => need.status === 'valide' && !need.group_id).forEach((need) => add({
      id: 'purchase-need-transform-' + need.id, category: 'achats', title: 'Lignes d’achat à orienter',
      description: (need.articles?.name ?? 'Article') + ' - ' + Number(need.quantity_needed ?? need.quantity ?? 0).toLocaleString('fr-FR'),
      status: 'Valide - a transformer en commande ou achat especes', priority: need.urgency === 'normal' ? 'normale' : 'haute',
      targetUrl: '/purchase-needs?focus=' + need.id, source: "Besoin d''achat", reference: need.articles?.name ?? need.id,
      responsible: 'Achats', expectedAction: 'Choisir le traitement des lignes restant à orienter', nextResponsible: 'Achats / Acheteur', nextStatus: 'Commande ou achat especes cree',
    }))
  }
  if (role === 'caisse') {
    cashierDataResult.toGive.forEach((item) => add({
      id: `cash-give-${item.id}`, category: 'caisse', title: 'Espèces à remettre', description: cashPurchaseTaskDescription(item),
      status: 'En attente Caisse : especes a remettre', priority: 'haute', targetUrl: `/cash-purchases/${item.id}`,
      source: 'Achat especes', reference: item.reference, responsible: 'Caisse',
      expectedAction: 'Remettre les especes et confirmer le montant remis', nextResponsible: 'Acheteur',
      nextStatus: 'En attente Acheteur : achat et retour a completer',
    }))

    invoicesResult.invoices.flatMap((invoice) => invoice.invoice_payments ?? [])
      .filter((payment) => payment.status === 'a_executer')
      .forEach((payment) => {
        const invoice = invoicesResult.invoices.find((item) => item.id === payment.invoice_id)
        if (!invoice) return
        add({
          id: `invoice-payment-execute-${payment.id}`, category: 'factures', title: 'Paiement fournisseur a executer',
          description: `${invoice.suppliers?.name ?? 'Fournisseur'} - ${Number(payment.amount).toLocaleString('fr-FR')} Ar`,
          status: 'En attente Caisse : paiement a executer', priority: 'haute', targetUrl: `/invoices/${invoice.id}`,
          source: 'Facture fournisseur', reference: invoice.reference, responsible: 'Caisse',
          expectedAction: 'Executer le paiement valide par la Direction', nextResponsible: 'Comptabilite',
          nextStatus: 'Paiement execute a rapprocher',
        })
      })
  }

  if (role === 'acheteur') {
    cashResult.purchases.filter((item) => item.status === 'especes_remises').forEach((item) => add({
      id: `cash-buy-${item.id}`, category: 'achats', title: 'Achat direct à effectuer', description: item.reason,
      status: 'En attente Acheteur : achat et retour a completer', priority: 'haute', targetUrl: `/cash-purchases/${item.id}`,
      source: 'Achat especes', reference: item.reference, responsible: 'Acheteur',
      expectedAction: 'Effectuer l’achat puis présenter marchandises, justificatifs et monnaie éventuelle au Contrôleur', nextResponsible: 'Contrôle du retour d’achat',
      nextStatus: 'En attente Controle : retour achat a verifier',
    }))

    cashResult.purchases.filter((item) => item.cash_purchase_differences?.some((difference) => difference.status === 'a_justifier')).forEach((item) => add({
      id: `cash-difference-justify-${item.id}`, category: 'caisse', title: 'Ecart achat especes a justifier', description: item.reason,
      status: 'Ecart a expliquer', priority: 'haute', targetUrl: `/cash-purchases/${item.id}`,
      source: 'Achat especes', reference: item.reference, responsible: 'Acheteur',
      expectedAction: 'Saisir l explication de l ecart', nextResponsible: 'Direction',
      nextStatus: 'En attente Direction : ecart a arbitrer', alert: 'Ecart non justifie',
    }))
  }

  if (role === 'magasinier') {
    cashResult.purchases
      .filter((item) => Boolean(item.controlled_at) && item.stock_entry_status !== 'entree_stock_faite' && item.stock_entry_status !== 'bloque_stock')
      .filter((item) => !receptionsResult.receptions.some((reception) => reception.cash_purchase_id === item.id && !['refusee', 'entree_stock'].includes(reception.status)))
      .forEach((item) => add({
        id: `cash-handover-${item.id}`, category: 'receptions', title: 'Marchandises contrôlées à prendre en charge',
        description: `${item.reference} · ${item.reason}`, status: item.reception_status ?? 'en_attente_reception', priority: 'haute',
        targetUrl: `/receptions/new?cashPurchaseId=${item.id}`, source: 'Passation achat espèces', reference: item.reference,
        responsible: 'Magasin / Stock', expectedAction: 'Vérifier la remise physique puis confirmer la prise en charge',
        nextResponsible: 'Magasin / Stock', nextStatus: 'Entrée au Magasin principal ou écart de passation',
      }))
    receptionsResult.receptions.filter((item) => item.status === 'brouillon').forEach((item) => add({
      id: `reception-draft-${item.id}`, category: 'receptions', title: 'Reception marchandises a completer',
      description: item.suppliers?.name ?? 'Fournisseur non renseigne', status: 'Brouillon reception marchandises',
      priority: 'normale', targetUrl: `/receptions/${item.id}`, source: 'Reception marchandises',
      reference: item.reference, responsible: 'Magasin / Stock', expectedAction: 'Completer puis soumettre la reception marchandises',
      nextResponsible: 'Magasin / Stock', nextStatus: 'En attente Magasin / Stock : marchandises a accepter',
    }))
    receptionsResult.receptions.filter((item) => item.status === 'en_attente').forEach((item) => add({
      id: `reception-stock-${item.id}`, category: 'receptions', title: 'Marchandises a accepter ou refuser',
      description: item.suppliers?.name ?? 'Fournisseur non renseigne', status: 'En attente Magasin / Stock : marchandises a accepter',
      priority: 'haute', targetUrl: `/receptions/${item.id}`, source: 'Reception marchandises',
      reference: item.reference, responsible: 'Magasin / Stock',
      expectedAction: 'Controler les marchandises puis accepter ou refuser avec explication', nextResponsible: 'Controle / Direction si ecart',
      nextStatus: 'Reception marchandises acceptee ou en attente Direction : ecart a arbitrer',
    }))
  }

  if (['direction', 'magasinier'].includes(role)) {
    inventoriesResult.inventories.filter((item) => ['brouillon', 'en_saisie'].includes(item.status)).forEach((item) => add({
      id: `inventory-draft-${item.id}`, category: 'inventaires', title: 'Brouillon d inventaire a completer',
      description: item.locations?.name ?? 'Localisation non renseignee', status: item.status, priority: 'normale',
      targetUrl: `/inventories/${item.id}/edit`, source: 'Inventaire', reference: item.reference,
      responsible: role === 'magasinier' ? 'Magasin / Stock' : 'Direction',
      expectedAction: 'Completer les quantites puis soumettre a validation', nextResponsible: 'Direction',
      nextStatus: 'En attente Direction : inventaire a valider',
    }))

    initialRows.filter((item) => item.status !== 'stock_initial_confirme').slice(0, 12).forEach((item) => add({
      id: `initial-inventory-${item.article_id}-${item.location_id}`, category: 'inventaires',
      title: 'Stock initial a completer', description: `${item.article_name} - ${item.location_name}`,
      status: item.status, priority: 'haute', targetUrl: '/inventories/initial', source: 'Inventaire initial',
      reference: item.article_name, responsible: 'Magasin / Stock',
      expectedAction: 'Saisir ou completer l inventaire initial', nextResponsible: 'Direction',
      nextStatus: 'En attente Direction : inventaire initial a valider',
    }))

    receptionsResult.receptions.filter((item) => (item.reception_documents?.length ?? 0) === 0 && !['refusee'].includes(item.status)).forEach((item) => add({
      id: `reception-document-${item.id}`, category: 'receptions', title: 'Justificatif de reception marchandises a joindre',
      description: item.suppliers?.name ?? 'Fournisseur non renseigne', status: 'Justificatif manquant / a regulariser',
      priority: 'haute', targetUrl: `/receptions/${item.id}`, source: 'Reception marchandises',
      reference: item.reference, responsible: 'Controle (Direction / Magasin)', expectedAction: 'Joindre la facture ou le justificatif',
      nextResponsible: 'Magasin / Stock', nextStatus: 'Justificatif present - dossier a classer', alert: 'Dossier non classe',
    }))
  }

  if (role === 'controleur') {
    cashResult.purchases.filter((item) => item.status === 'especes_remises' && !item.controlled_at).forEach((item) => add({
      id: `cash-control-document-${item.id}`, category: 'caisse', title: 'Retour d’achat à contrôler',
      description: item.reason, status: 'En attente Controle : retour achat a verifier', priority: 'haute',
      targetUrl: `/cash-purchases/${item.id}`, source: 'Achat especes', reference: item.reference,
      responsible: 'Contrôle', expectedAction: 'Contrôler marchandises, quantités, prix, justificatifs et monnaie éventuelle',
      nextResponsible: 'Magasin / Stock ou Caisse', nextStatus: 'Justificatif present - dossier a classer', alert: 'Justificatif manquant',
    }))
    cashResult.purchases.filter((item) => ['retour_partiel', 'retour_complet'].includes(item.status) && !item.controlled_at && (item.cash_purchase_receipts?.length ?? 0) > 0 && !item.cash_purchase_differences?.some((difference) => difference.status !== 'valide')).forEach((item) => add({
      id: `cash-classify-${item.id}`, category: 'caisse', title: 'Dossier achat especes non classe',
      description: item.reason, status: 'Dossier non classe', priority: 'normale', targetUrl: `/cash-purchases/${item.id}`,
      source: 'Achat especes', reference: item.reference, responsible: 'Controle / Direction',
      expectedAction: 'Controler la piece puis cloturer le dossier', nextResponsible: 'Archives',
      nextStatus: 'Dossier classe',
    }))
  }

  if (['direction', 'comptabilite'].includes(role)) {
    invoicesResult.invoices.filter((item) => !item.file_url && !['annulee', 'cloturee'].includes(item.status)).forEach((item) => add({
      id: `invoice-document-${item.id}`, category: 'factures', title: 'Facture fournisseur / justificatif a joindre',
      description: item.suppliers?.name ?? 'Fournisseur non renseigne', status: 'Justificatif manquant / a regulariser',
      priority: 'haute', targetUrl: `/invoices/${item.id}/edit`, source: 'Facture fournisseur',
      reference: item.reference, responsible: 'Controle / Comptabilite', expectedAction: 'Joindre la facture scannee avec le numero interne visible',
      nextResponsible: 'Direction si arbitrage requis', nextStatus: 'Justificatif present - dossier a verifier', alert: 'Dossier non classe',
    }))

    disbursements.filter((item) => item.metadata.supportingDocumentStatus !== 'present' && !['closed', 'cancelled', 'refused'].includes(item.status)).forEach((item) => add({
      id: `non-purchase-document-${item.id}`, category: 'caisse', title: 'Decaissement hors achat a regulariser',
      description: item.metadata.beneficiary, status: 'Justificatif manquant / a regulariser', priority: 'haute',
      targetUrl: '/cash-purchases/report#hors-achat', source: 'Decaissement hors achat', reference: item.reference,
      responsible: 'Controle (Direction / Comptabilite)', expectedAction: 'Obtenir et joindre le justificatif manquant',
      nextResponsible: 'Direction / Controle final', nextStatus: 'Justificatif present - dossier a classer', alert: 'Dossier non classe',
    }))
  }

  if (['direction', 'chef_cuisine', 'fiche_technique'].includes(role)) {
    articlesResult.articles.filter((item) => item.indicative_price_note?.includes('[A_COMPLETER]')).forEach((item) => add({
      id: `article-completion-${item.id}`, category: 'articles', title: 'Fiche article à finaliser',
      description: item.name, status: 'A completer', priority: 'normale', targetUrl: `/articles/${item.id}`,
      source: 'Article', reference: item.name, responsible: 'Référentiels',
      expectedAction: 'Compléter la fiche ou rattacher cette désignation à un article existant', nextResponsible: 'Magasin / Stock',
      nextStatus: 'Article actif et exploitable',
    }))
  }

  if (['direction', 'acheteur'].includes(role)) {
    suppliers.filter((item) => item.notes?.includes('Fiche fournisseur a completer')).forEach((item) => add({
      id: `supplier-completion-${item.id}`, category: 'achats', title: 'Fiche fournisseur à finaliser',
      description: item.name, status: 'Fiche fournisseur a completer', priority: 'normale',
      targetUrl: '/admin/suppliers', source: 'Fournisseur', reference: item.name, responsible: 'Achats',
      expectedAction: 'Compléter les informations nécessaires de la fiche fournisseur', nextResponsible: 'Achats / Comptabilite',
      nextStatus: 'Fournisseur complet',
    }))
  }

  const scopedTasks = role === 'chef_cuisine'
    ? tasks.filter((task) => task.category === 'achats' || task.category === 'receptions')
    : tasks
  return sortUserTasks(scopedTasks)
}
