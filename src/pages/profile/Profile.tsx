import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { updateOwnProfile } from '../../api/modules/users.api'
import { useAuth } from '../../hooks/useAuth'
import { profileSchema, roleLabels, statusLabels } from '../../lib/validation'
import type { z } from 'zod'

type ProfileForm = z.infer<typeof profileSchema>

export function Profile() {
  const { profile, refreshProfile } = useAuth()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: profile?.full_name ?? '' },
  })

  useEffect(() => {
    reset({ fullName: profile?.full_name ?? '' })
  }, [profile?.full_name, reset])

  const onSubmit = async (values: ProfileForm) => {
    if (!profile || profile.status !== 'active') {
      return
    }

    try {
      await updateOwnProfile(profile.id, values.fullName)
      await refreshProfile()
      toast.success('Profil mis a jour.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise a jour impossible')
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Mon profil</p>
        <h1 className="page-title mt-2">Informations personnelles</h1>
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="surface p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#1E3A8A] text-lg font-black text-white">
            {profile?.full_name?.slice(0, 2).toUpperCase() ?? 'LR'}
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">{profile?.full_name}</h2>
          <p className="mt-1 text-sm text-slate-500">{profile?.email}</p>

          <dl className="mt-6 space-y-4">
            <Info label="Role" value={profile ? roleLabels[profile.role] : '-'} />
            <Info label="Statut" value={profile ? statusLabels[profile.status] : '-'} />
          </dl>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="surface p-6">
          <p className="eyebrow">Edition</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Nom complet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Le nom peut etre modifie uniquement lorsque le compte est actif.
          </p>

          <label className="mt-6 block">
            <span className="field-label">Nom complet</span>
            <input {...register('fullName')} disabled={profile?.status !== 'active'} className="input mt-2" />
            {errors.fullName?.message && <span className="mt-2 block text-sm text-red-600">{errors.fullName.message}</span>}
          </label>

          <button type="submit" disabled={isSubmitting || profile?.status !== 'active'} className="btn-primary mt-6">
            Enregistrer
          </button>
        </form>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
