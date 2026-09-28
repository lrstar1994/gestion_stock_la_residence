import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleLabels } from '../lib/validation'
import { useMenuNotifications } from '../hooks/useMenuNotifications'
import { canViewSuppliers } from '../lib/suppliers'
import { navigationGroups, type NavigationItem } from './AppLayout'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-white text-[#1E3A8A] shadow-sm'
      : 'text-blue-50 hover:bg-white/10 hover:text-white'
  }`

function routeMatchesItem(pathname: string, item: NavigationItem) {
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const notifications = useMenuNotifications(profile?.role)

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.directionOnly && profile?.role !== 'direction') return false
        if (item.supplierAccess && !canViewSuppliers(profile?.role)) return false
        if (item.roles && (!profile?.role || !item.roles.includes(profile.role))) return false
        if (profile?.role && item.hiddenForRoles?.includes(profile.role)) return false
        return true
      }),
    }))
    .filter((group) => group.items.length > 0)

  const isAccueilRoute =
    visibleGroups
      .find((group) => group.title === 'Accueil')
      ?.items.some((item) => routeMatchesItem(location.pathname, item)) ?? false

  const matchingAccordionTitles = visibleGroups
    .filter((group) => group.title !== 'Accueil')
    .filter((group) => group.items.some((item) => routeMatchesItem(location.pathname, item)))
    .map((group) => group.title)

  const defaultAccordionTitle = isAccueilRoute ? null : matchingAccordionTitles[0] ?? null
  const matchingAccordionKey = matchingAccordionTitles.join('|')
  const [openGroup, setOpenGroup] = useState<string | null>(defaultAccordionTitle)

  useEffect(() => {
    setOpenGroup((current) => {
      if (current && matchingAccordionTitles.includes(current)) return current
      return defaultAccordionTitle
    })
  }, [location.pathname, defaultAccordionTitle, matchingAccordionKey])

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
                La Résidence
              </span>
              <span className="block truncate text-base font-bold">Stock & Production</span>
            </span>
          </Link>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1 lg:pb-4">
            {visibleGroups.map((group) => {
              const isAccueil = group.title === 'Accueil'
              const isOpen = isAccueil || openGroup === group.title

              return (
                <div key={group.title} className="flex shrink-0 gap-2 lg:block lg:space-y-1">
                  {isAccueil ? (
                    <p className="hidden px-3 pb-1 pt-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#D4AF37] lg:block">
                      {group.title}
                    </p>
                  ) : (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenGroup((current) => (current === group.title ? null : group.title))}
                      className="hidden w-full items-center justify-between rounded-md px-3 pb-1 pt-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#D4AF37] hover:bg-white/[0.06] lg:flex"
                    >
                      <span>{group.title}</span>
                      <span aria-hidden="true" className="ml-2 text-sm leading-none">
                        {isOpen ? '⌄' : '›'}
                      </span>
                    </button>
                  )}

                  <div className={`${isOpen ? 'contents lg:block' : 'contents lg:hidden'} lg:space-y-1`}>
                    {group.items.map((item) => (
                      <NavLink
                        key={`${group.title}-${item.label}-${item.to}`}
                        to={item.to}
                        end={item.end}
                        onClick={() => !isAccueil && setOpenGroup(group.title)}
                        className={linkClass}
                      >
                        <span className="truncate">{item.label}</span>
                        <MenuBadge count={notifications[item.to]} />
                      </NavLink>
                    ))}
                  </div>
                </div>
              )
            })}
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
              Déconnexion
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
          Déconnexion
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
