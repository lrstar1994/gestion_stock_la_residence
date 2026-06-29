import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { ChartRow, DashboardTableRow, TimelineRow } from '../../lib/dashboard'
import { formatMoney, formatNumber } from '../../lib/dashboard'

const palette = ['#1E3A8A', '#D4AF37', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#475569', '#15803d']

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#1E3A8A]">{value}</p>
      {hint && <p className="mt-2 text-xs font-semibold text-slate-500">{hint}</p>}
    </div>
  )
}

export function ChartCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function HorizontalBars({ rows, valueType = 'money', limit = 8 }: { rows: ChartRow[]; valueType?: 'money' | 'number' | 'percent'; limit?: number }) {
  const visible = rows.slice(0, limit)
  const max = Math.max(...visible.map((row) => Math.abs(row.value)), 1)
  if (visible.length === 0) return <EmptyState />
  return (
    <div className="space-y-3">
      {visible.map((row, index) => (
        <div key={`${row.label}-${index}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-slate-700">{row.label}</span>
            <span className="shrink-0 font-bold text-slate-950">{formatValue(row.value, valueType)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(3, (Math.abs(row.value) / max) * 100)}%`, backgroundColor: palette[index % palette.length] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DonutChart({ rows, valueType = 'money' }: { rows: ChartRow[]; valueType?: 'money' | 'number' }) {
  const visible = rows.slice(0, 6)
  const total = visible.reduce((sum, row) => sum + Math.max(0, row.value), 0)
  if (visible.length === 0 || total <= 0) return <EmptyState />
  const segments = visible.map((row, index) => {
    const dash = (Math.max(0, row.value) / total) * 100
    const offset = 25 - visible.slice(0, index).reduce((sum, item) => sum + (Math.max(0, item.value) / total) * 100, 0)
    return <circle key={row.label} cx="18" cy="18" r="15.915" fill="transparent" stroke={palette[index % palette.length]} strokeWidth="4" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={offset} />
  })
  return (
    <div className="grid gap-5 md:grid-cols-[150px_1fr] md:items-center">
      <svg viewBox="0 0 36 36" className="h-36 w-36 -rotate-90">{segments}</svg>
      <div className="space-y-2">
        {visible.map((row, index) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} /><span className="truncate">{row.label}</span></span>
            <span className="font-bold">{formatValue(row.value, valueType)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LineChart({ rows, valueType = 'money' }: { rows: TimelineRow[]; valueType?: 'money' | 'number' }) {
  if (rows.length === 0) return <EmptyState />
  const width = 640
  const height = 180
  const max = Math.max(...rows.map((row) => row.value), 1)
  const min = Math.min(...rows.map((row) => row.value), 0)
  const spread = max - min || 1
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? 0 : (index / (rows.length - 1)) * width
    const y = height - ((row.value - min) / spread) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible">
        <polyline fill="none" stroke="#1E3A8A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
      <div className="flex justify-between gap-2 text-xs font-semibold text-slate-500">
        <span>{rows[0]?.label}</span>
        <span>{formatValue(rows[rows.length - 1]?.value ?? 0, valueType)}</span>
        <span>{rows[rows.length - 1]?.label}</span>
      </div>
    </div>
  )
}

export function DataTable({ rows, empty = 'Aucune donnee.' }: { rows: DashboardTableRow[]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-600">{empty}</p>
  return (
    <div className="divide-y divide-slate-200">
      {rows.map((row) => {
        const content = (
          <div className="grid gap-2 py-3 md:grid-cols-[1fr_130px_120px] md:items-center">
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-950">{row.label}</p>
              {row.description && <p className="mt-1 truncate text-sm text-slate-500">{row.description}</p>}
            </div>
            <span className="text-sm font-semibold text-slate-700">{row.amount !== undefined ? formatMoney(row.amount) : row.date ?? '-'}</span>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{row.status ?? row.date ?? '-'}</span>
          </div>
        )
        return row.to ? <Link key={row.id} to={row.to} className="block transition hover:bg-slate-50">{content}</Link> : <div key={row.id}>{content}</div>
      })}
    </div>
  )
}

function EmptyState() {
  return <p className="text-sm text-slate-600">Aucune donnee disponible.</p>
}

function formatValue(value: number, type: 'money' | 'number' | 'percent') {
  if (type === 'money') return formatMoney(value)
  if (type === 'percent') return `${Number(value ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
  return formatNumber(value)
}
