import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getStockCorrection } from '../../api/modules/stockCorrections.api'
import type { StockCorrection } from '../../api/modules/stockCorrections.api'
import { getSignedStockCorrectionQuantity, getStockCorrectionOrigin, getStockCorrectionSourcePath } from '../../lib/stockCorrections'
import { movementStatusLabels, movementTypeLabels } from '../../lib/stock'

const originLabels = { inventory: 'Correction issue d’un inventaire', manual: 'Correction manuelle', other: 'Autre correction' } as const

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR')
}

export function StockMovementDetailPage() {
  const { id = '' } = useParams()
  const [movement, setMovement] = useState<StockCorrection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getStockCorrection(id)
      .then((result) => { if (active) { setMovement(result); setError(null) } })
      .catch((cause) => {
        console.error('Erreur de chargement du détail de correction', cause)
        if (active) setError('Impossible de charger le détail de cette correction.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  if (loading) return <p className="surface p-5 text-sm text-slate-600">Chargement du mouvement…</p>
  if (error || !movement) return <section className="surface space-y-4 p-5"><p role="alert" className="text-sm text-red-800">{error ?? 'Correction introuvable.'}</p><Link to="/stock/corrections" className="btn-secondary"><ArrowLeft className="mr-2 h-4 w-4" /> Retour aux corrections</Link></section>

  const origin = getStockCorrectionOrigin(movement)
  const signedQuantity = getSignedStockCorrectionQuantity(movement)
  const location = movement.from_location?.name ?? movement.to_location?.name ?? '—'
  const validator = movement.manual_validator?.full_name ?? movement.retroactive_validator?.full_name ?? '—'
  const sourceHref = getStockCorrectionSourcePath(movement)
  const sourceReference = movement.reference_type === 'inventaire'
    ? movement.source_reference ?? movement.reference_id
    : movement.reference_id

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Traçabilité du stock</p><h1 className="page-title mt-2">{movement.movement_reference}</h1><p className="mt-2 text-sm text-slate-600">{originLabels[origin]}</p></div>
        <Link to="/stock/corrections" className="btn-secondary"><ArrowLeft className="mr-2 h-4 w-4" /> Toutes les corrections</Link>
      </header>

      <section className="surface grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
        <Detail label="Article" value={movement.articles?.name ?? 'Article indisponible'} />
        <Detail label="Variation signée" value={`${signedQuantity < 0 ? '−' : '+'}${Math.abs(signedQuantity).toLocaleString('fr-FR')} ${movement.units?.abbreviation ?? ''}`} />
        <Detail label="Type" value={movementTypeLabels[movement.movement_type]} />
        <Detail label="Date effective" value={movement.movement_date} />
        <Detail label="Enregistré le" value={formatDateTime(movement.created_at)} />
        <Detail label="Localisation" value={location} />
        <Detail label="Statut" value={movementStatusLabels[movement.status]} />
        <Detail label="Saisi / généré par" value={movement.creator?.full_name ?? '—'} />
        <Detail label="Validateur" value={validator} />
        <Detail label="Motif" value={movement.manual_reason || movement.comment || '—'} />
        <Detail label="Commentaire" value={movement.comment || '—'} />
        <Detail label="Référence d’origine" value={movement.reference_type ?? '—'} />
        {movement.reference_id && <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dossier source</p>{sourceHref ? <Link to={sourceHref} className="inline-flex items-center gap-1 font-medium text-blue-800 underline">{sourceReference}<ExternalLink className="h-3.5 w-3.5" /></Link> : <p className="text-sm">{sourceReference}</p>}</div>}
        <Detail label="Quantité enregistrée" value={`${Number(movement.quantity).toLocaleString('fr-FR')} ${movement.units?.abbreviation ?? ''}`} />
        <Detail label="Valeur de stock" value={`${Number(movement.total_cost ?? 0).toLocaleString('fr-FR')} Ar`} />
      </section>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="whitespace-pre-wrap text-sm font-medium text-slate-900">{value}</p></div>
}
