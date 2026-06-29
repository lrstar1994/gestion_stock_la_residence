import { supabase } from '../../lib/supabase'
import type { AuditIssue, AuditSection, InterModuleAudit } from '../../lib/interModuleAudit'

export async function getInterModuleAudit(): Promise<InterModuleAudit> {
  const [receptionStock, needsOrders, ordersReceptions, invoicesReceptions, salesStock, stockOutsMovements, inventoryCorrections] = await Promise.all([
    auditReceptionStock(),
    auditNeedsOrders(),
    auditOrdersReceptions(),
    auditInvoicesReceptions(),
    auditSalesStock(),
    auditStockOutsMovements(),
    auditInventoryCorrections(),
  ])

  const sections = [receptionStock, needsOrders, ordersReceptions, invoicesReceptions, salesStock, stockOutsMovements, inventoryCorrections]
  const issues = sections.flatMap((section) => section.issues)
  return {
    generatedAt: new Date().toISOString(),
    totalIssues: issues.length,
    criticalIssues: issues.filter((issue) => issue.severity === 'critical').length,
    warningIssues: issues.filter((issue) => issue.severity === 'warning').length,
    sections,
  }
}

async function auditReceptionStock(): Promise<AuditSection> {
  const { data: receptions } = await supabase.schema('stock')
    .from('receptions')
    .select('id, reference, status, reception_items(id)')
    .in('status', ['validee', 'validee_avec_anomalies', 'entree_stock'])

  const issues: AuditIssue[] = []
  for (const reception of receptions ?? []) {
    const itemIds = (reception.reception_items ?? []).map((item: { id: string }) => item.id)
    if (itemIds.length === 0) continue
    const { count } = await supabase.schema('stock').from('stock_movements').select('id', { count: 'exact', head: true }).in('reception_item_id', itemIds)
    if ((count ?? 0) < itemIds.length) {
      issues.push({
        id: `reception-stock-${reception.id}`,
        module: 'Receptions -> Stock',
        severity: reception.status === 'entree_stock' ? 'critical' : 'warning',
        title: 'Entree stock incomplete',
        description: `La reception ${reception.reference} contient ${itemIds.length} ligne(s), mais seulement ${count ?? 0} mouvement(s) stock lie(s).`,
        sourceLabel: reception.reference,
        sourcePath: `/receptions/${reception.id}`,
        targetLabel: 'Stock',
        targetPath: '/stock',
      })
    }
  }
  return section('reception-stock', 'Receptions vers stock', 'Chaque reception validee doit avoir ses mouvements d entree en stock.', issues)
}

async function auditNeedsOrders(): Promise<AuditSection> {
  const { data: needs } = await supabase.schema('stock').from('purchase_needs').select('id, status, articles(name)').eq('status', 'regroupe')
  const { data: links } = await supabase.schema('stock').from('purchase_order_needs').select('need_id, purchase_order_id')
  const linked = new Set((links ?? []).map((link) => link.need_id))
  const issues = (needs ?? [])
    .filter((need) => !linked.has(need.id))
    .map((need): AuditIssue => ({
      id: `need-order-${need.id}`,
      module: 'Besoins -> Commandes',
      severity: 'critical',
      title: 'Besoin regroupe sans commande',
      description: `Le besoin ${articleName(need.articles)} est marque regroupe mais aucune commande fournisseur ne le reference.`,
      sourceLabel: articleName(need.articles),
      sourcePath: '/purchase-needs',
      targetLabel: 'Commandes',
      targetPath: '/purchase-orders',
    }))
  return section('needs-orders', 'Besoins vers commandes', 'Un besoin regroupe doit etre rattache a une commande fournisseur.', issues)
}

async function auditOrdersReceptions(): Promise<AuditSection> {
  const { data: orders } = await supabase.schema('stock')
    .from('purchase_orders')
    .select('id, reference, status')
    .in('status', ['envoyee', 'partiellement_livree', 'livree', 'reception_avec_ecart'])
  const { data: receptions } = await supabase.schema('stock').from('receptions').select('id, purchase_order_id, status')
  const receptionByOrder = new Map<string, Array<{ id: string; status: string }>>()
  for (const reception of receptions ?? []) {
    if (!reception.purchase_order_id) continue
    const current = receptionByOrder.get(reception.purchase_order_id) ?? []
    current.push(reception)
    receptionByOrder.set(reception.purchase_order_id, current)
  }
  const issues = (orders ?? []).flatMap((order): AuditIssue[] => {
    const linked = receptionByOrder.get(order.id) ?? []
    if (['livree', 'reception_avec_ecart'].includes(order.status) && linked.length === 0) {
      return [{
        id: `order-reception-${order.id}`,
        module: 'Commandes -> Receptions',
        severity: 'critical',
        title: 'Commande livree sans reception',
        description: `La commande ${order.reference} est au statut ${order.status}, mais aucune reception ne lui est rattachee.`,
        sourceLabel: order.reference,
        sourcePath: `/purchase-orders/${order.id}`,
        targetLabel: 'Creer reception',
        targetPath: '/receptions/new',
      }]
    }
    return []
  })
  return section('orders-receptions', 'Commandes vers receptions', 'Une commande livree ou avec ecart doit posseder au moins une reception rattachee.', issues)
}

