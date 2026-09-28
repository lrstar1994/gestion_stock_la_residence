import type { UserRole } from './validation'

export type SensitiveActionKey =
  | 'purchase_need.validate'
  | 'purchase_need.refuse'
  | 'cash_purchase.validate'
  | 'cash_purchase.refuse'
  | 'cash_difference.validate'
  | 'purchase_order.validate'
  | 'purchase_order.cancel'
  | 'reception.validate'
  | 'reception.refuse'
  | 'invoice.validate'
  | 'invoice.payment.validate'
  | 'invoice.payment.refuse'
  | 'stock.negative.authorize'
  | 'stock.correction.validate'
  | 'stock.movement.retroactive.validate'
  | 'inventory.validate'
  | 'inventory.adjustment.validate'
  | 'recipe.final_validate'
  | 'article_supplier_price.promo.override'
  | 'referential.archive'
  | 'referential.merge'

export type SensitiveActionDefinition = {
  key: SensitiveActionKey
  module: 'achats' | 'caisse' | 'stock' | 'inventaires' | 'factures' | 'fiches_techniques' | 'referentiels'
  label: string
  allowedRoles: UserRole[]
  requiresPin: boolean
  requiresReason: boolean
  auditRequired: boolean
}

export const sensitiveActions: SensitiveActionDefinition[] = [
  { key: 'purchase_need.validate', module: 'achats', label: "Valider une demande d'achat", allowedRoles: ['direction'], requiresPin: true, requiresReason: false, auditRequired: true },
  { key: 'purchase_need.refuse', module: 'achats', label: "Refuser une demande d'achat", allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'cash_purchase.validate', module: 'caisse', label: 'Valider un decaissement achat especes', allowedRoles: ['direction'], requiresPin: true, requiresReason: false, auditRequired: true },
  { key: 'cash_purchase.refuse', module: 'caisse', label: 'Refuser un decaissement achat especes', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'cash_difference.validate', module: 'caisse', label: 'Valider un ecart de caisse achat', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'purchase_order.validate', module: 'achats', label: 'Valider une commande fournisseur', allowedRoles: ['direction'], requiresPin: true, requiresReason: false, auditRequired: true },
  { key: 'purchase_order.cancel', module: 'achats', label: 'Annuler une commande fournisseur', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'reception.validate', module: 'achats', label: 'Valider une reception', allowedRoles: ['direction', 'magasinier'], requiresPin: true, requiresReason: false, auditRequired: true },
  { key: 'reception.refuse', module: 'achats', label: 'Refuser une reception', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'invoice.validate', module: 'factures', label: 'Valider une facture fournisseur', allowedRoles: ['direction'], requiresPin: true, requiresReason: false, auditRequired: true },
  { key: 'invoice.payment.validate', module: 'factures', label: 'Valider un paiement fournisseur', allowedRoles: ['direction'], requiresPin: true, requiresReason: false, auditRequired: true },
  { key: 'invoice.payment.refuse', module: 'factures', label: 'Refuser un paiement fournisseur', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'stock.negative.authorize', module: 'stock', label: 'Autoriser une exception de stock negatif', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'stock.correction.validate', module: 'stock', label: 'Valider une correction de stock', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'stock.movement.retroactive.validate', module: 'stock', label: 'Valider un mouvement retroactif', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'inventory.validate', module: 'inventaires', label: 'Valider un inventaire', allowedRoles: ['direction'], requiresPin: true, requiresReason: false, auditRequired: true },
  { key: 'inventory.adjustment.validate', module: 'inventaires', label: "Valider une correction d'inventaire", allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'recipe.final_validate', module: 'fiches_techniques', label: 'Valider definitivement une fiche technique', allowedRoles: ['direction'], requiresPin: true, requiresReason: false, auditRequired: true },
  { key: 'article_supplier_price.promo.override', module: 'achats', label: 'Retenir un prix promotionnel comme reference', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'referential.archive', module: 'referentiels', label: 'Archiver un referentiel', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
  { key: 'referential.merge', module: 'referentiels', label: 'Fusionner un referentiel', allowedRoles: ['direction'], requiresPin: true, requiresReason: true, auditRequired: true },
]

export function getSensitiveActionDefinition(key: SensitiveActionKey) {
  return sensitiveActions.find((action) => action.key === key)
}

export function canRunSensitiveAction(role: UserRole | undefined, key: SensitiveActionKey) {
  const action = getSensitiveActionDefinition(key)
  return Boolean(role && action?.allowedRoles.includes(role))
}

