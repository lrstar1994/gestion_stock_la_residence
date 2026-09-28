import * as XLSX from 'xlsx'
import type { IngredientQuantityMode, RecipeMainIngredient, RecipeType, RecipeYieldMode } from './recipes'

export const RECIPE_IMPORT_SHEETS = ['FICHES', 'INGRÉDIENTS', 'DÉROULÉ', 'AIDE'] as const

export const RECIPE_IMPORT_COLUMNS = {
  FICHES: ['Code fiche facultatif', 'Nom', 'Type', 'Mode rendement', 'Portions', 'Quantité rendement', 'Unité rendement', 'Matière principale', 'Tags', 'Description', 'Observation'],
  INGRÉDIENTS: ['Code fiche', 'Ordre', 'Ingrédient', 'Article existant si connu', 'Quantité', 'Unité', 'BRUT_NET', 'Forme parée éventuelle', 'Prix indicatif facultatif', 'Observation'],
  DÉROULÉ: ['Code fiche', 'Ordre étape', 'Titre', 'Description', 'Durée active', 'Durée passive', 'Point de vigilance', 'Observation'],
} as const

export type RecipeImportRecipeRow = {
  code: string | null
  importKey: string
  name: string
  type: RecipeType
  yieldMode: RecipeYieldMode
  portions: number
  yieldQuantity: number | null
  yieldUnitName: string | null
  mainIngredient: RecipeMainIngredient
  tags: string[]
  description: string | null
  observation: string | null
}

export type RecipeImportIngredientRow = {
  recipeCode: string
  order: number
  importedName: string
  knownArticleName: string | null
  quantity: number
  unitName: string
  quantityMode: IngredientQuantityMode
  trimFormName: string | null
  indicativePrice: number | null
  observation: string | null
}

export type RecipeImportStepRow = {
  recipeCode: string
  order: number
  title: string | null
  description: string
  activeDuration: number | null
  passiveDuration: number | null
  attentionPoint: string | null
  observation: string | null
}

export type ParsedRecipeWorkbook = {
  recipes: RecipeImportRecipeRow[]
  ingredients: RecipeImportIngredientRow[]
  steps: RecipeImportStepRow[]
}

type ExcelRow = Record<string, unknown>

export function buildOfficialRecipeImportWorkbook() {
  const workbook = XLSX.utils.book_new()
  const sampleCode = 'FT-EXEMPLE-001'
  const sheets: Array<[string, ExcelRow[]]> = [
    ['FICHES', [{ 'Code fiche facultatif': sampleCode, Nom: 'Exemple à supprimer', Type: 'PL', 'Mode rendement': 'PORTIONS', Portions: 10, 'Quantité rendement': '', 'Unité rendement': '', 'Matière principale': 'MIX', Tags: '', Description: '', Observation: '' }]],
    ['INGRÉDIENTS', [{ 'Code fiche': sampleCode, Ordre: 1, Ingrédient: 'Exemple ingrédient', 'Article existant si connu': '', Quantité: 1, Unité: 'KG', BRUT_NET: 'BRUT', 'Forme parée éventuelle': '', 'Prix indicatif facultatif': '', Observation: '' }]],
    ['DÉROULÉ', [{ 'Code fiche': sampleCode, 'Ordre étape': 1, Titre: 'Préparation', Description: 'Décrire précisément l’étape', 'Durée active': '', 'Durée passive': '', 'Point de vigilance': '', Observation: '' }]],
    ['AIDE', [
      { Rubrique: 'Feuilles', Règle: 'Ne pas renommer FICHES, INGRÉDIENTS, DÉROULÉ ou AIDE.' },
      { Rubrique: 'Mode rendement', Règle: 'Valeurs autorisées : PORTIONS ou RENDEMENT_PRODUIT.' },
      { Rubrique: 'BRUT_NET', Règle: 'Valeurs autorisées : BRUT ou NET.' },
      { Rubrique: 'Unités', Règle: 'Utiliser une unité existante. Une unité inconnue est signalée, jamais créée ni convertie avec un facteur supposé.' },
      { Rubrique: 'Formes parées', Règle: 'Pour NET, utiliser une forme parée existante ; sinon la ligne reste à contrôler.' },
      { Rubrique: 'Ingrédients inconnus', Règle: 'Ils sont placés dans Ingrédients à rapprocher. Aucun article n’est créé automatiquement.' },
      { Rubrique: 'Prix indicatif', Règle: 'Le prix Excel est seulement un PRIX INDICATIF IMPORTÉ. Il n’alimente jamais le prix officiel Achats ni le coût officiel FT.' },
      { Rubrique: 'Création', Règle: 'Chaque fiche est créée en brouillon. Aucun envoi ni aucune validation ne sont automatiques.' },
      { Rubrique: 'Rapprochement', Règle: 'Une correspondance incertaine exige une confirmation humaine. Seuls les alias confirmés peuvent être réutilisés automatiquement.' },
    ]],
  ]
  for (const [name, rows] of sheets) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name)
  return workbook
}

