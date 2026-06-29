import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { listUsers, rejectUser, updateUser, validateUser } from '../../../api/modules/users.api'
import { UserRejectionModal } from '../../../components/admin/UserRejectionModal'
import { UserValidationModal } from '../../../components/admin/UserValidationModal'
import { useAuth } from '../../../hooks/useAuth'
import { roleLabels, statusLabels, userRoles, userStatuses } from '../../../lib/validation'
import type { Profile, UserRole, UserStatus } from '../../../lib/validation'
import { UserDetail } from './UserDetail'
import { UserForm } from './UserForm'

type ModalState =
  | { type: 'validate'; user: Profile }
  | { type: 'reject'; user: Profile }
  | { type: 'edit'; user: Profile }
  | null

const statusClasses: Record<UserStatus, string> = {
  pending_validation: 'bg-amber-50 text-amber-800 ring-amber-200',
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  inactive: 'bg-slate-100 text-slate-700 ring-slate-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
}

export function UsersList() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<UserStatus | 'all'>('all')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const filters = useMemo(() => ({ status, role, search }), [role, search, status])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await listUsers(filters))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleValidate = async (roleToApply: UserRole) => {
    if (!profile || modal?.type !== 'validate') {
      return
    }

    try {
      await validateUser(modal.user.id, roleToApply, profile.id)
      toast.success('Le compte a ete valide avec succes.')
      setModal(null)
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Validation impossible')
    }
  }

  const handleReject = async (reason: string) => {
    if (modal?.type !== 'reject') {
      return
    }

    try {
      await rejectUser(modal.user.id, reason)
      toast.success('Le compte a ete refuse.')
      setModal(null)
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refus impossible')
    }
  }

  const handleUpdate = async (values: { role: UserRole; status: 'active' | 'inactive' }) => {
    if (modal?.type !== 'edit') {
      return
    }

    try {
      await updateUser(modal.user.id, values)
      toast.success('Utilisateur mis a jour.')
      setModal(null)
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise a jour impossible')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Direction</p>
          <h1 className="page-title mt-2">Gestion des utilisateurs</h1>
          <p className="mt-2 text-sm text-slate-600">
            Validez les demandes, attribuez les roles et controlez les acces.
          </p>
        </div>
        <div className="surface px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-bold text-[#1E3A8A]">{users.length}</p>
        </div>
      </header>

      <section className="surface p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <label>
            <span className="field-label sr-only">Recherche</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input"
              placeholder="Rechercher par email ou nom"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value as UserStatus | 'all')} className="input">
            <option value="all">Tous les statuts</option>
            {userStatuses.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole | 'all')} className="input">
            <option value="all">Tous les roles</option>
            {userRoles.map((item) => (
              <option key={item} value={item}>
                {roleLabels[item]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="hidden grid-cols-[1.25fr_1fr_170px_150px_260px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid">
          <span>Email</span>
          <span>Nom complet</span>
          <span>Inscription</span>
          <span>Statut</span>
          <span>Role et actions</span>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-slate-600">Chargement des utilisateurs...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-sm text-slate-600">Aucun utilisateur trouve.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {users.map((user) => (
              <article key={user.id} className="px-5 py-4 transition hover:bg-slate-50/70">
                <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr_170px_150px_260px] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{user.email}</p>
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                      className="mt-1 text-sm font-semibold text-[#1E3A8A] hover:text-blue-950"
                    >
                      {expandedUserId === user.id ? 'Masquer les details' : 'Voir les details'}
                    </button>
                  </div>

                  <p className="text-sm font-medium text-slate-700">{user.full_name}</p>
                  <p className="text-sm text-slate-600">{new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClasses[user.status]}`}>
                    {statusLabels[user.status]}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#1E3A8A]">
                      {roleLabels[user.role]}
                    </span>
                    {user.status === 'pending_validation' ? (
                      <>
                        <button type="button" onClick={() => setModal({ type: 'validate', user })} className="btn-primary px-3 py-2">
                          Valider
                        </button>
                        <button type="button" onClick={() => setModal({ type: 'reject', user })} className="btn-secondary border-red-200 text-red-700 hover:bg-red-50">
                          Refuser
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setModal({ type: 'edit', user })} className="btn-secondary px-3 py-2">
                        Modifier
                      </button>
                    )}
                  </div>
                </div>

                {expandedUserId === user.id && (
                  <div className="mt-4">
                    <UserDetail user={user} />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {modal?.type === 'validate' && <UserValidationModal user={modal.user} onClose={() => setModal(null)} onValidate={handleValidate} />}
      {modal?.type === 'reject' && <UserRejectionModal user={modal.user} onClose={() => setModal(null)} onReject={handleReject} />}
      {modal?.type === 'edit' && <UserForm user={modal.user} onClose={() => setModal(null)} onSave={handleUpdate} />}
    </div>
  )
}
