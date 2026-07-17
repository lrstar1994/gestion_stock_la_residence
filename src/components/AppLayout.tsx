import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleLabels } from '../lib/validation'
import type { UserRole } from '../lib/validation'
import { canViewSuppliers } from '../lib/suppliers'
import { useMenuNotifications } from '../hooks/useMenuNotifications'

type NavigationItem = {
  to: string
  label: string
  directionOnly?: boolean
  supplierAccess?: boolean
  roles?: UserRole[]
}

type NavigationGroup = {
  title: string
  items: NavigationItem[]
}

const navigationGroups: NavigationGroup[] = [
  {
    title: 'Accueil',
    items: [
      { to: '/dashboard', label: 'Tableau de bord' },
      { to: '/validations/my', label: 'Mes validations', directionOnly: true },
      { to: '/profile', label: 'Mon profil' },
    ],
  },
  {
    title: 'Achats',
    items: [
      { to: '/purchases/new', label: 'Nouvel achat', roles: ['direction', 'chef_cuisine', 'fiche_technique', 'magasinier', 'maintenance'] },
      { to: '/purchase-needs', label: 'Mes demandes' },
      { to: '/purchases/tracking', label: 'Suivi des achats' },
      { to: '/receptions', label: 'Receptions' },
      { to: '/invoices', label: 'Factures fournisseurs' },
      { to: '/admin/suppliers', label: 'Fournisseurs', supplierAccess: true },
      { to: '/purchases/tracking', label: 'Historique achats' },
      { to: '/cash-purchases/report', label: 'Rapport journalier des decaissements' },
    ],
  },
  {
    title: 'Stock & inventaires',
    items: [
      { to: '/stock', label: 'Stock actuel' },
      { to: '/stock/movements', label: 'Entrees / sorties / transferts' },
      { to: '/stock/stock-out', label: 'Sorties stock' },
      { to: '/inventories', label: 'Inventaires' },
      { to: '/stock/movements/manual/new', label: 'Corrections de stock', roles: ['direction', 'magasinier'] },
      { to: '/stock/movements', label: 'Journal des mouvements' },
    ],
  },
  {
    title: 'Articles & referentiels stock',
    items: [
      { to: '/articles', label: 'Articles' },
      { to: '/admin/families', label: 'Categories', directionOnly: true },
      { to: '/admin/sub-categories', label: 'Sous-categories', directionOnly: true },
      { to: '/admin/units', label: 'Unites', directionOnly: true },
      { to: '/admin/locations', label: 'Localisations', directionOnly: true },
    ],
  },
  {
    title: 'Fiches techniques & production',
    items: [
      { to: '/recipes', label: 'Fiches techniques' },
      { to: '/recipes/pending-ingredients', label: 'Ingredients a rapprocher', roles: ['direction', 'chef_cuisine', 'fiche_technique'] },
      { to: '/recipes', label: 'Recettes a valider' },
      { to: '/events', label: 'Evenements' },
    ],
  },
  {
    title: 'Ventes',
    items: [
      { to: '/sales', label: 'Ventes' },
      { to: '/sales/stats', label: 'Statistiques ventes' },
      { to: '/articles', label: 'Produits vendables' },
    ],
  },
  {
    title: 'Tableaux de bord',
    items: [
      { to: '/dashboard', label: 'Dashboard Direction' },
      { to: '/dashboard/purchases', label: 'Dashboard achats' },
      { to: '/dashboard/stock', label: 'Dashboard stock' },
      { to: '/dashboard/sales', label: 'Dashboard ventes' },
      { to: '/dashboard/finance', label: 'Dashboard finance' },
      { to: '/audit/inter-modules', label: 'Controle V1', directionOnly: true },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/admin/users', label: 'Utilisateurs', directionOnly: true },
      { to: '/audit/inter-modules', label: 'Audit', directionOnly: true },
    ],
  },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-white text-[#1E3A8A] shadow-sm'
      : 'text-blue-50 hover:bg-white/10 hover:text-white'
  }`

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const notifications = useMenuNotifications(profile?.role)
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.directionOnly && profile?.role !== 'direction') return false
        if (item.supplierAccess && !canViewSuppliers(profile?.role)) return false
        if (item.roles && (!profile?.role || !item.roles.includes(profile.role))) return false
        return true
      }),
    }))
    .filter((group) => group.items.length > 0)

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
            {visibleGroups.map((group) => (
              <div key={group.title} className="flex shrink-0 gap-2 lg:block lg:space-y-1">
                <p className="hidden px-3 pb-1 pt-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#D4AF37] lg:block">
                  {group.title}
                </p>
                {group.items.map((item) => (
                  <NavLink key={`${group.title}-${item.label}-${item.to}`} to={item.to} className={linkClass}>
                    <span className="truncate">{item.label}</span>
                    <MenuBadge count={notifications[item.to]} />
                  </NavLink>
                ))}
              </div>
            ))}
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

function MenuBadge({ count }: { count?: number }) {
  if (!count) return null
  return (
    <span className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] px-1.5 py-0.5 text-[11px] font-black leading-none text-[#10285f]">
      {count > 99 ? '99+' : count}
    </span>
  )
}