export function parseOfficialRecipeImportWorkbook(workbook: XLSX.WorkBook): ParsedRecipeWorkbook {
  for (const sheetName of RECIPE_IMPORT_SHEETS) {
    if (!workbook.Sheets[sheetName]) throw new Error(`Feuille obligatoire absente : ${sheetName}`)
  }
  const fiches = readSheet(workbook, 'FICHES', RECIPE_IMPORT_COLUMNS.FICHES)
  const ingredients = readSheet(workbook, 'INGRÉDIENTS', RECIPE_IMPORT_COLUMNS.INGRÉDIENTS)
  const steps = readSheet(workbook, 'DÉROULÉ', RECIPE_IMPORT_COLUMNS.DÉROULÉ)
  const seenCodes = new Set<string>()
  const recipes = fiches.map((row, index) => {
    const rowNumber = index + 2
    const name = textValue(row.Nom)
    const code = nullableText(row['Code fiche facultatif'])
    const type = textValue(row.Type).toUpperCase() as RecipeType
    const yieldModeRaw = textValue(row['Mode rendement']).toUpperCase()
    const yieldMode: RecipeYieldMode | null = yieldModeRaw === 'PORTIONS' ? 'portions' : yieldModeRaw === 'RENDEMENT_PRODUIT' ? 'rendement_produit' : null
    const portions = numberValue(row.Portions)
    const yieldQuantity = optionalNumber(row['Quantité rendement'])
    if (!name) throw new Error(`FICHES ligne ${rowNumber} : Nom obligatoire`)
    if (!type) throw new Error(`FICHES ligne ${rowNumber} : Type obligatoire`)
    if (!yieldMode) throw new Error(`FICHES ligne ${rowNumber} : Mode rendement inconnu`)
    if (!Number.isInteger(portions) || portions <= 0) throw new Error(`FICHES ligne ${rowNumber} : Portions invalides`)
    if (yieldMode === 'rendement_produit' && (!yieldQuantity || yieldQuantity <= 0)) throw new Error(`FICHES ligne ${rowNumber} : Quantité rendement obligatoire`)
    const importKey = code || name
    if (seenCodes.has(normalizeImportLabel(importKey))) throw new Error(`Code fiche ou nom de liaison dupliqué dans le fichier : ${importKey}`)
    seenCodes.add(normalizeImportLabel(importKey))
    return {
      code, importKey, name, type, yieldMode, portions, yieldQuantity,
      yieldUnitName: nullableText(row['Unité rendement']),
      mainIngredient: textValue(row['Matière principale']).toUpperCase() as RecipeMainIngredient,
      tags: textValue(row.Tags).split(/[,;|]/).map((value) => value.trim().toLowerCase()).filter(Boolean),
      description: nullableText(row.Description),
      observation: nullableText(row.Observation),
    }
  })
  const codes = new Set(recipes.map((recipe) => normalizeImportLabel(recipe.importKey)))
  const parsedIngredients = ingredients.map((row, index) => {
    const rowNumber = index + 2
    const recipeCode = textValue(row['Code fiche'])
    const quantityModeRaw = textValue(row.BRUT_NET).toUpperCase()
    const quantity = numberValue(row.Quantité)
    if (!codes.has(normalizeImportLabel(recipeCode))) throw new Error(`INGRÉDIENTS ligne ${rowNumber} : Code fiche inexistant (${recipeCode})`)
    if (!textValue(row.Ingrédient)) throw new Error(`INGRÉDIENTS ligne ${rowNumber} : Ingrédient obligatoire`)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`INGRÉDIENTS ligne ${rowNumber} : Quantité invalide`)
    if (!textValue(row.Unité)) throw new Error(`INGRÉDIENTS ligne ${rowNumber} : Unité obligatoire`)
    if (!['BRUT', 'NET'].includes(quantityModeRaw)) throw new Error(`INGRÉDIENTS ligne ${rowNumber} : BRUT_NET invalide`)
    return { recipeCode, order: positiveInteger(row.Ordre, rowNumber, 'INGRÉDIENTS'), importedName: textValue(row.Ingrédient), knownArticleName: nullableText(row['Article existant si connu']), quantity, unitName: textValue(row.Unité), quantityMode: quantityModeRaw.toLowerCase() as IngredientQuantityMode, trimFormName: nullableText(row['Forme parée éventuelle']), indicativePrice: optionalNumber(row['Prix indicatif facultatif']), observation: nullableText(row.Observation) }
  })
  const parsedSteps = steps.map((row, index) => {
    const rowNumber = index + 2
    const recipeCode = textValue(row['Code fiche'])
    if (!codes.has(normalizeImportLabel(recipeCode))) throw new Error(`DÉROULÉ ligne ${rowNumber} : Code fiche inexistant (${recipeCode})`)
    const description = textValue(row.Description)
    if (!description) throw new Error(`DÉROULÉ ligne ${rowNumber} : Description obligatoire`)
    return { recipeCode, order: positiveInteger(row['Ordre étape'], rowNumber, 'DÉROULÉ'), title: nullableText(row.Titre), description, activeDuration: optionalNonNegative(row['Durée active'], rowNumber), passiveDuration: optionalNonNegative(row['Durée passive'], rowNumber), attentionPoint: nullableText(row['Point de vigilance']), observation: nullableText(row.Observation) }
  })
  assertUniqueOrder(parsedIngredients, 'ingredients')
  assertUniqueOrder(parsedSteps, 'steps')
  return { recipes, ingredients: parsedIngredients, steps: parsedSteps }
}

