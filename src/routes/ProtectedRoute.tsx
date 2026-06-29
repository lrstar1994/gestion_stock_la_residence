import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../lib/validation'

type ProtectedRouteProps = {
  allowedRoles?: UserRole[]
  requireActive?: boolean
}

export function ProtectedRoute({ allowedRoles, requireActive = true }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading || (user && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4 text-slate-700">
        <div className="surface px-5 py-4 text-sm font-semibold">
          Chargement...
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (profile?.status === 'pending_validation') {
    return <Navigate to="/pending" replace />
  }

  if (requireActive && profile?.status !== 'active') {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
