import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'
import { getStockOut, validateStockOut } from '../../api/modules/stockOuts.api'
import { useAuth } from '../../hooks/useAuth'
import {
  canValidateStockOuts,
  consumptionTypeLabels,
  lossTypeLabels,
  stockOutDestinationLabels,
} from '../../lib/stockOuts'
import type { StockOut } from '../../lib/stockOuts'
import { priceSourceLabels } from '../../lib/stock'

export function StockOutDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [stockOut, setStockOut] = useState<StockOut | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      setStockOut(await getStockOut(id))
    } catch {
      toast.error('Sortie de stock introuvable.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const validate = async () => {
    if (!id || !profile?.id) return
    try {
      await validateStockOut(id, profile.id)
      toast.success('Sortie de stock enregistree avec succes')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Une erreur est survenue')
    }
  }

  if (loading) return <p className="text-sm text-slate-600">Chargement...</p>
  if (!stockOut) return <p className="text-sm text-slate-600">Sortie de stock introuvable.</p>

  const movement = stockOut.stock_movement
  const returnMovement = stockOut.return_movement

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Sortie de stock</p>
          <h1 className="page-title mt-2">{stockOut.reference}</h1>
          <p className="mt-2 text-sm text-slate-600">{stockOut.articles?.name} · {stockOut.locations?.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/stock/stock-out" className="btn-secondary"><ArrowLeft className="mr-2 h-4 w-4" /> Retour</Link>
          {stockOut.status === 'en_attente' && canValidateStockOuts(profile?.role) && (
            <button type="button" onClick={validate} className="btn-primary"><ShieldCheck className="mr-2 h-4 w-4" /> Valider</button>
          )}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <InfoCard label="Quantite reelle" value={`${Number(stockOut.quantity).toLocaleString('fr-FR')} ${stockOut.units?.abbreviation ?? ''}`} />
        <InfoCard label="Quantite theorique" value={`${Number(stockOut.theoretical_quantity ?? 0).toLocaleString('fr-FR')} ${stockOut.units?.abbreviation ?? ''}`} />
        <InfoCard label="Ecart" value={Number(stockOut.difference ?? 0).toLocaleString('fr-FR')} tone={Number(stockOut.difference ?? 0) > 0 ? 'red' : Number(stockOut.difference ?? 0) < 0 ? 'green' : 'blue'} />
        <InfoCard label="Cout mouvement" value={`${Number(movement?.total_cost ?? 0).toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface grid gap-5 p-5 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Informations</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <Line label="Date" value={new Date(stockOut.out_date).toLocaleDateString('fr-FR')} />
            <Line label="Destination" value={stockOutDestinationLabels[stockOut.destination]} />
            <Line label="Type consommation" value={consumptionTypeLabels[stockOut.consumption_type ?? 'normale']} />
            <Line label="Motif" value={stockOut.reason} />
            <Line label="Commentaire" value={stockOut.comment || '-'} />
            <Line label="Utilisateur" value={stockOut.creator?.full_name || '-'} />
            <Line label="Validateur" value={stockOut.validator?.full_name || '-'} />
            <Line label="Statut" value={stockOut.status === 'en_attente' ? 'En attente' : stockOut.status} />
          </dl>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">Traçabilité stock</h2>
          <div className="mt-4 space-y-3 text-sm">
            <TraceCard
              title="Mouvement de sortie"
              reference={movement?.movement_reference}
              cost={movement?.total_cost}
              unitCost={movement?.unit_cost}
              priceSource={movement?.price_source}
            />
            {stockOut.is_return && (
              <TraceCard
                title="Mouvement de retour"
                reference={returnMovement?.movement_reference}
                cost={returnMovement?.total_cost}
                unitCost={returnMovement?.unit_cost}
                priceSource={returnMovement?.price_source}
              />
            )}
          </div>
        </div>
      </section>

      {(stockOut.is_loss || stockOut.is_additional || stockOut.is_return) && (
        <section className="surface p-5">
          <h2 className="text-lg font-bold text-slate-900">Rajouts, retours et pertes</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoCard label="Rajout" value={stockOut.is_additional ? 'Oui' : 'Non'} />
            <InfoCard label="Retour" value={stockOut.is_return ? `${Number(stockOut.return_quantity ?? 0).toLocaleString('fr-FR')} ${stockOut.units?.abbreviation ?? ''}` : 'Non'} />
            <InfoCard label="Perte / casse" value={stockOut.is_loss ? lossTypeLabels[stockOut.loss_type ?? 'autre'] : 'Non'} tone={stockOut.is_loss ? 'red' : 'blue'} />
          </div>
          {stockOut.loss_comment && <p className="mt-4 rounded-md bg-orange-50 p-3 text-sm font-semibold text-orange-800">{stockOut.loss_comment}</p>}
        </section>
      )}
    </div>
  )
}

function InfoCard({ label, value, tone = 'blue' }: { label: string; value: string; tone?: 'blue' | 'red' | 'green' }) {
  const colors = {
    blue: 'text-[#1E3A8A]',
    red: 'text-red-600',
    green: 'text-emerald-600',
  }
  return (
    <div className="surface p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-black ${colors[tone]}`}>{value}</p>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-900">{value}</dd>
    </div>
  )
}

function TraceCard({ title, reference, cost, unitCost, priceSource }: { title: string; reference?: string; cost?: number | null; unitCost?: number | null; priceSource?: string | null }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 font-bold text-slate-900"><FileText className="h-4 w-4 text-[#1E3A8A]" /> {title}</div>
      <p className="mt-2 text-sm text-slate-600">Reference : <span className="font-bold text-slate-900">{reference || 'Non cree'}</span></p>
      <p className="mt-1 text-sm text-slate-600">Cout unitaire : <span className="font-bold text-slate-900">{Number(unitCost ?? 0).toLocaleString('fr-FR')} Ar</span></p>
      <p className="mt-1 text-sm text-slate-600">Cout total : <span className="font-bold text-slate-900">{Number(cost ?? 0).toLocaleString('fr-FR')} Ar</span></p>
      <p className="mt-1 text-sm text-slate-600">Source prix : <span className="font-bold text-slate-900">{priceSource ? priceSourceLabels[priceSource as keyof typeof priceSourceLabels] : '-'}</span></p>
    </div>
  )
}
