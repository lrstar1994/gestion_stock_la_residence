import { Upload } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { importRecipesFromRows } from '../../api/modules/recipes.api'
import { useAuth } from '../../hooks/useAuth'
import type { ImportReport } from '../../lib/recipes'

export function RecipeImportPage() {
  const { profile } = useAuth()
  const [report, setReport] = useState<ImportReport | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File) => {
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet) as never[]
      const nextReport = await importRecipesFromRows(rows, profile?.id)
      setReport(nextReport)
      toast.success('Import Excel termine avec succes')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez reessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Import</p><h1 className="page-title mt-2">Importer des fiches Excel</h1></header>
      <section className="surface p-6">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center hover:bg-slate-100">
          <Upload className="h-10 w-10 text-[#1E3A8A]" />
          <span className="mt-4 font-semibold">Selectionner un fichier Excel</span>
          <span className="mt-1 text-sm text-slate-500">Colonnes : Nom, Type, Matiere principale, Portions, Ingredients</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
        </label>
        {loading && <p className="mt-4 text-sm text-slate-600">Analyse en cours...</p>}
      </section>
      {report && (
        <section className="surface grid gap-4 p-5 sm:grid-cols-5">
          <Metric label="Fiches importees" value={report.recipesImported} />
          <Metric label="Fiches en erreur" value={report.recipesFailed} />
          <Metric label="Reconnus" value={report.recognized} />
          <Metric label="A rapprocher" value={report.ambiguous} />
          <Metric label="A creer" value={report.unknown} />
          <a href="/recipes/pending-ingredients" className="btn-primary sm:col-span-5">Voir les ingredients en attente ({report.pending})</a>
        </section>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{value}</p></div>
}
