import type { DashboardPeriod, DateRange } from '../../lib/dashboard'

export function DashboardControls({
  period,
  range,
  onPeriodChange,
  onRangeChange,
  onRefresh,
}: {
  period: DashboardPeriod
  range: DateRange
  onPeriodChange: (period: DashboardPeriod) => void
  onRangeChange: (range: DateRange) => void
  onRefresh: () => void
}) {
  return (
    <section className="surface grid gap-3 p-4 md:grid-cols-[1fr_160px_160px_auto] md:items-end">
      <label>
        <span className="field-label">Periode</span>
        <select value={period} onChange={(event) => onPeriodChange(event.target.value as DashboardPeriod)} className="input mt-2">
          <option value="today">Aujourd'hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
          <option value="quarter">Ce trimestre</option>
          <option value="year">Cette annee</option>
          <option value="custom">Personnalisee</option>
        </select>
      </label>
      <label>
        <span className="field-label">Du</span>
        <input type="date" value={range.from} onChange={(event) => onRangeChange({ ...range, from: event.target.value })} disabled={period !== 'custom'} className="input mt-2" />
      </label>
      <label>
        <span className="field-label">Au</span>
        <input type="date" value={range.to} onChange={(event) => onRangeChange({ ...range, to: event.target.value })} disabled={period !== 'custom'} className="input mt-2" />
      </label>
      <button type="button" onClick={onRefresh} className="btn-secondary">Actualiser</button>
    </section>
  )
}