async function auditInvoicesReceptions(): Promise<AuditSection> {
  const { data: invoices } = await supabase.schema('stock')
    .from('invoices')
    .select('id, reference, status, amount_ttc, reception_id, receptions(id, reference, status, total_amount)')
    .not('reception_id', 'is', null)
    .neq('status', 'annulee')

  const issues: AuditIssue[] = []
  for (const invoice of invoices ?? []) {
    const reception = Array.isArray(invoice.receptions) ? invoice.receptions[0] : invoice.receptions
    if (!reception) continue
    if (reception.status === 'refusee' && !['conteste', 'annulee'].includes(invoice.status)) {
      issues.push({
        id: `invoice-refused-reception-${invoice.id}`,
        module: 'Receptions -> Factures',
        severity: 'critical',
        title: 'Facture active sur reception refusee',
        description: `La facture ${invoice.reference} est active alors que la reception ${reception.reference} est refusee.`,
        sourceLabel: invoice.reference,
        sourcePath: `/invoices/${invoice.id}`,
        targetLabel: reception.reference,
        targetPath: `/receptions/${reception.id}`,
      })
    }
    const difference = Math.abs(Number(invoice.amount_ttc ?? 0) - Number(reception.total_amount ?? 0))
    if (difference > 0.01 && invoice.status !== 'conteste') {
      issues.push({
        id: `invoice-reception-amount-${invoice.id}`,
        module: 'Receptions -> Factures',
        severity: 'warning',
        title: 'Ecart montant facture / reception',
        description: `Ecart de ${difference.toLocaleString('fr-FR')} Ar entre ${invoice.reference} et ${reception.reference}.`,
        sourceLabel: invoice.reference,
        sourcePath: `/invoices/${invoice.id}`,
        targetLabel: reception.reference,
        targetPath: `/receptions/${reception.id}`,
      })
    }
  }
  return section('invoices-receptions', 'Receptions vers factures', 'Les factures liees doivent rester coherentes avec la reception.', issues)
}

async function auditSalesStock(): Promise<AuditSection> {
  const { data: sales } = await supabase.schema('stock').from('sales').select('id, reference, status').eq('status', 'validee')
  const { data: links } = await supabase.schema('stock').from('sale_stock_outs').select('sale_id')
  const linked = new Set((links ?? []).map((link) => link.sale_id))
  const issues = (sales ?? [])
    .filter((sale) => !linked.has(sale.id))
    .map((sale): AuditIssue => ({
      id: `sale-stock-${sale.id}`,
      module: 'Ventes -> Sorties stock',
      severity: 'critical',
      title: 'Vente sans sortie stock',
      description: `La vente ${sale.reference} est validee mais aucune sortie stock ne lui est rattachee.`,
      sourceLabel: sale.reference,
      sourcePath: `/sales/${sale.id}`,
      targetLabel: 'Sorties stock',
      targetPath: '/stock/stock-out',
    }))
  return section('sales-stock', 'Ventes vers stock', 'Une vente validee doit avoir une sortie de stock rattachee.', issues)
}

async function auditStockOutsMovements(): Promise<AuditSection> {
  const { data: stockOuts } = await supabase.schema('stock')
    .from('stock_outs')
    .select('id, reference, status, stock_movement_id')
    .eq('status', 'valide')
    .is('stock_movement_id', null)
  const issues = (stockOuts ?? []).map((out): AuditIssue => ({
    id: `stockout-movement-${out.id}`,
    module: 'Sorties stock -> Mouvements',
    severity: 'critical',
    title: 'Sortie validee sans mouvement stock',
    description: `La sortie ${out.reference} est validee mais aucun mouvement stock ne lui est rattache.`,
    sourceLabel: out.reference,
    sourcePath: `/stock/stock-out/${out.id}`,
    targetLabel: 'Journal des mouvements',
    targetPath: '/stock/movements',
  }))
  return section('stockouts-movements', 'Sorties vers mouvements stock', 'Une sortie validee doit generer un mouvement de stock.', issues)
}

async function auditInventoryCorrections(): Promise<AuditSection> {
  const { data } = await supabase.schema('stock')
    .from('inventory_adjustment_requests')
    .select('id, reason, status, inventory_id, inventories(reference)')
    .eq('status', 'en_attente')
  const issues = (data ?? []).map((request): AuditIssue => {
    const inventory = Array.isArray(request.inventories) ? request.inventories[0] : request.inventories
    return {
      id: `inventory-adjustment-${request.id}`,
      module: 'Inventaires -> Stock',
      severity: 'warning',
      title: 'Correction inventaire en attente',
      description: request.reason || 'Une demande de correction apres validation attend une decision Direction.',
      sourceLabel: inventory?.reference ?? 'Inventaire',
      sourcePath: `/inventories/${request.inventory_id}`,
      targetLabel: 'Stock',
      targetPath: '/stock',
    }
  })
  return section('inventory-corrections', 'Inventaires vers stock', 'Les corrections apres validation doivent etre validees pour ajuster le stock.', issues)
}

function section(key: string, title: string, description: string, issues: AuditIssue[]): AuditSection {
  return { key, title, description, status: issues.length > 0 ? 'attention' : 'ok', issues }
}

function articleName(value: unknown) {
  const article = Array.isArray(value) ? value[0] : value
  return typeof article === 'object' && article && 'name' in article ? String(article.name) : 'Article'
}
