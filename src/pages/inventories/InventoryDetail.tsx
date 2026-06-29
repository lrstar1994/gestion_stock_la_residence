import { CheckCircle, Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getInventory, requestInventoryAdjustment, validateInventory, validateInventoryAdjustment } from '../../api/modules/inventories.api'
import { useAuth } from '../../hooks/useAuth'
import { exportInventoryDetailToExcel, exportInventoryDifferencesToExcel } from '../../lib/inventoryExports'
import { canCreateInventories, canExportInventories, canValidateInventory, hasSignificantDifference, inventoryStatusLabels, inventoryTypeLabels } from '../../lib/inventories'
import type { Inventory } from '../../lib/inventories'

export function InventoryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'significant' | 'missing_reason'>('all')

  const load = useCallback(async () => {
    if (!id) return
    try {
      setInventory(await getInventory(id))
    } catch {
      toast.error('Inventaire introuvable')
      navigate('/inventories')
    }
  }, [id, navigate])

  useEffect(() => {
    load()
  }, [load])

  const validate = async () => {
    if (!id || !profile?.id) return
    const comment = window.prompt('Commentaire de validation optionnel') ?? ''
    try {
      await validateInventory(id, profile.id, comment)
      toast.success('Inventaire valide avec succes')
      toast.success('Ecarts corriges avec succes')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Validation impossible')
    }
  }

  const askAdjustment = async (itemId?: string, currentQuantity?: number) => {
    if (!id || !itemId || !profile?.id) return
    const quantity = Number(window.prompt('Nouvelle quantite proposee', String(currentQuantity ?? 0)) ?? currentQuantity)
    const reason = window.prompt('Motif de la correction')
    if (!reason) return
    try {
      await requestInventoryAdjustment({ inventoryId: id, inventoryItemId: itemId, proposedCountedQuantity: quantity, reason, profileId: profile.id })
      toast.success('Demande de correction creee')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Correction impossible')
    }
  }

  const validateAdjustment = async (requestId: string) => {
    if (!profile?.id) return
    const comment = window.prompt('Commentaire de validation optionnel') ?? ''
    try {
      await validateInventoryAdjustment(requestId, profile.id, comment)
      toast.success('Correction creee avec succes')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Validation impossible')
    }
  }

  if (!inventory) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>

  const items = (inventory.inventory_items ?? []).filter((item) => {
    const difference = Number(item.difference ?? 0)
    if (filter === 'positive') return difference > 0
    if (filter === 'negative') return difference < 0
    if (filter === 'significant') return hasSignificantDifference(item)
    if (filter === 'missing_reason') return difference !== 0 && !item.reason?.trim()
    return true
  })
  const allItems = inventory.inventory_items ?? []
  const positive = allItems.filter((item) => Number(item.difference ?? 0) > 0).length
  const negative = allItems.filter((item) => Number(item.difference ?? 0) < 0).length
  const neutral = allItems.filter((item) => Number(item.difference ?? 0) === 0).length

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Inventaire</p>
          <h1 className="page-title mt-2">{inventory.reference}</h1>
          <p className="mt-2 text-sm text-slate-600">{inventory.locations?.name} - {inventoryStatusLabels[inventory.status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExportInventories(profile?.role) && <button type="button" onClick={() => exportInventoryDetailToExcel(inventory)} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> Excel</button>}
          {canExportInventories(profile?.role) && <button type="button" onClick={() => exportInventoryDifferencesToExcel(inventory)} className="btn-secondary">Ecarts</button>}
          {canExportInventories(profile?.role) && <button type="button" onClick={() => exportInventoryDifferencesToExcel(inventory, true)} className="btn-secondary">Significatifs</button>}
          {inventory.status === 'en_attente' && canValidateInventory(profile?.role) && <button type="button" onClick={validate} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" /> Valider Direction</button>}
          <Link to="/inventories" className="btn-secondary">Retour</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Date" value={new Date(inventory.inventory_date).toLocaleDateString('fr-FR')} />
        <Info label="Type" value={inventoryTypeLabels[inventory.type]} />
        <Info label="Inventoriste" value={inventory.creator?.full_name || '-'} />
        <Info label="Validateur" value={inventory.validator?.full_name || '-'} />
      </section>

      {inventory.type === 'initial' && inventory.status !== 'corrige' && (
        <section className="surface border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Stock initial non confirme. Inventaire initial a realiser dans un delai maximum de 2 jours.
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Ecarts positifs" value={String(positive)} />
        <Info label="Ecarts negatifs" value={String(negative)} />
        <Info label="Sans ecart" value={String(neutral)} />
        <Info label="Valeur ecart" value={`${Number(inventory.total_value_difference ?? 0).toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          {[
            ['all', 'Tous'],
            ['positive', 'Positifs'],
            ['negative', 'Negatifs'],
            ['significant', 'Significatifs'],
            ['missing_reason', 'Sans motif'],
          ].map(([key, label]) => <button key={key} type="button" onClick={() => setFilter(key as typeof filter)} className={filter === key ? 'btn-primary' : 'btn-secondary'}>{label}</button>)}
        </div>
        <div className="hidden grid-cols-[1fr_120px_120px_90px_110px_130px_1fr_150px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Theorique</span><span>Compte</span><span>Unite</span><span>Ecart</span><span>Valeur</span><span>Motif</span><span>Mouvement</span><span>Action</span>
        </div>
        <div className="divide-y divide-slate-200">
          {items.map((item) => {
            const difference = Number(item.difference ?? 0)
            return (
              <div key={item.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_120px_120px_90px_110px_130px_1fr_150px_120px] xl:items-center">
                <span className="font-semibold">{item.articles?.name}</span>
                <span>{Number(item.theoretical_quantity).toLocaleString('fr-FR')}</span>
                <span>{Number(item.counted_quantity).toLocaleString('fr-FR')}</span>
                <span>{item.units?.abbreviation}</span>
                <span className={difference > 0 ? 'font-bold text-emerald-600' : difference < 0 ? 'font-bold text-red-600' : 'font-bold text-slate-700'}>{difference.toLocaleString('fr-FR')}</span>
                <span>{Number(item.value_difference ?? 0).toLocaleString('fr-FR')} Ar</span>
                <span>{item.reason || '-'}</span>
                <span className="font-bold text-[#1E3A8A]">{item.stock_movements?.movement_reference || '-'}</span>
                <span>{canCreateInventories(profile?.role) && ['valide', 'corrige'].includes(inventory.status) && <button type="button" onClick={() => askAdjustment(item.id, Number(item.counted_quantity))} className="btn-secondary">Corriger</button>}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-bold">Demandes de correction apres validation</h2>
        <div className="mt-4 space-y-3">
          {inventory.inventory_adjustment_requests?.map((request) => (
            <div key={request.id} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_120px_120px_120px_auto] md:items-center">
              <span><span className="block font-semibold">{request.articles?.name}</span><span className="text-xs text-slate-500">{request.reason}</span></span>
              <span>{Number(request.original_counted_quantity).toLocaleString('fr-FR')}</span>
              <span>{Number(request.proposed_counted_quantity).toLocaleString('fr-FR')}</span>
              <span className={Number(request.adjustment_difference) >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>{Number(request.adjustment_difference).toLocaleString('fr-FR')}</span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{request.status}</span>
                {request.status === 'en_attente' && canValidateInventory(profile?.role) && <button type="button" onClick={() => validateAdjustment(request.id)} className="btn-primary">Valider</button>}
              </span>
            </div>
          ))}
          {(inventory.inventory_adjustment_requests?.length ?? 0) === 0 && <p className="text-sm text-slate-600">Aucune demande de correction.</p>}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}
