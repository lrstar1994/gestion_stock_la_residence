import { Archive, CheckCircle, Copy, FileText, Pencil, RotateCcw, Send } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { archiveRecipe, getCurrentRecipeMaterialCost, getRecipe, getRecipeDressingPhotoUrl, listRecipeVersions, removeRecipeDressingPhoto, reviewRecipeAsChef, reviewRecipeAsDirection, submitRecipeForValidation } from '../../api/modules/recipes.api'
import { getLastNormalActualPurchasePrices } from '../../api/modules/purchasePrices.api'
import { getMyPinStatus } from '../../api/modules/sensitiveActions.api'
import { SensitiveActionModal } from '../../components/SensitiveActionModal'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../lib/errors'
import { exportRecipeToPdf } from '../../lib/recipeExports'
import { calculateRecipeOperationalEconomics, canChefReviewRecipes, canEditRecipes, canValidateRecipes, getRecipeCostStatusLabel, getRecipeReadiness, getRecipeWorkflowLabel, isRecipeReadyForValidation, mainIngredientLabels, recipeStatusLabels, recipeTypeLabels } from '../../lib/recipes'
import type { Recipe, RecipePriceObservation, RecipeProvisionalIngredientPrice } from '../../lib/recipes'

export function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [versions, setVersions] = useState<Recipe[]>([])
  const [currentCosts, setCurrentCosts] = useState<Record<string, number>>({})
  const [currentMaterialCost, setCurrentMaterialCost] = useState<number | null>(null)
  const [priceObservations, setPriceObservations] = useState<Map<string, RecipePriceObservation | null>>(new Map())
  const [provisionalPrices, setProvisionalPrices] = useState<Map<string, RecipeProvisionalIngredientPrice | null>>(new Map())
  const [dressingPhotoUrl, setDressingPhotoUrl] = useState<string | null>(null)
  const [pinDefined, setPinDefined] = useState(false)
  const [sensitiveAction, setSensitiveAction] = useState<'chef_validate' | 'chef_return' | 'direction_validate' | 'direction_return' | 'archive' | null>(null)
  const [retainedPrice, setRetainedPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const canEdit = canEditRecipes(profile?.role) && (recipe?.status === 'brouillon' || recipe?.status === 'validee')
  const canValidate = canValidateRecipes(profile?.role)
  const canChefReview = canChefReviewRecipes(profile?.role)

  const loadRecipe = useCallback(async () => {
    if (!id) return
    try {
      setCurrentMaterialCost(null)
      const loadedRecipe = await getRecipe(id)
      setRecipe(loadedRecipe)
      setProvisionalPrices(new Map((loadedRecipe.provisional_prices ?? []).reduce<Array<[string, RecipeProvisionalIngredientPrice]>>((rows, item) => rows.some(([articleId]) => articleId === item.article_id) || item.normalized_amount_ttc == null ? rows : [...rows, [item.article_id, { ...item, amount_ttc: Number(item.normalized_amount_ttc), unit_id: item.normalized_unit_id ?? item.unit_id }]], [])))
      setDressingPhotoUrl(loadedRecipe.dressing_photo_path ? await getRecipeDressingPhotoUrl(loadedRecipe.dressing_photo_path) : loadedRecipe.dressing_photo_url ?? null)
      setVersions(await listRecipeVersions(loadedRecipe))
      getCurrentRecipeMaterialCost(loadedRecipe.id).then(setCurrentMaterialCost).catch(() => setCurrentMaterialCost(null))
      const articleIds = Array.from(new Set((loadedRecipe.recipe_ingredients ?? []).map((ingredient) => ingredient.article_id).filter(Boolean)))
      try {
        const prices = await getLastNormalActualPurchasePrices(articleIds)
        setCurrentCosts(Object.fromEntries(prices.filter((item) => item.normalized_unit_price != null).map((item) => [item.article_id, Number(item.normalized_unit_price)])))
        setPriceObservations(new Map(articleIds.map((articleId) => [articleId, prices.find((item) => item.article_id === articleId) ?? null] as [string, RecipePriceObservation | null])))
      } catch {
        // The official purchase-price contract is local until its migration is deployed on TEST.
        // Keep the recipe readable and surface the missing contract in the readiness checks.
        setCurrentCosts({})
        setPriceObservations(new Map(articleIds.map((articleId) => [articleId, null] as [string, RecipePriceObservation | null])))
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Fiche technique introuvable'))
      navigate('/recipes')
    }
  }, [id, navigate])

  useEffect(() => {
    loadRecipe()
  }, [loadRecipe])

  useEffect(() => {
    if (!canValidate && !canChefReview) return
    getMyPinStatus().then((status) => setPinDefined(status.pin_defined)).catch(() => setPinDefined(false))
  }, [canValidate])

  if (!recipe) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const unresolved = recipe.pending_ingredients?.filter((item) => item.status === 'pending' || item.status === 'ambiguous') ?? []
  const readiness = getRecipeReadiness(recipe, priceObservations, provisionalPrices)
  const isReady = isRecipeReadyForValidation(recipe, priceObservations, provisionalPrices)
  const articleIngredients = (recipe.recipe_ingredients ?? []).filter((ingredient) => (ingredient.line_kind ?? 'article') === 'article' && Boolean(ingredient.article_id))
  const hasIncompleteOfficialCost = articleIngredients.some((ingredient) => {
    const observation = priceObservations.get(ingredient.article_id)
    return observation == null || observation.normalized_unit_price == null
  })
  const provisionalMaterialCost = articleIngredients.reduce<number | null>((sum, ingredient) => {
    if (sum == null) return null
    const official = priceObservations.get(ingredient.article_id)
    const price = official?.normalized_unit_price ?? (official == null ? provisionalPrices.get(ingredient.article_id)?.normalized_amount_ttc ?? null : null)
    const quantity = Number(ingredient.quantity_stored ?? ingredient.quantity ?? 0)
    return price != null && quantity > 0 ? sum + quantity * Number(price) : null
  }, 0)
  const economics = calculateRecipeOperationalEconomics(
    hasIncompleteOfficialCost ? provisionalMaterialCost : currentMaterialCost,
    recipe.yield_mode ?? 'portions',
    Number(recipe.portions ?? 0),
    Number(recipe.yield_quantity ?? 0),
  )
  const workflowActionLabel = recipe.workflow_status === 'submitted'
    ? 'À valider par Chef'
    : recipe.workflow_status === 'chef_validated'
      ? 'À valider par Direction'
      : recipe.workflow_status === 'needs_correction' ? 'À corriger' : (recipe.direction_validated_at || recipe.status === 'validee' || recipe.workflow_status === 'approved') ? 'Validée par Direction' : recipeStatusLabels[recipe.status]

  const submit = async () => {
    try {
      await submitRecipeForValidation(recipe.id)
      toast.success('Fiche technique soumise a validation')
      await loadRecipe()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const confirmSensitiveAction = async ({ pin, reason }: { pin: string; reason: string }) => {
    if (!sensitiveAction) return
    setBusy(true)
    try {
      if (sensitiveAction === 'chef_validate' || sensitiveAction === 'chef_return') {
        const approve = sensitiveAction === 'chef_validate'
        await reviewRecipeAsChef(recipe.id, approve, pin, reason)
        toast.success(approve ? 'Validation Chef enregistrée' : 'Fiche renvoyée à corriger')
      } else if (sensitiveAction === 'archive') {
        await archiveRecipe(recipe.id, pin, reason)
        toast.success('Fiche technique archivée')
      } else {
        const approve = sensitiveAction === 'direction_validate'
        const parsedPrice = approve ? Number(retainedPrice) : undefined
        if (approve && (!Number.isFinite(parsedPrice) || Number(parsedPrice) <= 0)) throw new Error('Le PV retenu TTC doit être supérieur à zéro')
        await reviewRecipeAsDirection(recipe.id, approve, pin, reason, parsedPrice)
        toast.success(approve ? 'Validation Direction et snapshot enregistrés' : 'Fiche renvoyée à corriger')
      }
      setSensitiveAction(null)
      await loadRecipe()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Impossible d’enregistrer l’action Direction'))
    } finally {
      setBusy(false)
    }
  }

  const exportPdf = () => {
    try {
      exportRecipeToPdf(recipe)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const removePhoto = async () => {
    if (!window.confirm('Supprimer la photo de dressage de cette version ?')) return
    try {
      await removeRecipeDressingPhoto(recipe.id, recipe.dressing_photo_path)
      toast.success('Photo de dressage supprimée')
      await loadRecipe()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Impossible de supprimer la photo'))
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Fiche technique</p><h1 className="page-title mt-2">{recipe.name}</h1><p className="mt-2 text-sm text-slate-600">{recipe.code || 'Code attribue a la validation'} - v{recipe.version}</p></div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Link to={`/recipes/${recipe.id}/edit`} className="btn-primary"><Pencil className="mr-2 h-4 w-4" />{recipe.status === 'validee' ? 'Créer une nouvelle version' : 'Modifier'}</Link>}
          {canEdit && recipe.status === 'brouillon' && <button type="button" onClick={submit} disabled={!isReady} className="btn-secondary"><Send className="mr-2 h-4 w-4" />Soumettre pour validation</button>}
          {canChefReview && recipe.status === 'en_attente' && recipe.workflow_status === 'submitted' && <><button type="button" onClick={() => setSensitiveAction('chef_validate')} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" />Valider comme Chef</button><button type="button" onClick={() => setSensitiveAction('chef_return')} className="btn-secondary"><RotateCcw className="mr-2 h-4 w-4" />Renvoyer à corriger</button></>}
          {canValidate && recipe.status === 'en_attente' && recipe.workflow_status === 'chef_validated' && <><button type="button" onClick={() => { setRetainedPrice(String(recipe.theoretical_sale_price_ttc || '')); setSensitiveAction('direction_validate') }} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" />Valider comme Direction</button><button type="button" onClick={() => setSensitiveAction('direction_return')} className="btn-secondary"><RotateCcw className="mr-2 h-4 w-4" />Renvoyer à corriger</button></>}
          {canValidate && recipe.status === 'validee' && <button type="button" onClick={() => setSensitiveAction('archive')} className="btn-secondary"><Archive className="mr-2 h-4 w-4" />Archiver</button>}
          <button type="button" className="btn-secondary" onClick={exportPdf}><FileText className="mr-2 h-4 w-4" />PDF</button>
          <Link to="/recipes/new" className="btn-secondary"><Copy className="mr-2 h-4 w-4" />Dupliquer</Link>
        </div>
      </header>

      {unresolved.length > 0 && <Link to="/recipes/pending-ingredients" className="block rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{unresolved.length} ingredient(s) en attente de resolution. La fiche ne peut pas etre validee.</Link>}

      <section className={`surface border-l-4 p-5 ${isReady ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">{workflowActionLabel}</p>
            <h2 className="mt-2 text-lg font-bold text-slate-950">
              {recipe.status === 'validee' || recipe.direction_validated_at ? 'Version validée par la Direction et verrouillée.' : recipe.workflow_status === 'submitted' ? 'À valider par Chef' : recipe.workflow_status === 'chef_validated' ? 'À valider par Direction' : recipe.workflow_status === 'needs_correction' ? 'À corriger' : isReady ? 'La fiche peut etre soumise a validation.' : 'La fiche ne peut pas encore etre validee.'}
            </h2>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${isReady ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            {readiness.filter((check) => check.ok).length}/{readiness.length} controles OK
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {readiness.map((check) => (
            <div key={check.key} className={`rounded-md border p-3 ${check.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className={`text-sm font-bold ${check.ok ? 'text-emerald-900' : 'text-amber-900'}`}>{check.label}</p>
              <p className={`mt-1 text-sm ${check.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{check.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <Info label="Type" value={`${recipe.type} - ${recipeTypeLabels[recipe.type]}`} />
        <Info label="Matiere" value={mainIngredientLabels[recipe.main_ingredient]} />
        <Info label="Portions" value={String(recipe.portions)} />
        <Info label="Statut" value={recipeStatusLabels[recipe.status]} />
        <Info label="Statut du coût" value={getRecipeCostStatusLabel(recipe.cost_status)} />
        <Info label="Statut métier" value={getRecipeWorkflowLabel(recipe)} />
        <Info label="Verrouillage" value={recipe.status === 'validee' || recipe.direction_validated_at ? 'Version verrouillée — nouvelle version nécessaire pour modifier' : 'Version modifiable selon les droits'} />
        <Info label="Coût matière TTC total actuel" value={economics.totalMaterialCostTtc == null ? 'Non calculable' : `${economics.totalMaterialCostTtc.toLocaleString('fr-FR')} Ar`} />
        <Info label="Coût matière TTC total à la validation" value={recipe.validated_material_cost == null ? 'Non disponible' : `${Number(recipe.validated_material_cost).toLocaleString('fr-FR')} Ar`} />
        <Info label="Coût matière TTC/personne" value={economics.costPerPortion == null ? 'Non calculable' : `${economics.costPerPortion.toLocaleString('fr-FR')} Ar`} />
        <Info label="PV théorique TTC/personne" value={recipe.yield_mode === 'rendement_produit' ? 'Règle métier à définir' : economics.theoreticalSalePriceTtcPerPerson == null ? 'Non calculable' : `${economics.theoreticalSalePriceTtcPerPerson.toLocaleString('fr-FR')} Ar`} />
        <Info label="PV théorique TTC" value={recipe.yield_mode === 'rendement_produit' ? 'Règle métier à définir' : economics.theoreticalSalePriceTtcTotal == null ? 'Non calculable' : `${economics.theoreticalSalePriceTtcTotal.toLocaleString('fr-FR')} Ar total`} />
        <Info label={recipe.yield_mode === 'rendement_produit' ? 'PV retenu TTC / unité de rendement' : 'PV retenu TTC total'} value={recipe.retained_sale_price_ttc == null ? 'Non défini' : `${Number(recipe.retained_sale_price_ttc).toLocaleString('fr-FR')} Ar`} />
        <Info label="Ratio cout" value={`${Number(recipe.cost_ratio).toFixed(1)} %`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="surface p-5"><p className="eyebrow">Procédé / déroulé</p><div className="mt-4 space-y-4">{(recipe.recipe_steps ?? []).length === 0 ? <p className="text-sm text-slate-500">Aucun procédé structuré pour cette recette historique.</p> : [...(recipe.recipe_steps ?? [])].sort((a, b) => a.step_order - b.step_order).map((step) => <div key={step.id ?? step.step_order} className="rounded-md border border-slate-200 p-4"><p className="font-bold">Étape {step.step_order}{step.title ? ` — ${step.title}` : ''}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{step.instructions}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">{step.active_duration_minutes != null && <span>Active : {step.active_duration_minutes} min</span>}{step.passive_duration_minutes != null && <span>Passive : {step.passive_duration_minutes} min</span>}</div>{step.attention_points && <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-900"><strong>Vigilance :</strong> {step.attention_points}</p>}{step.observation && <p className="mt-2 text-sm text-slate-600">{step.observation}</p>}</div>)}</div></div>
        <div className="surface p-5"><div className="flex items-center justify-between gap-3"><p className="eyebrow">Photo de dressage</p>{canEdit && dressingPhotoUrl && <button type="button" onClick={removePhoto} className="text-sm font-semibold text-red-700">Supprimer</button>}</div>{dressingPhotoUrl ? <img src={dressingPhotoUrl} alt={recipe.dressing_photo_alt || `Dressage ${recipe.name}`} className="mt-4 aspect-square w-full rounded-lg object-cover" /> : <div className="mt-4 flex aspect-square items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">Aucune photo</div>}</div>
      </section>

      <section className="surface overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_170px_150px_150px_210px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
          <span>Article / sous-recette</span><span>Quantite utilisee</span><span>Coût TTC figé utilisé</span><span>Coût TTC ligne fiche</span><span>Écart actuel</span><span>Coût TTC unitaire actuel</span>
        </div>
        <div className="divide-y divide-slate-200">
          {recipe.recipe_ingredients?.map((ingredient) => {
            const currentCost = Object.prototype.hasOwnProperty.call(currentCosts, ingredient.article_id) ? currentCosts[ingredient.article_id] : (priceObservations.get(ingredient.article_id) == null ? provisionalPrices.get(ingredient.article_id)?.normalized_amount_ttc ?? null : null)
            const priceObservation = priceObservations.get(ingredient.article_id)
            // A snapshot timestamp alone is not proof of a calculable cost: a draft
            // without a NORMAL price can have been persisted with the 0 sentinel.
            // A numeric normalized snapshot, including a real 0, is the evidence.
            const hasFrozenCost = ingredient.normalized_price_snapshot != null
            const historicalCost = hasFrozenCost ? Number(ingredient.normalized_price_snapshot ?? ingredient.unit_price) : null
            const historicalLineCost = hasFrozenCost ? Number(ingredient.total_cost) : null
            const gap = currentCost != null && historicalCost != null && historicalCost > 0 ? ((currentCost - historicalCost) / historicalCost) * 100 : 0
            const obsolete = Math.abs(gap) >= 15
            const currentPriceLabel = currentCost == null
              ? priceObservation?.normalized_unit_price == null && priceObservation
                ? 'Prix NORMAL non normalisable'
                : 'Prix NORMAL manquant'
              : `${currentCost.toLocaleString('fr-FR')} Ar`

            return (
              <div key={ingredient.id} className="grid grid-cols-[1fr_160px_170px_150px_150px_210px] gap-4 px-5 py-3 text-sm">
                <span className="font-semibold">{ingredient.articles?.name || ingredient.imported_name}</span>
                <span>
                  {Number(ingredient.quantity_display ?? ingredient.quantity).toLocaleString('fr-FR')} {ingredient.display_unit?.abbreviation || ingredient.units?.abbreviation || ingredient.unit_name}
                  {' '}
                  ({Number(ingredient.quantity_stored ?? ingredient.quantity).toLocaleString('fr-FR')} {ingredient.stored_unit?.abbreviation || ingredient.articles?.units?.abbreviation || ''})
                </span>
                <span>{historicalCost == null ? 'Non calculable' : `${historicalCost.toLocaleString('fr-FR')} Ar`}</span>
                <span>{historicalLineCost == null ? 'Non calculable' : `${historicalLineCost.toLocaleString('fr-FR')} Ar`}</span>
                <span className={obsolete ? 'font-bold text-amber-700' : 'text-slate-600'}>
                  {currentCost != null && historicalCost != null && historicalCost > 0 ? `${gap > 0 ? '+' : ''}${gap.toFixed(1)} %` : '-'}
                </span>
                <span>
                  {currentPriceLabel}
                  {priceObservation == null && provisionalPrices.has(ingredient.article_id) && <span className="mt-1 block rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">Prix provisoire de travail — non qualifié Achats.</span>}
                  {priceObservation && priceObservation.normalized_unit_price == null && <span className="mt-1 block rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">Prix NORMAL existant, coût non normalisable ({Number(priceObservation.actual_unit_price_source).toLocaleString('fr-FR')} source · unité {priceObservation.source_unit_id ?? 'inconnue'} · {priceObservation.source_type} · {priceObservation.effective_date ? new Date(priceObservation.effective_date).toLocaleDateString('fr-FR') : 'date inconnue'}).</span>}
                  {obsolete && <span className="mt-1 block rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">Cout potentiellement obsolete ({gap.toFixed(1)}%)</span>}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <p className="text-xs text-slate-500">Les coûts opérationnels FT sont TTC. Les informations HT et TVA issues d’Achats restent des informations fiscales de référence.</p>

      {recipe.status === 'validee' && (
        <section className="surface p-5">
          <p className="eyebrow">Validation Direction</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            Fiche validee par {recipe.validator?.full_name ?? 'la Direction'} le {recipe.validated_at ? new Date(recipe.validated_at).toLocaleDateString('fr-FR') : '-'}.
          </p>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Info label="Validation Chef" value={recipe.chef_validated_at ? `${recipe.chef_validator?.full_name ?? 'Chef cuisine'} · ${new Date(recipe.chef_validated_at).toLocaleString('fr-FR')}` : 'En attente'} />
        <Info label="Validation Direction" value={recipe.direction_validated_at ? `${recipe.direction_validator?.full_name ?? 'Direction'} · ${new Date(recipe.direction_validated_at).toLocaleString('fr-FR')}` : 'En attente'} />
      </section>

      {(recipe.recipe_validation_history ?? []).length > 0 && <section className="surface p-5"><p className="eyebrow">Historique de validation</p><div className="mt-4 space-y-2">{[...(recipe.recipe_validation_history ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((entry) => <div key={entry.id} className="rounded-md border border-slate-200 p-3 text-sm"><strong>{entry.action}</strong> · {entry.actor?.full_name ?? 'Système'} · {new Date(entry.created_at).toLocaleString('fr-FR')}{entry.comment && <p className="mt-1 text-slate-600">{entry.comment}</p>}</div>)}</div></section>}

      {versions.length > 0 && (
        <section className="surface p-5">
          <p className="eyebrow">Historique des versions</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {versions.map((version) => (
              <Link
                key={version.id}
                to={`/recipes/${version.id}`}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${version.id === recipe.id ? 'bg-[#1E3A8A] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                v{version.version} - {recipeStatusLabels[version.status]}
              </Link>
            ))}
          </div>
        </section>
      )}

      <SensitiveActionModal open={sensitiveAction !== null} title={sensitiveAction === 'chef_validate' ? 'Validation Chef' : sensitiveAction === 'chef_return' ? 'Renvoyer la fiche à corriger' : sensitiveAction === 'archive' ? 'Archiver la fiche technique' : sensitiveAction === 'direction_return' ? 'Renvoyer la fiche à corriger' : 'Validation finale Direction'} description="Le serveur vérifie le rôle, la permission et le PIN personnel dans la même transaction." permissionLabel={sensitiveAction === 'chef_validate' || sensitiveAction === 'chef_return' ? 'recipes.chef_review' : 'recipes.final_validate'} pinDefined={pinDefined} requireReason={sensitiveAction === 'chef_return' || sensitiveAction === 'direction_return' || sensitiveAction === 'archive'} busy={busy} onCancel={() => setSensitiveAction(null)} onConfirm={confirmSensitiveAction}>
        {sensitiveAction === 'direction_validate' && <label className="mt-4 block"><span className="field-label">{recipe.yield_mode === 'rendement_produit' ? 'PV retenu TTC / unité de rendement' : 'PV retenu TTC total'}</span><input type="number" min="0.01" step="0.01" value={retainedPrice} onChange={(event) => setRetainedPrice(event.target.value)} className="input mt-2" /><span className="mt-1 block text-xs text-slate-500">PV théorique TTC : {recipe.yield_mode === 'portions' ? `${Number(recipe.theoretical_sale_price_ttc ?? 0).toLocaleString('fr-FR')} Ar total` : 'non défini pour rendement produit'}.</span></label>}
      </SensitiveActionModal>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
