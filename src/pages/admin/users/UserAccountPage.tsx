import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getProfileLocations, getUserById, updateUser } from '../../../api/modules/users.api'
import { UserPinResetModal } from '../../../components/admin/UserPinResetModal'
import { useAuth } from '../../../hooks/useAuth'
import { roleLabels, statusLabels } from '../../../lib/validation'
import type { Profile } from '../../../lib/validation'
import type { Location } from '../../../lib/catalog'
import { UserDetail } from './UserDetail'
import { UserForm } from './UserForm'

export function UserAccountPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [user, setUser] = useState<Profile | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [resetPinOpen, setResetPinOpen] = useState(false)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [loadedUser, loadedLocations] = await Promise.all([getUserById(id), getProfileLocations(id)])
      setUser(loadedUser)
      setLocations(loadedLocations)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger la fiche utilisateur.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void reload() }, [reload])

  const save = async (values: { role: Profile['role']; status: 'active' | 'inactive'; locationIds: string[] }) => {
    if (!user) return
    try {
      await updateUser(user.id, values)
      toast.success('Utilisateur mis à jour.')
      setEditing(false)
      await reload()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Mise à jour impossible.')
    }
  }

  if (loading) return <div className="surface p-8 text-sm text-slate-600">Chargement de la fiche utilisateur…</div>
  if (error || !user) return <div className="space-y-4"><Link to="/admin/users" className="text-sm font-semibold text-[#1E3A8A]">← Utilisateurs</Link><div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error ?? 'Utilisateur introuvable.'}</div></div>

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/admin/users" className="text-sm font-semibold text-[#1E3A8A] hover:underline">← Utilisateurs</Link>
          <p className="eyebrow mt-4">Administration</p>
          <h1 className="page-title mt-2">Fiche utilisateur</h1>
          <p className="mt-2 text-sm text-slate-600">{user.full_name} · {user.email}</p>
        </div>
        <div className="flex gap-2">
          {profile?.status === 'active' && profile.role === 'direction' && user.id !== profile.id && <>
            <button type="button" onClick={() => setResetPinOpen(true)} className="btn-secondary">Réinitialiser PIN</button>
            <button type="button" onClick={() => setEditing(true)} className="btn-primary">Modifier</button>
          </>}
        </div>
      </header>

      <section className="surface space-y-5 p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Compte et accès</h2>
          <UserDetail user={user} />
          <p className="mt-4 text-sm text-slate-700"><strong>Rôle :</strong> {roleLabels[user.role]} · <strong>Statut :</strong> {statusLabels[user.status]}</p>
          <p className="mt-2 text-sm text-slate-700"><strong>Stocks / localisations autorisés :</strong> {user.role === 'direction' ? 'Toutes les localisations (accès global Direction)' : user.role === 'controleur' ? 'Lecture globale STOCK selon le rôle Contrôleur' : locations.length ? locations.map((location) => location.name).join(', ') : 'Aucune affectation active'}</p>
          <p className="mt-2 text-xs text-slate-500">Créé le {new Date(user.created_at).toLocaleString('fr-FR')}</p>
        </div>
      </section>

      {editing && <UserForm user={user} onClose={() => setEditing(false)} onSave={save} />}
      {resetPinOpen && <UserPinResetModal user={user} onClose={() => setResetPinOpen(false)} />}
    </div>
  )
}
