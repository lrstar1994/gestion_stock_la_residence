import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import { generatePurchaseNeeds, getEvent, listPurchaseNeeds, updatePurchaseNeedStatus } from '../../api/modules/events.api'
import { useAuth } from '../../hooks/useAuth'
import { exportPurchaseNeedsToCsv, exportPurchaseNeedsToExcel } from '../../lib/eventExports'
import { purchaseNeedStatusLabels, purchaseNeedStatuses } from '../../lib/events'
import type { Event, PurchaseNeed, PurchaseNeedStatus } from '../../lib/events'

export function PurchaseNeedsPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [needs, setNeeds] = useState<PurchaseNeed[]>([])

  const load = useCallback(async () => {
    if (!id) return
    setEvent(await getEvent(id))
    setNeeds(await listPurchaseNeeds(id))
  }, [id])

  useEffect(() => {
    load().catch(() => toast.error('Impossible de charger les besoins.'))
  }, [load])

  const generate = async () => {
    if (!id) return
    try {
      setNeeds(await generatePurchaseNeeds(id, profile?.id))
      toast.success("Besoins d'achat generes")
    } catch {
      toast.error('Une erreur est survenue. Veuillez reessayer.')
    }
  }

  const changeStatus = async (needId: string, status: PurchaseNeedStatus) => {
    await updatePurchaseNeedStatus(needId, status)
    await load()
  }

  const total = needs.reduce((sum, need) => sum + Number(need.estimated_cost ?? 0), 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Besoins bruts</p><h1 className="page-title mt-2">Besoins d'achat</h1><p className="mt-2 text-sm text-slate-600">{event?.name}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={generate} className="btn-primary"><RefreshCw className="mr-2 h-4 w-4" /> Generer</button>
          <button type="button" onClick={() => event && exportPurchaseNeedsToCsv(needs, event.name)} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> CSV</button>
          <button type="button" onClick={() => event && exportPurchaseNeedsToExcel(needs, event.name)} className="btn-secondary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</button>
          <Link to={`/events/${id}`} className="btn-secondary">Retour</Link>
        </div>
      </header>

      <section className="surface p-4 text-sm font-semibold text-amber-800">Le stock disponible n'est pas deduit. Les besoins sont bruts.</section>
      <section className="grid gap-4 md:grid-cols-2"><Info label="Articles" value={String(needs.length)} /><Info label="Total estime" value={`${total.toLocaleString('fr-FR')} Ar`} /></section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_150px_130px_110px_130px_150px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Famille</span><span>Quantite</span><span>Unite</span><span>Cout</span><span>Statut</span>
        </div>
        <div className="divide-y divide-slate-200">
          {needs.map((need) => (
            <div key={need.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_150px_130px_110px_130px_150px] xl:items-center">
              <span className="font-semibold">{need.articles?.name}</span>
              <span className="text-sm">{need.articles?.families?.name || '-'}</span>
              <span className="text-sm">{Number(need.quantity_needed).toLocaleString('fr-FR')}</span>
              <span className="text-sm">{need.units?.abbreviation}</span>
              <span className="text-sm">{Number(need.estimated_cost).toLocaleString('fr-FR')} Ar</span>
              <select value={need.status} onChange={(event) => changeStatus(need.id, event.target.value as PurchaseNeedStatus)} className="input">
                {purchaseNeedStatuses.map((status) => <option key={status} value={status}>{purchaseNeedStatusLabels[status]}</option>)}
              </select>
            </div>
          ))}
          {needs.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun besoin genere.</p>}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
