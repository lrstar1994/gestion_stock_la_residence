import { Download, FilePlus, FileSpreadsheet, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listRecipes } from '../../api/modules/recipes.api'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../lib/errors'
import { exportRecipesToCsv, exportRecipesToExcel } from '../../lib/recipeExports'
import { canEditRecipes, mainIngredientLabels, recipeMainIngredients, recipeStatusLabels, recipeStatuses, recipeTypeLabels, recipeTypes } from '../../lib/recipes'
import type { Recipe, RecipeMainIngredient, RecipeStatus, RecipeType } from '../../lib/recipes'

export function RecipesList() {
  const { profile } = useAuth()
  const canEdit = canEditRecipes(profile?.role)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState<RecipeType | 'all'>('all')
  const [mainIngredient, setMainIngredient] = useState<RecipeMainIngredient | 'all'>('all')
  const [status, setStatus] = useState<RecipeStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filters = useMemo(() => ({ search, type, mainIngredient, status, page, pageSize }), [mainIngredient, page, search, status, type])

  useEffect(() => {
    listRecipes(filters)
      .then((result) => {
        setRecipes(result.recipes)
        setTotal(result.total)
      })
      .catch(() => toast.error('Une erreur est survenue. Veuillez reessayer.'))
  }, [filters])

  const resetPage = (callback: () => void) => {
    setPage(1)
    callback()
  }

  const exportLibrary = async (format: 'csv' | 'excel') => {
    try {
      const result = await listRecipes({ search, type, mainIngredient, status, page: 1, pageSize: 10000 })
      if (result.recipes.length === 0) {
        toast.error('Aucune fiche a exporter.')
        return
      }

      if (format === 'csv') {
        exportRecipesToCsv(result.recipes)
      } else {
        exportRecipesToExcel(result.recipes)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Bibliotheque</p>
          <h1 className="page-title mt-2">Fiches techniques</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportLibrary('csv')} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>
          <button type="button" onClick={() => exportLibrary('excel')} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>
          {canEdit && (
            <>
              <Link to="/recipes/import" className="btn-secondary"><Upload className="mr-2 h-4 w-4" /> Import Excel</Link>
              <Link to="/recipes/new" className="btn-primary"><FilePlus className="mr-2 h-4 w-4" /> Nouvelle fiche</Link>
            </>
          )}
        </div>
      </header>

      <section className="surface grid gap-3 p-4 lg:grid-cols-[1fr_180px_190px_170px]">
        <input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} className="input" placeholder="Rechercher par nom ou code" />
        <select value={type} onChange={(event) => resetPage(() => setType(event.target.value as RecipeType | 'all'))} className="input">
          <option value="all">Tous les types</option>
          {recipeTypes.map((item) => <option key={item} value={item}>{item} - {recipeTypeLabels[item]}</option>)}
        </select>
        <select value={mainIngredient} onChange={(event) => resetPage(() => setMainIngredient(event.target.value as RecipeMainIngredient | 'all'))} className="input">
          <option value="all">Toutes les matieres</option>
          {recipeMainIngredients.map((item) => <option key={item} value={item}>{item} - {mainIngredientLabels[item]}</option>)}
        </select>
        <select value={status} onChange={(event) => resetPage(() => setStatus(event.target.value as RecipeStatus | 'all'))} className="input">
          <option value="all">Tous les statuts</option>
          {recipeStatuses.map((item) => <option key={item} value={item}>{recipeStatusLabels[item]}</option>)}
        </select>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[140px_1fr_130px_150px_130px_130px_120px_100px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Code</span><span>Nom</span><span>Type</span><span>Matiere</span><span>Cout</span><span>Prix vente</span><span>Statut</span><span>Version</span>
        </div>
        <div className="divide-y divide-slate-200">
          {recipes.map((recipe) => (
            <Link key={recipe.id} to={`/recipes/${recipe.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[140px_1fr_130px_150px_130px_130px_120px_100px] xl:items-center">
              <span className="font-semibold text-[#1E3A8A]">{recipe.code || '-'}</span>
              <span className="font-semibold text-slate-950">{recipe.name}</span>
              <span className="text-sm">{recipe.type}</span>
              <span className="text-sm">{mainIngredientLabels[recipe.main_ingredient]}</span>
              <span className="text-sm">{Number(recipe.total_cost).toLocaleString('fr-FR')} Ar</span>
              <span className="text-sm">{Number(recipe.final_price).toLocaleString('fr-FR')} Ar</span>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1E3A8A]">{recipeStatusLabels[recipe.status]}</span>
              <span className="text-sm">v{recipe.version}</span>
            </Link>
          ))}
          {recipes.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune fiche trouvee.</p>}
        </div>
      </section>

      <div className="flex justify-between gap-3">
        <p className="text-sm text-slate-600">Page {page} sur {totalPages}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Precedent</button>
          <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Suivant</button>
        </div>
      </div>
    </div>
  )
}
