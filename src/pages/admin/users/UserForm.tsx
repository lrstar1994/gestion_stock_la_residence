import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { roleLabels, userRoles, userUpdateSchema } from '../../../lib/validation'
import type { Profile } from '../../../lib/validation'
import type { z } from 'zod'

type UserUpdateForm = z.infer<typeof userUpdateSchema>

type UserFormProps = {
  user: Profile
  onClose: () => void
  onSave: (values: UserUpdateForm) => Promise<void>
}

export function UserForm({ user, onClose, onSave }: UserFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<UserUpdateForm>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: { role: user.role, status: user.status === 'inactive' ? 'inactive' : 'active' },
  })

  useEffect(() => {
    reset({ role: user.role, status: user.status === 'inactive' ? 'inactive' : 'active' })
  }, [reset, user])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit(onSave)} className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl">
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
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  )
}
