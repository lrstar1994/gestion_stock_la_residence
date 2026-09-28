import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { getMyPinStatus } from '../../api/modules/sensitiveActions.api'
import {
  closeStockTransfer,
  confirmStockTransferDiscrepancy,
  dispatchStockTransfer,
  listStockTransferWorkflow,
  receiveStockTransfer,
} from '../../api/modules/stock.api'
import type { StockTransferWorkflowBatch, StockTransferWorkflowHandoff, StockTransferWorkflowLine } from '../../api/modules/stock.api'
import { SensitiveActionModal } from '../../components/SensitiveActionModal'

type Operation =
  | { kind: 'dispatch'; batch: StockTransferWorkflowBatch; lines: Array<{ batch_item_id: string; quantity: number }>; requestId: string }
  | { kind: 'receive'; batch: StockTransferWorkflowBatch; handoff: StockTransferWorkflowHandoff; lines: Array<{ handoff_item_id: string; quantity: number }>; finalize: boolean; reason: string; requestId: string }
  | { kind: 'discrepancy'; batch: StockTransferWorkflowBatch; discrepancyId: string }
  | { kind: 'close'; batch: StockTransferWorkflowBatch }

function totalReceived(line: StockTransferWorkflowLine) {
  return (line.stock_transfer_receipt_items ?? []).reduce((sum, receipt) => sum + Number(receipt.received_quantity ?? 0), 0)
}

function resolvedDiscrepancy(line: StockTransferWorkflowLine) {
  return (line.stock_transfer_discrepancies ?? []).filter((entry) => entry.status === 'resolved').reduce((sum, entry) => sum + Number(entry.quantity ?? 0), 0)
}

function pendingDiscrepancies(batch: StockTransferWorkflowBatch) {
  return batch.stock_transfer_handoffs.flatMap((handoff) => handoff.stock_transfer_handoff_items.flatMap((line) =>
    (line.stock_transfer_discrepancies ?? []).filter((entry) => entry.status === 'awaiting_magasinier').map((entry) => ({ ...entry, handoff, line }))))
}

