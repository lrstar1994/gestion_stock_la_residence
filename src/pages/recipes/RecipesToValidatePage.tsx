import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { listRecipes } from '../../api/modules/recipes.api'
import { useAuth } from '../../hooks/useAuth'
import { canValidateRecipes, getRecipeCostStatusLabel, getRecipeWorkflowLabel, recipeStatusLabels } from '../../lib/recipes'
import type { Recipe } from '../../lib/recipes'

type ValidationFilter = 'all' | 'chef' | 'direction' | 'correction' | 'recent'

export function RecipesToValidatePage() {
  const { profile } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [filter, setFilter] = useState<ValidationFilter>('all')
  const [error, setError] = useState('')

  useEffect(() => {
    listRecipes({ status: 'all', pageSize: 500 })
      .then((result) => setRecipes(result.recipes.filter((recipe) => recipe.status === 'en_attente' || recipe.workflow_status === 'needs_correction' || recipe.status === 'validee')))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Impossible de charger les fiches à valider.'))
  }, [])

  const filtered = useMemo(() => recipes.filter((recipe) => {
    if (filter === 'chef') return recipe.status === 'en_attente' && recipe.workflow_status === 'submitted'
    if (filter === 'direction') return recipe.status === 'en_attente' && recipe.workflow_status === 'chef_validated'
    if (filter === 'correction') return recipe.workflow_status === 'needs_correction'
    if (filter === 'recent') return recipe.status === 'validee'
    return true
  }), [filter, recipes])

  const actionLabel = (recipe: Recipe) => {
    if (recipe.workflow_status === 'submitted') return 'À valider par Chef'
    if (recipe.workflow_status === 'chef_validated') return canValidateRecipes(profile?.role) ? 'À valider par Direction' : 'Attente Direction'
    if (recipe.workflow_status === 'needs_correction') return 'À corriger'
    return 'Consulter'
  }

  return <div className="space-y-6">
    <header><p className="eyebrow">Fiches techniques</p><h1 className="page-title mt-2">Fiches à valider</h1><p className="mt-2 text-sm text-slate-600">Circuit distinct Chef cuisine puis Direction.</p></header>
    <section className="surface flex flex-wrap gap-2 p-4">
      {([['all', 'Toutes'], ['chef', 'Attente Chef'], ['direction', 'Attente Direction'], ['correction', 'À corriger'], ['recent', 'Validées récemment']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? 'btn-primary' : 'btn-secondary'}>{label}</button>)}
    </section>
    {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {!error && filtered.length === 0 && <div className="surface p-6 text-sm text-slate-600">Aucune fiche dans ce filtre.</div>}
    <section className="surface overflow-hidden">
      <div className="hidden grid-cols-[120px_1fr_80px_160px_150px_150px_140px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-bold uppercase text-slate-500 lg:grid"><span>Code</span><span>Nom</span><span>Version</span><span>Soumission</span><span>Chef</span><span>Direction</span><span>Action</span></div>
      <div className="divide-y divide-slate-200">{filtered.map((recipe) => <Link key={recipe.id} to={`/recipes/${recipe.id}`} className="grid gap-2 px-5 py-4 hover:bg-slate-50 lg:grid-cols-[120px_1fr_80px_160px_150px_150px_140px] lg:items-center"><span className="font-semibold text-blue-800">{recipe.code || '—'}</span><span><strong>{recipe.name}</strong><span className="mt-1 block text-xs font-semibold text-slate-700">{getRecipeWorkflowLabel(recipe)}</span><span className="mt-1 block text-xs text-slate-500">{recipeStatusLabels[recipe.status]} · Coût {getRecipeCostStatusLabel(recipe.cost_status)}</span></span><span>v{recipe.version}</span><span className="text-sm">{recipe.submitted_at ? new Date(recipe.submitted_at).toLocaleString('fr-FR') : '—'}</span><span className="text-sm">{recipe.chef_validated_at ? 'Validée' : 'En attente'}</span><span className="text-sm">{recipe.direction_validated_at ? 'Validée' : 'En attente'}</span><span className="rounded-full bg-blue-50 px-3 py-1 text-center text-xs font-bold text-blue-800">{actionLabel(recipe)}</span></Link>)}</div>
    </section>
  </div>
}
