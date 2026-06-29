import { Archive, ArchiveRestore, CheckCircle, Copy, FileText, Pencil, Send } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getRecipe, listRecipeVersions, setRecipeArchived, submitRecipeForValidation, validateRecipe } from '../../api/modules/recipes.api'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../lib/errors'
import { exportRecipeToPdf } from '../../lib/recipeExports'
import { canEditRecipes, canValidateRecipes, getRecipeReadiness, isRecipeReadyForValidation, mainIngredientLabels, recipeStatusLabels, recipeTypeLabels } from '../../lib/recipes'
import type { Recipe } from '../../lib/recipes'

export function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [versions, setVersions] = useState<Recipe[]>([])
  const canEdit = canEditRecipes(profile?.role) && recipe?.status !== 'archived'
  const canValidate = canValidateRecipes(profile?.role)

  const loadRecipe = useCallback(async () => {
    if (!id) return
    try {
      const loadedRecipe = await getRecipe(id)
      setRecipe(loadedRecipe)
      setVersions(await listRecipeVersions(loadedRecipe))
    } catch (error) {
      toast.error(getErrorMessage(error, 'Fiche technique introuvable'))
      navigate('/recipes')
    }
  }, [id, navigate])

  useEffect(() => {
    loadRecipe()
  }, [loadRecipe])

  if (!recipe) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const unresolved = recipe.pending_ingredients?.filter((item) => item.status === 'pending' || item.status === 'ambiguous') ?? []
  const readiness = getRecipeReadiness(recipe)
  const isReady = isRecipeReadyForValidation(recipe)

  const submit = async () => {
    try {
      await submitRecipeForValidation(recipe.id)
      toast.success('Fiche technique soumise a validation')
      await loadRecipe()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const validate = async () => {
    try {
      await validateRecipe(recipe.id, profile?.id)
      toast.success('Fiche technique validee avec succes')
      await loadRecipe()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const archive = async () => {
    const next = recipe.status !== 'archived'
    try {
      await setRecipeArchived(recipe.id, next)
      toast.success(next ? 'Fiche technique archivee' : 'Fiche technique desarchivee')
      await loadRecipe()
    } catch {
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const exportPdf = () => {
    try {
      exportRecipeToPdf(recipe)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Fiche technique</p><h1 className="page-title mt-2">{recipe.name}</h1><p className="mt-2 text-sm text-slate-600">{recipe.code || 'Code attribue a la validation'} - v{recipe.version}</p></div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Link to={`/recipes/${recipe.id}/edit`} className="btn-primary"><Pencil className="mr-2 h-4 w-4" />{recipe.status === 'validee' ? 'Creer une nouvelle version' : 'Modifier'}</Link>}
          {canEdit && recipe.status !== 'validee' && <button type="button" onClick={submit} disabled={!isReady} className="btn-secondary"><Send className="mr-2 h-4 w-4" />Soumettre</button>}
          {canValidate && recipe.status === 'en_attente' && <button type="button" onClick={validate} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" />Valider</button>}
          {canValidate && <button type="button" onClick={archive} className="btn-secondary">{recipe.status === 'archived' ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}{recipe.status === 'archived' ? 'Desarchiver' : 'Archiver'}</button>}
          <button type="button" className="btn-secondary" onClick={exportPdf}><FileText className="mr-2 h-4 w-4" />PDF</button>
          <Link to="/recipes/new" className="btn-secondary"><Copy className="mr-2 h-4 w-4" />Dupliquer</Link>
        </div>
      </header>

      {unresolved.length > 0 && <Link to="/recipes/pending-ingredients" className="block rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{unresolved.length} ingredient(s) en attente de resolution. La fiche ne peut pas etre validee.</Link>}

      <section className={`surface border-l-4 p-5 ${isReady ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">{isReady ? 'Prete a soumettre' : 'Actions requises'}</p>
            <h2 className="mt-2 text-lg font-bold text-slate-950">
              {isReady ? 'La fiche peut etre soumise a validation.' : 'La fiche ne peut pas encore etre validee.'}
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
        <Info label="Cout total HT" value={`${Number(recipe.total_cost).toLocaleString('fr-FR')} Ar`} />
        <Info label="Cout / portion" value={`${Number(recipe.cost_per_portion).toLocaleString('fr-FR')} Ar`} />
        <Info label="Prix final HT" value={`${Number(recipe.final_price).toLocaleString('fr-FR')} Ar`} />
        <Info label="Ratio cout" value={`${Number(recipe.cost_ratio).toFixed(1)} %`} />
      </section>

      <section className="surface overflow-hidden">
        <div className="grid grid-cols-[1fr_150px_150px_150px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
          <span>Article</span><span>Quantite</span><span>Prix unitaire</span><span>Cout</span>
        </div>
        <div className="divide-y divide-slate-200">
          {recipe.recipe_ingredients?.map((ingredient) => (
            <div key={ingredient.id} className="grid grid-cols-[1fr_150px_150px_150px] gap-4 px-5 py-3 text-sm">
              <span className="font-semibold">{ingredient.articles?.name || ingredient.imported_name}</span>
              <span>
                {Number(ingredient.quantity_display ?? ingredient.quantity).toLocaleString('fr-FR')} {ingredient.display_unit?.abbreviation || ingredient.units?.abbreviation || ingredient.unit_name}
                {' '}
                ({Number(ingredient.quantity_stored ?? ingredient.quantity).toLocaleString('fr-FR')} {ingredient.stored_unit?.abbreviation || ingredient.articles?.units?.abbreviation || ''})
              </span>
              <span>{Number(ingredient.unit_price).toLocaleString('fr-FR')} Ar</span>
              <span>{Number(ingredient.total_cost).toLocaleString('fr-FR')} Ar</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-500">Tous les prix indiques sont hors TVA.</p>

      {recipe.status === 'validee' && (
        <section className="surface p-5">
          <p className="eyebrow">Validation Direction</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            Fiche validee par {recipe.validator?.full_name ?? 'la Direction'} le {recipe.validated_at ? new Date(recipe.validated_at).toLocaleDateString('fr-FR') : '-'}.
          </p>
        </section>
      )}

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
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
