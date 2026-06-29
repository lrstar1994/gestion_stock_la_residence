import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { roleLabels, roleSchema, userRoles } from '../../lib/validation'
import type { Profile } from '../../lib/validation'
import type { z } from 'zod'

type ValidationForm = z.infer<typeof roleSchema>

type UserValidationModalProps = {
  user: Profile
  onClose: () => void
  onValidate: (role: ValidationForm['role']) => Promise<void>
}

export function UserValidationModal({ user, onClose, onValidate }: UserValidationModalProps) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ValidationForm>({
    resolver: zodResolver(roleSchema),
    defaultValues: { role: 'consultation' },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit((values) => onValidate(values.role))} className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="eyebrow">Validation</p>
          <h2 className="mt-2 text-xl font-bold text-[#132b67]">Valider le compte</h2>
          <p className="mt-2 text-sm text-slate-600">{user.full_name} recevra le role selectionne.</p>
        </div>

        <div className="px-6 py-5">
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
        </div>

        <div className="flex justify-end gap-3 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            Valider
          </button>
        </div>
      </form>
    </div>
  )
}
