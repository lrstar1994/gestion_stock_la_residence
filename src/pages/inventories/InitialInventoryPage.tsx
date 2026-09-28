import { FileSpreadsheet } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { listInitialInventoryStatus } from '../../api/modules/inventories.api'
import { exportInitialInventoryToExcel } from '../../lib/inventoryExports'
import { initialInventoryStatusLabels } from '../../lib/inventories'
import type { InitialInventoryRow } from '../../lib/inventories'

export function InitialInventoryPage() {
  const [rows, setRows] = useState<InitialInventoryRow[]>([])

  useEffect(() => {
    listInitialInventoryStatus().then(setRows).catch(() => toast.error("Impossible de charger l'inventaire initial."))
  }, [])

  const missing = rows.filter((row) => row.status !== 'stock_initial_confirme').length

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Inventaire initial</p><h1 className="page-title mt-2">Suivi du stock initial</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Cette page liste les articles/localisations dont le stock initial doit être saisi, complété, soumis ou validé.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportInitialInventoryToExcel(rows)} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>
          <Link to="/inventories/new?type=initial" className="btn-primary">Nouvel inventaire initial</Link>
          <Link to="/inventories" className="btn-secondary">Retour</Link>
        </div>
      </header>

      {missing > 0 && (
        <section className="surface border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Stock initial non confirme. Inventaire initial a realiser dans un delai maximum de 2 jours.
        </section>
      )}

      <section className="surface p-5">
        <h2 className="font-black text-slate-950">Parcours du stock initial</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {['Non inventorie', 'Inventaire saisi', 'Soumis a validation', 'Valide Direction', 'Stock initial confirme'].map((step, index) => (
            <div key={step} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase text-slate-500">Etape {index + 1}</p><p className="mt-1 text-sm font-bold">{step}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600">La validation Direction applique les corrections tracees prevues par le flux d'inventaire ; le journal des mouvements affiche ensuite les mouvements crees.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Articles/localisations" value={String(rows.length)} />
        <Metric label="Non confirmes" value={String(missing)} />
        <Metric label="Confirmes" value={String(rows.length - missing)} />
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_1fr_100px_200px_150px_170px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Localisation</span><span>Unite</span><span>Statut</span><span>Dernier inventaire</span><span>Action attendue</span>
        </div>
        <div className="divide-y divide-slate-200">
          {rows.map((row) => (
            <div key={`${row.article_id}-${row.location_id}`} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_1fr_100px_200px_150px_170px] xl:items-center">
              <span className="font-semibold">{row.article_name}</span>
              <span>{row.location_name}</span>
              <span>{row.unit_name}</span>
              <span className={row.status === 'stock_initial_confirme' ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>{initialInventoryStatusLabels[row.status]}</span>
              <span>{row.last_inventory_date ? new Date(row.last_inventory_date).toLocaleDateString('fr-FR') : '-'}</span>
              <span>
                {row.status === 'non_inventorie' && <Link to={`/inventories/new?type=initial&location=${row.location_id}`} className="btn-secondary">Saisir l'inventaire</Link>}
                {row.status === 'stock_initial_non_confirme' && row.inventory_id && <Link to={`/inventories/${row.inventory_id}/edit`} className="btn-secondary">Completer le brouillon</Link>}
                {row.status === 'a_controler' && row.inventory_id && <Link to={`/inventories/${row.inventory_id}`} className="btn-secondary">Suivre la validation</Link>}
                {row.status === 'stock_initial_confirme' && row.inventory_id && <Link to={`/inventories/${row.inventory_id}`} className="text-sm font-bold text-[#1E3A8A]">Voir le dossier</Link>}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
