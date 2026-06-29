import { FileSpreadsheet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { getSalesStats } from '../../api/modules/sales.api'
import { exportSalesStatsToExcel } from '../../lib/salesExports'
import {
  salesChannelLabels,
  salesChannels,
  salesPointLabels,
  salesPoints,
  serviceModeLabels,
  serviceModes,
} from '../../lib/sales'
import type { SalesChannel, SalesPoint, SalesStatsPayload, ServiceMode } from '../../lib/sales'

const emptyStats: SalesStatsPayload = {
  byArticle: [],
  byFamily: [],
  byChannel: [],
  byService: [],
  byPoint: [],
  byDay: [],
  byMonth: [],
  offers: [],
  summary: { salesCount: 0, revenue: 0, averageBasket: 0, offeredValue: 0, returnedQuantity: 0 },
}

export function SalesStatsPage() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [channel, setChannel] = useState<SalesChannel | 'all'>('all')
  const [serviceMode, setServiceMode] = useState<ServiceMode | 'all'>('all')
  const [salesPoint, setSalesPoint] = useState<SalesPoint | 'all'>('all')
  const [stats, setStats] = useState<SalesStatsPayload>(emptyStats)
  const [tab, setTab] = useState<keyof Omit<SalesStatsPayload, 'summary'>>('byArticle')
  const rows = stats[tab]

  const load = useCallback(async () => {
    try {
      setStats(await getSalesStats({ fromDate, toDate, channel, serviceMode, salesPoint }))
    } catch {
      toast.error('Impossible de charger les statistiques.')
    }
  }, [channel, fromDate, salesPoint, serviceMode, toDate])

  useEffect(() => {
    load()
  }, [load])

  const tabs: Array<{ key: keyof Omit<SalesStatsPayload, 'summary'>; label: string }> = [
    { key: 'byArticle', label: 'Par article' },
    { key: 'byFamily', label: 'Par famille' },
    { key: 'byChannel', label: 'Par canal' },
    { key: 'byService', label: 'Par service' },
    { key: 'byPoint', label: 'Par point de vente' },
    { key: 'byDay', label: 'Par jour' },
    { key: 'byMonth', label: 'Par mois' },
    { key: 'offers', label: 'Offres' },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Ventes</p><h1 className="page-title mt-2">Statistiques</h1></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { exportSalesStatsToExcel(rows); toast.success('Statistiques exportees avec succes') }} className="btn-primary"><FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel</button>
          <Link to="/sales" className="btn-secondary">Retour</Link>
        </div>
      </header>

      <section className="surface grid gap-3 p-4 md:grid-cols-[160px_160px_1fr_1fr_1fr_auto]">
        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="input" />
        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="input" />
        <select value={channel} onChange={(event) => setChannel(event.target.value as SalesChannel | 'all')} className="input"><option value="all">Tous canaux</option>{salesChannels.map((item) => <option key={item} value={item}>{salesChannelLabels[item]}</option>)}</select>
        <select value={serviceMode} onChange={(event) => setServiceMode(event.target.value as ServiceMode | 'all')} className="input"><option value="all">Tous services</option>{serviceModes.map((item) => <option key={item} value={item}>{serviceModeLabels[item]}</option>)}</select>
        <select value={salesPoint} onChange={(event) => setSalesPoint(event.target.value as SalesPoint | 'all')} className="input"><option value="all">Tous points</option>{salesPoints.map((item) => <option key={item} value={item}>{salesPointLabels[item]}</option>)}</select>
        <button type="button" onClick={load} className="btn-secondary">Actualiser</button>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <Metric label="Nombre ventes" value={stats.summary.salesCount.toLocaleString('fr-FR')} />
        <Metric label="Chiffre d'affaires" value={`${stats.summary.revenue.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Panier moyen" value={`${stats.summary.averageBasket.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Valeur offerte" value={`${stats.summary.offeredValue.toLocaleString('fr-FR')} Ar`} />
        <Metric label="Quantite retournee" value={stats.summary.returnedQuantity.toLocaleString('fr-FR')} />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3">
          {tabs.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={item.key === tab ? 'btn-primary' : 'btn-secondary'}>{item.label}</button>)}
        </div>
        <div className="hidden grid-cols-[1fr_140px_180px_160px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 xl:grid">
          <span>Libelle</span><span>Quantite</span><span>CA / valeur</span><span>Prix moyen</span>
        </div>
        <div className="divide-y divide-slate-200">
          {rows.map((row) => (
            <div key={row.key} className="grid gap-3 px-5 py-4 xl:grid-cols-[1fr_140px_180px_160px] xl:items-center">
              <span className="font-bold">{row.label}</span>
              <span>{row.quantity.toLocaleString('fr-FR')}</span>
              <span>{row.revenue.toLocaleString('fr-FR')} Ar</span>
              <span>{row.averagePrice.toLocaleString('fr-FR')} Ar</span>
            </div>
          ))}
          {rows.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune statistique.</p>}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-[#1E3A8A]">{value}</p></div>
}
