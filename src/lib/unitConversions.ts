import type { Article, Unit } from './catalog'
import type { RecipeFormValues, RecipeIngredientFormValues } from './recipes'

type ConversionInput = {
  quantity: number
  displayUnit?: Pick<Unit, 'id' | 'name' | 'abbreviation'> | null
  stockUnit?: Pick<Unit, 'id' | 'name' | 'abbreviation'> | null
}

export type IngredientConversionResult = {
  quantityDisplay: number
  unitDisplay: string
  quantityStored: number
  unitStored: string
  conversionFactor: number
}

export function normalizeUnitCode(unit?: Pick<Unit, 'name' | 'abbreviation'> | null) {
  const raw = `${unit?.abbreviation || unit?.name || ''}`
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (raw === 'kilogramme') return 'kg'
  if (raw === 'gramme') return 'g'
  if (raw === 'litre') return 'l'
  if (raw === 'millilitre') return 'ml'
  if (raw === 'piece' || raw === 'pc') return 'piece'
  return raw
}

export function getUnitConversionFactor(displayUnit?: Pick<Unit, 'name' | 'abbreviation'> | null, stockUnit?: Pick<Unit, 'name' | 'abbreviation'> | null) {
  const from = normalizeUnitCode(displayUnit)
  const to = normalizeUnitCode(stockUnit)

  if (!from || !to) return null
  if (from === to) return 1
  if (from === 'g' && to === 'kg') return 0.001
  if (from === 'kg' && to === 'g') return 1000
  if (from === 'ml' && to === 'l') return 0.001
  if (from === 'l' && to === 'ml') return 1000
  return null
}

export function convertIngredientQuantity({ quantity, displayUnit, stockUnit }: ConversionInput): IngredientConversionResult {
  const factor = getUnitConversionFactor(displayUnit, stockUnit)

  if (!factor) {
    throw new Error(`Conversion impossible de ${formatUnit(displayUnit)} vers ${formatUnit(stockUnit)}`)
  }

  return {
    quantityDisplay: quantity,
    unitDisplay: formatUnit(displayUnit),
    quantityStored: quantity * factor,
    unitStored: formatUnit(stockUnit),
    conversionFactor: factor,
  }
}

export function calculateRecipeTotalsWithConversions(
  values: Pick<RecipeFormValues, 'ingredients' | 'portions' | 'margin_coefficient' | 'final_price'>,
  articles: Article[],
  units: Unit[],
) {
  const totalCost = values.ingredients.reduce((sum, ingredient) => {
    const article = articles.find((item) => item.id === ingredient.article_id)
    const displayUnit = units.find((unit) => unit.id === ingredient.unit_id)
    const stockUnit = units.find((unit) => unit.id === article?.unit_id)

    if (!article || !displayUnit || !stockUnit) return sum

    const conversion = convertIngredientQuantity({
      quantity: ingredient.quantity,
      displayUnit,
      stockUnit,
    })

    return sum + conversion.quantityStored * ingredient.unit_price
  }, 0)
  const costPerPortion = values.portions > 0 ? totalCost / values.portions : 0
  const suggestedPrice = totalCost * values.margin_coefficient
  const costRatio = values.final_price > 0 ? (totalCost / values.final_price) * 100 : 0
  const marginRate = values.final_price > 0 ? ((values.final_price - totalCost) / values.final_price) * 100 : 0

  return { totalCost, costPerPortion, suggestedPrice, costRatio, marginRate }
}

export function getIngredientConversionPreview(ingredient: RecipeIngredientFormValues, article: Article | undefined, units: Unit[]) {
  const displayUnit = units.find((unit) => unit.id === ingredient.unit_id)
  const stockUnit = units.find((unit) => unit.id === article?.unit_id)
  if (!article || !displayUnit || !stockUnit || !ingredient.quantity) return null

  return convertIngredientQuantity({
    quantity: ingredient.quantity,
    displayUnit,
    stockUnit,
  })
}

export function formatUnit(unit?: Pick<Unit, 'name' | 'abbreviation'> | null) {
  return unit?.abbreviation || unit?.name || ''
}
