import { CheckCircle, Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getMyPinStatus } from '../../api/modules/sensitiveActions.api'
import { closeInventory, getInventory, requestInventoryAdjustment, validateInventory, validateInventoryAdjustment } from '../../api/modules/inventories.api'
import { SensitiveActionModal } from '../../components/SensitiveActionModal'
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
  const [pinDefined, setPinDefined] = useState(false)
  const [sensitiveAction, setSensitiveAction] = useState<{ type: 'inventory' | 'adjustment' | 'close'; id: string } | null>(null)
  const [validating, setValidating] = useState(false)

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

  useEffect(() => {
    if (canValidateInventory(profile?.role)) {
      getMyPinStatus().then((status) => setPinDefined(status.pin_defined)).catch(() => setPinDefined(false))
    }
  }, [profile?.role])

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
  const relay = getInventoryRelay(inventory.status)

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
          {canCreateInventories(profile?.role) && ['brouillon', 'en_saisie', 'saisi'].includes(inventory.status) && <Link to={`/inventories/${inventory.id}/edit`} className="btn-primary">Reprendre le brouillon</Link>}
          {['saisi', 'en_attente', 'a_controler', 'a_valider_direction'].includes(inventory.status) && canValidateInventory(profile?.role) && <button type="button" onClick={() => setSensitiveAction({ type: 'inventory', id: inventory.id })} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" /> Valider Direction</button>}
          {['valide', 'corrige', 'corrections_generees'].includes(inventory.status) && canValidateInventory(profile?.role) && <button type="button" onClick={() => setSensitiveAction({ type: 'close', id: inventory.id })} className="btn-primary"><CheckCircle className="mr-2 h-4 w-4" /> Clôturer l’inventaire</button>}
          <Link to="/inventories" className="btn-secondary">Retour</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Date" value={new Date(inventory.inventory_date).toLocaleDateString('fr-FR')} />
        <Info label="Type" value={inventoryTypeLabels[inventory.type]} />
        <Info label="Inventoriste" value={inventory.creator?.full_name || '-'} />
        <Info label="Validateur" value={inventory.validator?.full_name || '-'} />
        {inventory.status === 'cloture' && <Info label="Clôturé par" value={inventory.closer?.full_name || '-'} />}
        {inventory.status === 'cloture' && <Info label="Clôturé le" value={inventory.closed_at ? new Date(inventory.closed_at).toLocaleString('fr-FR') : '-'} />}
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
                <div className="grid gap-2 rounded-md bg-slate-50 p-3 xl:hidden">
                  <div><strong>Article :</strong> {item.articles?.name || 'Article non renseigné'}</div>
                  <div><strong>Stock théorique :</strong> {Number(item.theoretical_quantity).toLocaleString('fr-FR')} {item.units?.abbreviation || '-'}</div>
                  <div><strong>Stock compté :</strong> {item.counted_quantity === null ? 'Non compté' : Number(item.counted_quantity).toLocaleString('fr-FR')}</div>
                  <div><strong>Écart :</strong> {difference.toLocaleString('fr-FR')}</div>
                  <div><strong>Valeur de l’écart :</strong> {Number(item.value_difference ?? 0).toLocaleString('fr-FR')} Ar</div>
                  <div><strong>Motif :</strong> {item.reason || 'Aucun motif'}</div>
                </div>
                <span className="font-semibold">{item.articles?.name || "Article non renseigne"}</span>
                <span>{Number(item.theoretical_quantity).toLocaleString('fr-FR')}</span>
                <span>{item.counted_quantity === null ? 'Non comptÃ©' : Number(item.counted_quantity).toLocaleString('fr-FR')}</span>
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
                {request.status === 'en_attente' && canValidateInventory(profile?.role) && <button type="button" onClick={() => setSensitiveAction({ type: 'adjustment', id: request.id })} className="btn-primary">Valider</button>}
              </span>
            </div>
          ))}
          {(inventory.inventory_adjustment_requests?.length ?? 0) === 0 && <p className="text-sm text-slate-600">Aucune demande de correction.</p>}
        </div>
      </section>

      <section className="surface p-5">
        <p className="eyebrow">Relais du dossier</p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <RelayInfo label="ÉTAPE ACTUELLE" value={relay.stage} />
          <RelayInfo label="Responsable actuel" value={relay.owner} />
          <RelayInfo label="Action attendue" value={relay.action} />
          <RelayInfo label="Prochain responsable" value={relay.nextOwner} />
          <RelayInfo label="Prochain statut" value={relay.nextStatus} />
        </div>
        {relay.alert && <p className="mt-4 text-sm font-bold text-amber-800">{relay.alert}</p>}
      </section>
      <SensitiveActionModal
        open={Boolean(sensitiveAction)}
        title={sensitiveAction?.type === 'adjustment' ? 'Valider la correction de stock' : sensitiveAction?.type === 'close' ? 'Clôturer l’inventaire' : 'Valider l’inventaire'}
        description={sensitiveAction?.type === 'adjustment' ? 'Cette action crée un mouvement de correction traçable.' : sensitiveAction?.type === 'close' ? 'Les mouvements déjà générés seront vérifiés. Aucun nouveau mouvement ne sera créé.' : 'Les écarts seront acceptés et les corrections de stock seront générées.'}
        permissionLabel={sensitiveAction?.type === 'adjustment' ? 'stock_corrections.validate_from_inventory' : sensitiveAction?.type === 'close' ? 'inventories.close' : 'inventories.validate'}
        pinDefined={pinDefined}
        requireReason={sensitiveAction?.type === 'adjustment'}
        busy={validating}
        onCancel={() => setSensitiveAction(null)}
        onConfirm={async ({ pin, reason }) => {
          if (!sensitiveAction) return
          setValidating(true)
          try {
            if (sensitiveAction.type === 'adjustment') {
              await validateInventoryAdjustment(sensitiveAction.id, pin, reason)
              toast.success('Correction de stock crÃ©Ã©e et auditÃ©e.')
            } else if (sensitiveAction.type === 'close') {
              await closeInventory(sensitiveAction.id, pin, reason)
              toast.success('Inventaire clôturé. Les mouvements existants restent inchangés.')
            } else {
              await validateInventory(sensitiveAction.id, pin, reason)
              toast.success('Inventaire validÃ© ; corrections tracÃ©es.')
            }
            setSensitiveAction(null)
            await load()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Validation impossible')
          } finally {
            setValidating(false)
          }
        }}
      />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function RelayInfo({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900">{value}</p></div>
}

function getInventoryRelay(status: Inventory['status']) {
  if (status === 'brouillon' || status === 'en_saisie') return { stage: 'Comptage', owner: 'Magasin / Stock', action: 'Completer les quantites puis soumettre', nextOwner: 'Direction', nextStatus: 'En attente Direction : inventaire a valider', alert: '' }
  if (['saisi', 'en_attente', 'a_controler', 'a_valider_direction', 'en_attente_validation', 'validation_direction_requise'].includes(status)) return { stage: 'Decision', owner: 'Direction', action: 'Valider ou refuser les ecarts constates', nextOwner: 'Magasin / Stock', nextStatus: 'Stock confirme et corrections tracees', alert: 'Decision visible dans Mes validations.' }
  if (status === 'valide' || status === 'corrige' || status === 'corrections_generees') return { stage: 'Controle final', owner: 'Direction / Controle final', action: 'Verifier les mouvements puis cloturer', nextOwner: '-', nextStatus: 'Inventaire cloture', alert: '' }
  return { stage: 'Dossier termine', owner: '-', action: 'Consulter l historique', nextOwner: '-', nextStatus: status === 'annule' ? 'Inventaire annule' : 'Inventaire classe', alert: '' }
}
