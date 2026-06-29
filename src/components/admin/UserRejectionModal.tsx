import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { rejectionSchema } from '../../lib/validation'
import type { Profile } from '../../lib/validation'
import type { z } from 'zod'

type RejectionForm = z.infer<typeof rejectionSchema>

type UserRejectionModalProps = {
  user: Profile
  onClose: () => void
  onReject: (reason: string) => Promise<void>
}

export function UserRejectionModal({ user, onClose, onReject }: UserRejectionModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RejectionForm>({ resolver: zodResolver(rejectionSchema) })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit((values) => onReject(values.reason))} className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="eyebrow">Refus</p>
          <h2 className="mt-2 text-xl font-bold text-[#132b67]">Refuser le compte</h2>
          <p className="mt-2 text-sm text-slate-600">Compte concerne : {user.full_name}</p>
        </div>

        <div className="px-6 py-5">
          <label className="block">
            <span className="field-label">Motif du refus</span>
            <textarea {...register('reason')} rows={4} className="input mt-2 resize-none" />
            {errors.reason?.message && <span className="mt-2 block text-sm text-red-600">{errors.reason.message}</span>}
          </label>
        </div>

        <div className="flex justify-end gap-3 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-danger">
            Refuser
          </button>
        </div>
      </form>
    </div>
  )
}