export function StockTransferWorkflowPanel() {
  const { profile } = useAuth()
  const [batches, setBatches] = useState<StockTransferWorkflowBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pinDefined, setPinDefined] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [operation, setOperation] = useState<Operation | null>(null)
  const [dispatchAmounts, setDispatchAmounts] = useState<Record<string, string>>({})
  const [receiveAmounts, setReceiveAmounts] = useState<Record<string, string>>({})
  const [finalizeGaps, setFinalizeGaps] = useState<Record<string, boolean>>({})
  const [gapReasons, setGapReasons] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    try {
      setError(null)
      setBatches(await listStockTransferWorkflow())
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible de charger les transferts à traiter.'
      setError(message)
      setBatches([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])
  useEffect(() => {
    if (['magasinier', 'chef_cuisine', 'point_vente', 'direction'].includes(profile?.role ?? '')) {
      getMyPinStatus().then((status) => setPinDefined(status.pin_defined)).catch(() => setPinDefined(false))
    }
  }, [profile?.role])

  const role = profile?.role
  const operationPermission = useMemo(() => {
    if (!operation) return ''
    if (operation.kind === 'dispatch' || operation.kind === 'discrepancy') return 'stock.transfers.dispatch'
    if (operation.kind === 'receive') return 'stock.transfers.receive'
    return 'stock.transfers.close'
  }, [operation])
  const operationTitle = operation?.kind === 'dispatch' ? 'Confirmer la remise physique'
    : operation?.kind === 'receive' ? 'Confirmer la réception physique'
      : operation?.kind === 'discrepancy' ? 'Confirmer l’écart définitif'
        : 'Clôturer le transfert'

  const startDispatch = (batch: StockTransferWorkflowBatch) => {
    const lines = batch.stock_transfer_batch_items.map((line) => {
      const sent = batch.stock_transfer_handoffs.flatMap((handoff) => handoff.stock_transfer_handoff_items)
        .filter((handoffLine) => handoffLine.batch_item_id === line.id)
        .reduce((sum, handoffLine) => sum + Number(handoffLine.dispatched_quantity ?? 0), 0)
      const remaining = Math.max(0, Number(line.authorized_quantity ?? line.quantity ?? 0) - sent)
      return { batch_item_id: line.id, quantity: Number(dispatchAmounts[line.id] ?? remaining) }
    }).filter((line) => line.quantity > 0)
    if (!lines.length) return toast.error('Aucune quantité ne reste à remettre.')
    setOperation({ kind: 'dispatch', batch, lines, requestId: crypto.randomUUID() })
    setPinOpen(true)
  }

  const startReceive = (batch: StockTransferWorkflowBatch, handoff: StockTransferWorkflowHandoff) => {
    const lines = handoff.stock_transfer_handoff_items.map((line) => {
      const received = totalReceived(line)
      const settled = resolvedDiscrepancy(line)
      const remaining = Math.max(0, Number(line.dispatched_quantity) - received - settled)
      return { handoff_item_id: line.id, quantity: Number(receiveAmounts[line.id] ?? remaining) }
    })
    if (!lines.some((line) => line.quantity > 0)) return toast.error('Aucune quantité ne reste à réceptionner.')
    const finalize = Boolean(finalizeGaps[handoff.id])
    const reason = gapReasons[handoff.id] ?? ''
    if (finalize && !reason.trim()) return toast.error('Indiquez le motif de l’écart définitif.')
    setOperation({ kind: 'receive', batch, handoff, lines, finalize, reason, requestId: crypto.randomUUID() })
    setPinOpen(true)
  }

  const confirm = async ({ pin }: { pin: string }) => {
    if (!operation) return
    setBusy(true)
    try {
      if (operation.kind === 'dispatch') {
        const result = await dispatchStockTransfer(operation.batch.id, operation.requestId, operation.lines, pin)
        toast.success(`Remise ${result.reference} enregistrée en transit.`)
      } else if (operation.kind === 'receive') {
        const result = await receiveStockTransfer(operation.handoff.id, operation.requestId, operation.lines, operation.finalize, operation.reason, pin)
        toast.success(result.status === 'discrepancy_pending' ? 'Réception enregistrée ; l’écart attend la confirmation du Magasinier.' : 'Réception enregistrée.')
      } else if (operation.kind === 'discrepancy') {
        await confirmStockTransferDiscrepancy(operation.discrepancyId, pin)
        toast.success('Écart confirmé et reliquat de transit régularisé.')
      } else {
        await closeStockTransfer(operation.batch.id, pin)
        toast.success('Transfert clôturé.')
      }
      setPinOpen(false)
      setOperation(null)
      await reload()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Action de transfert refusée.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <section className="surface p-5"><h2 className="font-black">Transmissions physiques</h2><p className="mt-2 text-sm text-slate-600">Chargement des transferts…</p></section>

  return <>
    <section className="surface overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black">Transmissions physiques et réceptions</h2><p className="mt-1 text-sm text-slate-600">Remise Magasinier puis réception par un autre profil affecté à la destination.</p></div>
      {error && <p className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Erreur de chargement : {error}</p>}
      {!error && batches.length === 0 && <p className="p-5 text-sm text-slate-600">Aucun transfert en attente d’action.</p>}
      <div className="divide-y divide-slate-200">
        {batches.map((batch) => {
          const activeDiscrepancies = pendingDiscrepancies(batch)
          const batchLines = batch.stock_transfer_batch_items.map((line) => {
            const handoffLines = batch.stock_transfer_handoffs.flatMap((handoff) => handoff.stock_transfer_handoff_items).filter((entry) => entry.batch_item_id === line.id)
            const sent = handoffLines.reduce((sum, entry) => sum + Number(entry.dispatched_quantity), 0)
            const received = handoffLines.reduce((sum, entry) => sum + totalReceived(entry), 0)
            const settled = handoffLines.reduce((sum, entry) => sum + resolvedDiscrepancy(entry), 0)
            return { line, sent, received, settled, transit: Math.max(0, sent - received - settled), toDispatch: Math.max(0, Number(line.authorized_quantity ?? line.quantity ?? 0) - sent) }
          })
          const canDispatch = role === 'magasinier' && ['prepared', 'awaiting_dispatch', 'in_transit', 'partially_received'].includes(batch.status) && batchLines.some((entry) => entry.toDispatch > 0)
          const canClose = role === 'direction' && batch.status === 'received'
          return <article key={batch.id} className="space-y-4 p-5">
            <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">{batch.reference ?? 'Transfert préparé'} · {batch.from_location_name_snapshot ?? batch.from_location_id} → {batch.to_location_name_snapshot ?? batch.to_location_id}</h3><p className="mt-1 text-sm text-slate-600">{batch.reason} · état : {batch.status} · préparé {batch.prepared_at ? new Date(batch.prepared_at).toLocaleString('fr-FR') : '—'}</p></div>{canDispatch && <button type="button" onClick={() => startDispatch(batch)} className="btn-primary">Confirmer la remise</button>}{canClose && <button type="button" onClick={() => { setOperation({ kind: 'close', batch }); setPinOpen(true) }} className="btn-primary">Clôturer le transfert</button>}</header>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2 pr-4">Article</th><th className="py-2 pr-4">Autorisée</th><th className="py-2 pr-4">Remise</th><th className="py-2 pr-4">Reçue</th><th className="py-2 pr-4">À remettre</th><th className="py-2 pr-4">En transit</th></tr></thead><tbody>{batchLines.map(({ line, sent, received, toDispatch, transit }) => <tr key={line.id} className="border-b last:border-0"><td className="py-2 pr-4 font-semibold">{line.articles?.name ?? line.article_id}</td><td className="py-2 pr-4">{Number(line.authorized_quantity ?? line.quantity ?? 0).toLocaleString('fr-FR')} {line.units?.abbreviation}</td><td className="py-2 pr-4">{sent.toLocaleString('fr-FR')}</td><td className="py-2 pr-4">{received.toLocaleString('fr-FR')}</td><td className="py-2 pr-4">{toDispatch.toLocaleString('fr-FR')}{canDispatch && toDispatch > 0 && <input aria-label={`Quantité à remettre ${line.articles?.name ?? ''}`} type="number" min="0" max={toDispatch} step="0.01" value={dispatchAmounts[line.id] ?? toDispatch} onChange={(event) => setDispatchAmounts((current) => ({ ...current, [line.id]: event.target.value }))} className="input mt-1 w-28" />}</td><td className="py-2 pr-4">{transit.toLocaleString('fr-FR')}</td></tr>)}</tbody></table></div>
            {batch.stock_transfer_handoffs.map((handoff) => {
              const canReceive = ['magasinier', 'chef_cuisine', 'point_vente'].includes(role ?? '') && batch.status !== 'discrepancy_pending' && handoff.stock_transfer_handoff_items.some((line) => Number(line.dispatched_quantity) - totalReceived(line) - resolvedDiscrepancy(line) > 0)
              return <div key={handoff.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>Remise {handoff.reference}</strong><span className="ml-2 text-sm text-slate-600">{new Date(handoff.dispatched_at).toLocaleString('fr-FR')} · profil Magasinier {handoff.dispatched_by.slice(0, 8)}</span>{handoff.stock_transfer_receipts?.map((receipt) => <span key={receipt.id} className="ml-2 text-sm text-slate-600">· réception par profil {receipt.received_by.slice(0, 8)}</span>)}</div>{canReceive && <button type="button" onClick={() => startReceive(batch, handoff)} className="btn-secondary">Confirmer la réception</button>}</div>
                {canReceive && <div className="mt-3 flex flex-wrap items-end gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(finalizeGaps[handoff.id])} onChange={(event) => setFinalizeGaps((current) => ({ ...current, [handoff.id]: event.target.checked }))} />Déclarer le reliquat sélectionné comme écart définitif</label>{finalizeGaps[handoff.id] && <label className="min-w-64 flex-1"><span className="field-label">Motif de l’écart</span><input value={gapReasons[handoff.id] ?? ''} onChange={(event) => setGapReasons((current) => ({ ...current, [handoff.id]: event.target.value }))} className="input mt-1" /></label>}</div>}
                {canReceive && <div className="mt-3 grid gap-2 sm:grid-cols-2">{handoff.stock_transfer_handoff_items.map((line) => {
                  const remaining = Math.max(0, Number(line.dispatched_quantity) - totalReceived(line) - resolvedDiscrepancy(line))
                  const batchLine = batch.stock_transfer_batch_items.find((item) => item.id === line.batch_item_id)
                  return <label key={line.id} className="text-sm"><span>{batchLine?.articles?.name ?? line.article_id} · remis {Number(line.dispatched_quantity).toLocaleString('fr-FR')} · reste {remaining.toLocaleString('fr-FR')}</span><input type="number" min="0" max={remaining} step="0.01" value={receiveAmounts[line.id] ?? remaining} onChange={(event) => setReceiveAmounts((current) => ({ ...current, [line.id]: event.target.value }))} className="input mt-1" /></label>
                })}</div>}
              </div>
            })}
            {activeDiscrepancies.map(({ id, quantity, reason, handoff }) => <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"><span><strong>Écart définitif en attente du Magasinier</strong> · {Number(quantity).toLocaleString('fr-FR')} · {reason} · remise {handoff.reference}</span>{role === 'magasinier' && <button type="button" onClick={() => { setOperation({ kind: 'discrepancy', batch, discrepancyId: id }); setPinOpen(true) }} className="btn-secondary">Confirmer l’écart avec PIN</button>}</div>)}
          </article>
        })}
      </div>
    </section>
    <SensitiveActionModal
      open={pinOpen}
      title={operationTitle}
      description={operation?.kind === 'dispatch' ? 'Confirmez les quantités physiquement remises. Elles sortiront de l’origine et resteront en transit jusqu’à réception.' : operation?.kind === 'receive' ? 'Confirmez les quantités réellement reçues. Le profil destinataire doit être distinct du Magasinier.' : operation?.kind === 'discrepancy' ? 'Cette confirmation clôturera l’écart comme perte justifiée après la confirmation déjà donnée par le responsable destination.' : 'La clôture ne crée aucun mouvement supplémentaire.'}
      permissionLabel={operationPermission}
      pinDefined={pinDefined}
      busy={busy}
      onCancel={() => { if (!busy) { setPinOpen(false); setOperation(null) } }}
      onConfirm={confirm}
    />
  </>
}
