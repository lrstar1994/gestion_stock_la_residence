import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleLabels } from '../lib/validation'
import { canViewSuppliers } from '../lib/suppliers'

const navItems = [
  { to: '/dashboard', label: 'Tableau de bord' },
  { to: '/dashboard/purchases', label: 'Dashboard achats' },
  { to: '/dashboard/stock', label: 'Dashboard stock' },
  { to: '/dashboard/sales', label: 'Dashboard ventes' },
  { to: '/dashboard/finance', label: 'Dashboard finance' },
  { to: '/articles', label: 'Articles' },
  { to: '/recipes', label: 'Fiches techniques' },
  { to: '/events', label: 'Evenements' },
  { to: '/purchase-needs', label: "Besoins d'achat" },
  { to: '/cash-purchases', label: 'Achats especes' },
  { to: '/purchase-orders', label: 'Commandes' },
  { to: '/receptions', label: 'Receptions' },
  { to: '/stock', label: 'Stock' },
  { to: '/stock/stock-out', label: 'Sorties stock' },
  { to: '/inventories', label: 'Inventaires' },
  { to: '/invoices', label: 'Factures' },
  { to: '/sales', label: 'Ventes' },
  { to: '/profile', label: 'Mon profil' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center rounded-md px-3 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-white text-[#1E3A8A] shadow-sm'
      : 'text-blue-50 hover:bg-white/10 hover:text-white'
  }`

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <aside className="fixed inset-x-0 top-0 z-20 border-b border-blue-950/20 bg-[#10285f] text-white lg:inset-y-0 lg:right-auto lg:w-72 lg:border-b-0">
        <div className="flex h-full min-h-0 flex-col px-4 py-4 lg:px-5 lg:py-6">
          <Link to="/dashboard" className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#D4AF37]/40 bg-[#D4AF37] text-lg font-black text-[#10285f]">
              LR
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
                La Residence
              </span>
              <span className="block truncate text-base font-bold">Stock & Production</span>
            </span>
          </Link>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1 lg:pb-4">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
            {profile?.role === 'direction' && (
              <>
                <NavLink to="/admin/families" className={linkClass}>
                  Familles
                </NavLink>
                <NavLink to="/admin/units" className={linkClass}>
                  Unites
                </NavLink>
                <NavLink to="/admin/locations" className={linkClass}>
                  Localisations
                </NavLink>
                <NavLink to="/admin/users" className={linkClass}>
                  Utilisateurs
                </NavLink>
                <NavLink to="/audit/inter-modules" className={linkClass}>
                  Audit inter-modules
                </NavLink>
              </>
            )}
            {canViewSuppliers(profile?.role) && (
              <NavLink to="/admin/suppliers" className={linkClass}>
                Fournisseurs
              </NavLink>
            )}
          </div>

          <div className="mt-auto hidden shrink-0 border-t border-white/10 pt-5 lg:block">
            <div className="mb-4 rounded-md bg-white/[0.08] p-3">
              <p className="truncate text-sm font-semibold">{profile?.full_name}</p>
              <p className="mt-1 text-xs text-blue-100">
                {profile ? roleLabels[profile.role] : 'Utilisateur'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-secondary w-full border-white/20 bg-white/10 text-white hover:bg-white hover:text-[#1E3A8A]"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </aside>

      <main className="px-4 pb-24 pt-28 sm:px-6 lg:ml-72 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur lg:hidden">
        <button type="button" onClick={handleLogout} className="btn-primary w-full">
          Deconnexion
        </button>
      </div>
    </div>
  )
}
