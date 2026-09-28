import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getMyPinStatus, setMyPersonalPin } from '../../api/modules/sensitiveActions.api'
import type { PinStatus } from '../../api/modules/sensitiveActions.api'
import { updateOwnProfile } from '../../api/modules/users.api'
import { useAuth } from '../../hooks/useAuth'
import { validatePersonalPin } from '../../lib/sensitiveActions'
import { profileSchema, roleLabels, statusLabels } from '../../lib/validation'
import type { z } from 'zod'

type ProfileForm = z.infer<typeof profileSchema>

export function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null)
  const [pinStatusLoading, setPinStatusLoading] = useState(true)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)
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

  useEffect(() => {
    if (profile?.status !== 'active') {
      setPinStatusLoading(false)
      return
    }
    setPinStatusLoading(true)
    getMyPinStatus()
      .then(setPinStatus)
      .catch(() => setPinStatus(null))
      .finally(() => setPinStatusLoading(false))
  }, [profile?.id, profile?.status])

  const onSubmit = async (values: ProfileForm) => {
    if (!profile || profile.status !== 'active') {
      return
    }

    try {
      await updateOwnProfile(profile.id, values.fullName)
      await refreshProfile()
      toast.success('Profil mis à jour.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise a jour impossible')
    }
  }

  const savePin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (savingPin || pinStatusLoading || pinStatus === null || profile?.status !== 'active') return
    if (!validatePersonalPin(newPin)) {
      toast.error('Le PIN doit contenir entre 4 et 8 chiffres.')
      return
    }
    if (newPin !== confirmPin) {
      toast.error('Les deux nouveaux PIN ne correspondent pas.')
      return
    }
    const hasExistingPin = pinStatus?.pin_defined === true
    if (hasExistingPin && !validatePersonalPin(currentPin)) {
      toast.error('Le PIN actuel est obligatoire pour modifier votre PIN.')
      return
    }
    setSavingPin(true)
    try {
      await setMyPersonalPin(newPin, hasExistingPin ? currentPin : undefined)
      setPinStatus(await getMyPinStatus())
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      toast.success(pinStatus?.pin_defined ? 'PIN personnel modifié.' : 'PIN personnel défini.')
    } catch {
      toast.error('Définition du PIN non confirmée. Vérifiez le PIN actuel et la connexion, puis rechargez Mon profil.')
    } finally {
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setSavingPin(false)
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
            <Info label="Rôle" value={profile ? roleLabels[profile.role] : '-'} />
            <Info label="Statut" value={profile ? statusLabels[profile.status] : '-'} />
            <Info label="PIN personnel" value={pinStatusLoading ? 'Chargement…' : pinStatus === null ? 'Indisponible' : pinStatus.pin_defined ? 'Défini' : 'Non défini'} />
          </dl>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="surface p-6">
          <p className="eyebrow">Édition</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Nom complet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Le nom peut être modifié uniquement lorsque le compte est actif.
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

      <section className="surface p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-blue-50 p-2 text-[#1E3A8A]"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <p className="eyebrow">Sécurité</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">PIN personnel</h2>
            <p className="mt-2 text-sm text-slate-600">
              Statut : <strong>{pinStatusLoading ? 'chargement…' : pinStatus === null ? 'indisponible' : pinStatus.pin_defined ? 'défini' : 'non défini'}</strong>. Le PIN est demandé uniquement au moment d’une action sensible, en complément de vos permissions.
            </p>
          </div>
        </div>

        {!pinStatusLoading && pinStatus?.pin_defined === false && <p className="mt-4 text-sm font-semibold text-amber-800">Votre PIN personnel doit être défini avant toute action sensible.</p>}
        {pinStatus?.pin_defined && <p className="mt-4 text-sm text-slate-600">PIN oublié ? Demandez sa réinitialisation à la Direction, puis ouvrez à nouveau Mon profil pour définir votre nouveau PIN.</p>}
        {!pinStatusLoading && pinStatus === null && <p role="alert" className="mt-4 text-sm text-red-700">Impossible de vérifier votre PIN. Rechargez la page avant de continuer.</p>}
        <form onSubmit={savePin} className="mt-5 grid gap-4 md:grid-cols-3">
          {!pinStatusLoading && pinStatus?.pin_defined === true && (
            <label className="block">
              <span className="field-label">PIN actuel</span>
              <input type="password" inputMode="numeric" autoComplete="off" value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 8))} className="input mt-2" />
            </label>
          )}
          <label className="block">
            <span className="field-label">Nouveau PIN (4 à 8 chiffres)</span>
            <input type="password" inputMode="numeric" autoComplete="off" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 8))} className="input mt-2" />
          </label>
          <label className="block">
            <span className="field-label">Confirmer le nouveau PIN</span>
            <input type="password" inputMode="numeric" autoComplete="off" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 8))} className="input mt-2" />
          </label>
          <div className="md:col-span-3">
            <button type="submit" disabled={savingPin || pinStatusLoading || pinStatus === null || profile?.status !== 'active'} className="btn-primary">
              {pinStatus?.pin_defined ? 'Modifier mon PIN' : 'Définir mon PIN'}
            </button>
            <p className="mt-3 text-xs text-slate-500">Le serveur conserve uniquement un hash bcrypt. Le PIN n’est jamais renvoyé à l’application, journalisé ou inclus dans un export.</p>
          </div>
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
