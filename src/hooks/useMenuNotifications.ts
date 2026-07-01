import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getMenuNotificationCounts } from '../api/modules/menuNotifications.api'
import type { MenuNotificationCounts } from '../api/modules/menuNotifications.api'
import type { UserRole } from '../lib/validation'

export function useMenuNotifications(role?: UserRole) {
  const location = useLocation()
  const [counts, setCounts] = useState<MenuNotificationCounts>({})

  const load = useCallback(async () => {
    if (!role) {
      setCounts({})
      return
    }
    setCounts(await getMenuNotificationCounts(role))
  }, [role])

  useEffect(() => {
    load().catch(() => setCounts({}))
  }, [load, location.pathname])

  useEffect(() => {
    const timer = window.setInterval(() => {
      load().catch(() => setCounts({}))
    }, 60000)
    return () => window.clearInterval(timer)
  }, [load])

  return counts
}
