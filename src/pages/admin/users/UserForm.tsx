import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { roleLabels, userRoles, userUpdateSchema } from '../../../lib/validation'
import type { Profile } from '../../../lib/validation'
import type { z } from 'zod'
import { getProfileLocationIds } from '../../../api/modules/users.api'
import { listLocations } from '../../../api/modules/catalog.api'
import type { Location } from '../../../lib/catalog'

type UserUpdateForm = z.infer<typeof userUpdateSchema>

type UserFormProps = {
  user: Profile
  onClose: () => void
  onSave: (values: UserUpdateForm & { locationIds: string[] }) => Promise<void>
}

export function UserForm({ user, onClose, onSave }: UserFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = useForm<UserUpdateForm>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: { role: user.role, status: user.status === 'inactive' ? 'inactive' : 'active' },
  })
  const [locations, setLocations] = useState<Location[]>([])
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [loadingLocations, setLoadingLocations] = useState(true)
  const [locationsLoadFailed, setLocationsLoadFailed] = useState(false)
  const selectedRole = useWatch({ control, name: 'role' })

  useEffect(() => {
    reset({ role: user.role, status: user.status === 'inactive' ? 'inactive' : 'active' })
    let cancelled = false
    setLoadingLocations(true)
    setLocationsLoadFailed(false)
    Promise.all([listLocations('', true), getProfileLocationIds(user.id)])
      .then(([loadedLocations, assignedIds]) => {
        if (cancelled) return
        setLocations(loadedLocations)
        setLocationIds(assignedIds)
      })
      .catch(() => {
        if (!cancelled) setLocationsLoadFailed(true)
      })
      .finally(() => { if (!cancelled) setLoadingLocations(false) })
    return () => { cancelled = true }
  }, [reset, user])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit((values) => onSave({ ...values, locationIds }))} className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="eyebrow">Utilisateur</p>
          <h2 className="mt-2 text-xl font-bold text-[#132b67]">Modifier le compte</h2>
          <p className="mt-2 truncate text-sm text-slate-600">{user.email}</p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <label className="block">
            <span className="field-label">Role</span>
            <select {...register('role')} className="input mt-2">
              {userRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">Stocks / localisations autorisés</span>
            <div className="mt-2 max-h-52 space-y-2 overflow-y-auto rounded-md border border-slate-300 p-3">
              {locations.map((location) => {
                const selected = locationIds.includes(location.id)
                return <label key={location.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={selected} disabled={loadingLocations || selectedRole === 'direction' || selectedRole === 'controleur' || (location.is_active === false && !selected)} onChange={(event) => setLocationIds((current) => event.target.checked ? [...current, location.id] : current.filter((id) => id !== location.id))} />
                  <span>{location.name}{location.is_active === false ? ' (inactive — accès suspendu)' : ''}</span>
                </label>
              })}
              {!loadingLocations && locations.length === 0 && <p className="text-sm text-slate-500">Aucune localisation.</p>}
            </div>
            <span className="mt-1 block text-xs text-slate-500">
              {loadingLocations ? 'Chargement des localisations…' : locationsLoadFailed ? 'Les affectations n’ont pas pu être chargées. Réessayez avant d’enregistrer.' : selectedRole === 'direction' ? 'Direction accède à toutes les localisations.' : selectedRole === 'controleur' ? 'Le Contrôleur consulte tous les stocks; ses opérations restent limitées aux droits de son rôle.' : 'Sélectionnez une ou plusieurs localisations. Sans affectation, aucun stock localisé n’est accessible.'}
            </span>
          </label>

          <label className="block">
            <span className="field-label">Statut</span>
            <select {...register('status')} className="input mt-2">
              <option value="active">Compte actif</option>
              <option value="inactive">Compte desactive</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-3 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={isSubmitting || loadingLocations || locationsLoadFailed} className="btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  )
}
