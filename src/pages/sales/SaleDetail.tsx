import { Ban, Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cancelSale, getSale, returnSaleItem } from '../../api/modules/sales.api'
import { useAuth } from '../../hooks/useAuth'
import {
  canCancelSales,
  productTypeLabels,
  salesChannelLabels,
  salesPointLabels,
  salesStatusLabels,
  serviceModeLabels,
} from '../../lib/sales'
import type { Sale } from '../../lib/sales'
import { exportSalesToExcel } from '../../lib/salesExports'
import { stockOutDestinationLabels } from '../../lib/stockOuts'

export function SaleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [sale, setSale] = useState<Sale | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setSale(await getSale(id))
    } catch {
      toast.error('Vente introuvable')
      navigate('/sales')
    }
  }, [id, navigate])

  useEffect(() => {
    load()
  }, [load])

  const cancel = async () => {
    if (!id || !profile?.id) return
    const reason = window.prompt("Motif d'annulation")
    if (!reason) return
    try {
      await cancelSale(id, profile.id, reason)
      toast.success('Vente annulee avec succes')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Annulation impossible')
    }
  }

  if (!sale) return <div className="surface p-6 text-sm text-slate-600">Chargement...</div>
  const offeredValue = (sale.sale_items ?? []).reduce((sum, item) => sum + Number(item.quantity_offered ?? 0) * Number(item.unit_price ?? 0), 0)

  const partialReturn = async (itemId?: string) => {
    if (!id || !itemId || !profile?.id) return
    const quantity = Number(window.prompt('Quantite a retourner') ?? 0)
    if (!quantity) return
    const reason = window.prompt('Motif du retour')
    if (!reason) return
    try {
      await returnSaleItem({ saleId: id, saleItemId: itemId, quantity, reason, profileId: profile.id })
      toast.success('Retour partiel enregistre')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Retour impossible')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Vente</p>
          <h1 className="page-title mt-2">{sale.reference}</h1>
          <p className="mt-2 text-sm text-slate-600">{salesPointLabels[sale.sales_point]} - {salesStatusLabels[sale.status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportSalesToExcel([sale])} className="btn-secondary"><Download className="mr-2 h-4 w-4" /> Excel</button>
          {canCancelSales(profile?.role) && sale.status !== 'annulee' && <button type="button" onClick={cancel} className="btn-secondary text-red-700"><Ban className="mr-2 h-4 w-4" /> Annuler</button>}
          <Link to="/sales" className="btn-secondary">Retour</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Date" value={new Date(sale.sale_date).toLocaleString('fr-FR')} />
        <Info label="Canal" value={salesChannelLabels[sale.channel]} />
        <Info label="Service" value={serviceModeLabels[sale.service_mode]} />
        <Info label="Total TTC" value={`${Number(sale.total_after_discount ?? 0).toLocaleString('fr-FR')} Ar`} />
        <Info label="Valeur offerte" value={`${offeredValue.toLocaleString('fr-FR')} Ar`} />
      </section>

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <InfoFlat label="Point de vente" value={salesPointLabels[sale.sales_point]} />
        <InfoFlat label="Client" value={sale.client_name || '-'} />
        <InfoFlat label="Evenement" value={sale.events?.name || '-'} />
        <InfoFlat label="Utilisateur" value={sale.creator?.full_name || '-'} />
        {sale.comment && <div className="md:col-span-2"><InfoFlat label="Commentaire" value={sale.comment} /></div>}
        {sale.cancellation_reason && (
          <div className="md:col-span-2 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-800">
            Annulation par {sale.canceller?.full_name || 'Direction'} le {sale.cancelled_at ? new Date(sale.cancelled_at).toLocaleString('fr-FR') : '-'} : {sale.cancellation_reason}
          </div>
        )}
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1fr_130px_100px_100px_100px_120px_120px_130px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Article</span><span>Type</span><span>Quantite</span><span>Offert</span><span>Retour</span><span>Prix</span><span>Remise</span><span>Total</span><span>Action</span>
        </div>
        <div className="divide-y divide-slate-200">
          {sale.sale_items?.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_130px_100px_100px_100px_120px_120px_130px_120px] xl:items-center">
              <span><span className="block font-semibold">{item.articles?.name}</span><span className="text-xs text-slate-500">{item.recipes?.name || item.articles?.families?.name || ''}</span>{item.offer_reason && <span className="mt-1 block text-xs font-semibold text-amber-700">Offre : {item.offer_reason}</span>}</span>
              <span>{productTypeLabels[item.product_type]}</span>
              <span>{Number(item.quantity).toLocaleString('fr-FR')}</span>
              <span>{Number(item.quantity_offered ?? 0).toLocaleString('fr-FR')}</span>
              <span>{Number(item.returned_quantity ?? 0).toLocaleString('fr-FR')}</span>
              <span>{Number(item.unit_price).toLocaleString('fr-FR')} Ar</span>
              <span>{Number(item.discount ?? 0).toLocaleString('fr-FR')} Ar</span>
              <span className="font-bold">{Number(item.total_after_discount ?? 0).toLocaleString('fr-FR')} Ar</span>
              <span>{canCancelSales(profile?.role) && sale.status !== 'annulee' && <button type="button" onClick={() => partialReturn(item.id)} className="btn-secondary">Retour</button>}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-bold">Retours partiels</h2>
        <div className="mt-4 space-y-3">
          {sale.sale_returns?.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <p className="font-bold">{Number(item.quantity).toLocaleString('fr-FR')} retourne - {item.reason}</p>
              <p className="mt-1 text-slate-500">Mouvement : {item.stock_movements?.movement_reference || '-'} · {new Date(item.created_at).toLocaleString('fr-FR')} · {item.creator?.full_name || '-'}</p>
            </div>
          ))}
          {(sale.sale_returns?.length ?? 0) === 0 && <p className="text-sm text-slate-600">Aucun retour partiel.</p>}
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-bold">Sorties de stock associees</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sale.sale_stock_outs?.map((link) => (
            <Link key={link.id} to={`/stock/stock-out/${link.stock_out_id}`} className="rounded-md border border-slate-200 p-3 transition hover:bg-slate-50">
              <p className="font-bold text-[#1E3A8A]">{link.stock_outs?.reference}</p>
              <p className="mt-1 text-sm text-slate-600">{link.stock_outs?.articles?.name} - {Number(link.stock_outs?.quantity ?? 0).toLocaleString('fr-FR')} {link.stock_outs?.units?.abbreviation}</p>
              <p className="mt-1 text-xs text-slate-500">{link.stock_outs?.destination ? stockOutDestinationLabels[link.stock_outs.destination] : ''}</p>
            </Link>
          ))}
          {(sale.sale_stock_outs?.length ?? 0) === 0 && <p className="text-sm text-slate-600">Aucune sortie de stock liee.</p>}
        </div>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>
}

function InfoFlat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>
}
