export const supplierTaxStatuses = ['nif_stat_with_vat', 'nif_stat_without_vat', 'no_nif_stat_declared', 'no_nif_stat_not_declared', 'unknown'] as const
export const invoiceTaxModes = ['invoice_with_recoverable_vat', 'invoice_without_vat', 'invoice_ttc_vat_not_recoverable', 'declared_with_extra_tax', 'manual_validated'] as const
export const effectiveCostMethods = ['invoice_ht_vat_recoverable', 'invoice_amount_no_vat', 'invoice_ttc_vat_not_recoverable', 'supplier_amount_plus_declared_tax', 'manual_validated_cost', 'unavailable'] as const

export type SupplierTaxStatus = (typeof supplierTaxStatuses)[number]
export type InvoiceTaxMode = (typeof invoiceTaxModes)[number]
export type EffectiveCostMethod = (typeof effectiveCostMethods)[number]

export const supplierTaxStatusLabels: Record<SupplierTaxStatus, string> = {
  nif_stat_with_vat: 'NIF/STAT avec TVA',
  nif_stat_without_vat: 'NIF/STAT sans TVA',
  no_nif_stat_declared: 'Sans NIF/STAT declare',
  no_nif_stat_not_declared: 'Sans NIF/STAT non declare',
  unknown: 'Non renseigne',
}

export const invoiceTaxModeLabels: Record<InvoiceTaxMode, string> = {
  invoice_with_recoverable_vat: 'Facture avec TVA recuperable',
  invoice_without_vat: 'Facture sans TVA',
  invoice_ttc_vat_not_recoverable: 'TTC avec TVA non recuperable',
  declared_with_extra_tax: 'Declare avec charge en sus',
  manual_validated: 'Cout manuel valide',
}

export const effectiveCostMethodLabels: Record<EffectiveCostMethod, string> = {
  invoice_ht_vat_recoverable: 'HT avec TVA recuperable',
  invoice_amount_no_vat: 'Montant sans TVA',
  invoice_ttc_vat_not_recoverable: 'TTC avec TVA non recuperable',
  supplier_amount_plus_declared_tax: 'Montant fournisseur + charge',
  manual_validated_cost: 'Cout manuel valide',
  unavailable: 'Cout indisponible',
}

type MaterialCostInput = {
  amountHt?: number | null
  vatAmount?: number | null
  amountTtc?: number | null
  quantityStock?: number | null
  invoiceTaxMode?: InvoiceTaxMode | null
  vatRate?: number | null
  vatRecoverable?: boolean | null
  declaredExtraTaxRate?: number | null
  declaredExtraTaxAmount?: number | null
  manualCostTotal?: number | null
}

export type MaterialCostResult = {
  invoice_amount_ht: number
  invoice_vat_amount: number
  invoice_amount_ttc: number
  vat_rate: number
  vat_recoverable: boolean
  recoverable_vat_amount: number
  non_recoverable_vat_amount: number
  declared_extra_tax_rate: number
  declared_extra_tax_amount: number
  accounting_total_amount: number
  effective_material_cost_total: number | null
  effective_material_unit_cost: number | null
  effective_cost_method: EffectiveCostMethod
}

export function calculateMaterialCost(input: MaterialCostInput): MaterialCostResult {
  const amountHt = Number(input.amountHt ?? 0)
  const vatRate = Number(input.vatRate ?? 20)
  const vatAmount = Number(input.vatAmount ?? Math.max(0, amountHt * vatRate / 100))
  const amountTtc = Number(input.amountTtc ?? amountHt + vatAmount)
  const quantityStock = Number(input.quantityStock ?? 0)
  const declaredExtraTaxRate = Number(input.declaredExtraTaxRate ?? 0)
  const declaredExtraTaxAmount = Number(input.declaredExtraTaxAmount ?? amountHt * declaredExtraTaxRate / 100)
  const vatRecoverable = input.vatRecoverable ?? input.invoiceTaxMode === 'invoice_with_recoverable_vat'
  const invoiceTaxMode = input.invoiceTaxMode ?? 'invoice_with_recoverable_vat'

  let total: number | null = null
  let method: EffectiveCostMethod = 'unavailable'
  let recoverableVat = 0
  let nonRecoverableVat = 0

  if (invoiceTaxMode === 'invoice_with_recoverable_vat') {
    total = amountHt
    method = 'invoice_ht_vat_recoverable'
    recoverableVat = vatAmount
  } else if (invoiceTaxMode === 'invoice_without_vat') {
    total = amountHt || amountTtc
    method = 'invoice_amount_no_vat'
  } else if (invoiceTaxMode === 'invoice_ttc_vat_not_recoverable') {
    total = amountTtc
    method = 'invoice_ttc_vat_not_recoverable'
    nonRecoverableVat = vatAmount
  } else if (invoiceTaxMode === 'declared_with_extra_tax') {
    total = amountHt + declaredExtraTaxAmount
    method = 'supplier_amount_plus_declared_tax'
  } else if (invoiceTaxMode === 'manual_validated') {
    total = Number(input.manualCostTotal ?? 0) || null
    method = total === null ? 'unavailable' : 'manual_validated_cost'
  }

  if (!vatRecoverable && invoiceTaxMode === 'invoice_with_recoverable_vat') {
    total = amountTtc
    method = 'invoice_ttc_vat_not_recoverable'
    recoverableVat = 0
    nonRecoverableVat = vatAmount
  }

  return {
    invoice_amount_ht: roundMoney(amountHt),
    invoice_vat_amount: roundMoney(vatAmount),
    invoice_amount_ttc: roundMoney(amountTtc),
    vat_rate: vatRate,
    vat_recoverable: vatRecoverable,
    recoverable_vat_amount: roundMoney(recoverableVat),
    non_recoverable_vat_amount: roundMoney(nonRecoverableVat),
    declared_extra_tax_rate: declaredExtraTaxRate,
    declared_extra_tax_amount: roundMoney(declaredExtraTaxAmount),
    accounting_total_amount: roundMoney(amountTtc + declaredExtraTaxAmount),
    effective_material_cost_total: total === null ? null : roundMoney(total),
    effective_material_unit_cost: total === null || quantityStock <= 0 ? null : roundCost(total / quantityStock),
    effective_cost_method: method,
  }
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

function roundCost(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 10000) / 10000
}
