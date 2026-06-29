import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getDirectionDashboard } from '../../api/modules/dashboard.api'
import type { DashboardPeriod, DateRange, DirectionDashboard } from '../../lib/dashboard'

const today = new Date().toISOString().slice(0, 10)

export function useDirectionDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [range, setRange] = useState<DateRange>({ from: today.slice(0, 8) + '01', to: today })
  const [dashboard, setDashboard] = useState<DirectionDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setDashboard(await getDirectionDashboard({ period, from: range.from, to: range.to }))
    } catch {
      toast.error('Impossible de charger le tableau de bord.')
    } finally {
      setLoading(false)
    }
  }, [period, range.from, range.to])

  useEffect(() => {
    load()
  }, [load])

  return { dashboard, loading, period, range, setPeriod, setRange, load }
}
