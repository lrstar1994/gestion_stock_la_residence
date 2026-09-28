export const priceSourceTypes = ['indicative', 'real_reception', 'real_invoice', 'real_receipt', 'promo', 'manual_direction'] as const
export const priceReferenceStatuses = ['draft', 'active', 'superseded', 'rejected', 'archived'] as const

export type PriceSourceType = (typeof priceSourceTypes)[number]
export type PriceReferenceStatus = (typeof priceReferenceStatuses)[number]

export const priceSourceTypeLabels: Record<PriceSourceType, string> = {
  indicative: 'Prix indicatif',
  real_reception: 'Prix reel de reception',
  real_invoice: 'Prix reel facture',
  real_receipt: 'Prix reel justificatif',
  promo: 'Prix promo',
  manual_direction: 'Reference Direction',
}

export const priceRules = {
  indicative: 'Aide a la demande ou a la preparation, non officielle.',
  real: 'Reference issue d une facture, d un justificatif ou d une reception validee.',
  promo: 'Historise pour comparaison, non retenu automatiquement comme reference sauf validation Direction.',
}

export function isOfficialMaterialPrice(source: PriceSourceType, directionApproved = false) {
  if (source === 'promo') return directionApproved
  return ['real_reception', 'real_invoice', 'real_receipt', 'manual_direction'].includes(source)
}

