import { AlertTriangle, Download, Upload } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { importRecipesFromWorkbook } from '../../api/modules/recipes.api'
import { buildOfficialRecipeImportWorkbook, parseOfficialRecipeImportWorkbook } from '../../lib/recipeImport'
import type { ImportReport } from '../../lib/recipes'

export function RecipeImportPage() {
  const [report, setReport] = useState<ImportReport | null>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File) => {
    setLoading(true)
    setReport(null)
    try {
      const workbook = XLSX.read(await file.arrayBuffer())
      const parsed = parseOfficialRecipeImportWorkbook(workbook)
      const nextReport = await importRecipesFromWorkbook(parsed)
      setReport(nextReport)
      if (nextReport.recipesFailed > 0) toast.error(`Import terminé avec ${nextReport.recipesFailed} fiche(s) non créée(s)`)
      else toast.success('Import terminé : toutes les fiches ont été créées en brouillon')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Le fichier Excel ne peut pas être importé')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => XLSX.writeFile(buildOfficialRecipeImportWorkbook(), 'MODELE_IMPORT_FICHES_TECHNIQUES.xlsx')

  return (
    <div className="space-y-6">
      <header><p className="eyebrow">Import</p><h1 className="page-title mt-2">Importer des fiches Excel</h1></header>
      <section className="surface p-6">
        <button type="button" onClick={downloadTemplate} className="btn-secondary mb-4"><Download className="mr-2 h-4 w-4" />Télécharger le modèle Excel</button>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center hover:bg-slate-100">
          <Upload className="h-10 w-10 text-[#1E3A8A]" />
          <span className="mt-4 font-semibold">Sélectionner le modèle Excel complété</span>
          <span className="mt-1 text-sm text-slate-500">Les feuilles FICHES, INGRÉDIENTS, DÉROULÉ et AIDE sont obligatoires. L’import crée uniquement des brouillons.</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
        </label>
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Prix Excel indicatif uniquement.</strong> Il n’alimente ni le prix NORMAL Achats, ni le coût officiel de la fiche, ni le Stock.
        </div>
        {loading && <p className="mt-4 text-sm text-slate-600">Validation et import fiche par fiche en cours...</p>}
      </section>
      {report && (
        <section className="surface space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Fiches créées en brouillon" value={report.recipesImported} />
            <Metric label="Fiches non créées" value={report.recipesFailed} />
            <Metric label="Doublons possibles" value={report.duplicates} />
            <Metric label="Ingrédients reconnus" value={report.recognized} />
            <Metric label="À rapprocher" value={report.pending} />
            <Metric label="Unités inconnues" value={report.unknownUnits} />
            <Metric label="Conversions manquantes" value={report.missingConversions} />
            <Metric label="Formes à contrôler" value={report.trimFormsToReview} />
          </div>
          {report.errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Anomalies détectées</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{report.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
          )}
          <a href="/recipes/pending-ingredients" className="btn-primary">Voir les ingrédients à rapprocher ({report.pending})</a>
        </section>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{value}</p></div>
}