export function normalizeImportLabel(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function readSheet(workbook: XLSX.WorkBook, name: string, columns: readonly string[]) {
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(workbook.Sheets[name], { defval: '' })
  const header = (XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, blankrows: false })[0] ?? []) as unknown[]
  const missing = columns.filter((column) => !header.map(String).includes(column))
  if (missing.length) throw new Error(`${name} : colonne(s) obligatoire(s) absente(s) : ${missing.join(', ')}`)
  return rows.filter((row) => Object.values(row).some((value) => textValue(value)))
}

function textValue(value: unknown) { return String(value ?? '').trim() }
function nullableText(value: unknown) { return textValue(value) || null }
function numberValue(value: unknown) { return Number(String(value ?? '').replace(',', '.')) }
function optionalNumber(value: unknown) { const text = textValue(value); if (!text) return null; const valueNumber = numberValue(value); if (!Number.isFinite(valueNumber)) throw new Error(`Valeur numérique invalide : ${text}`); return valueNumber }
function positiveInteger(value: unknown, row: number, sheet: string) { const result = numberValue(value); if (!Number.isInteger(result) || result <= 0) throw new Error(`${sheet} ligne ${row} : ordre invalide`); return result }
function optionalNonNegative(value: unknown, row: number) { const result = optionalNumber(value); if (result !== null && result < 0) throw new Error(`DÉROULÉ ligne ${row} : durée invalide`); return result }
function assertUniqueOrder(rows: Array<{ recipeCode: string; order: number }>, label: string) { const seen = new Set<string>(); for (const row of rows) { const key = `${normalizeImportLabel(row.recipeCode)}:${row.order}`; if (seen.has(key)) throw new Error(`Ordre ${label} dupliqué pour ${row.recipeCode} : ${row.order}`); seen.add(key) } }
