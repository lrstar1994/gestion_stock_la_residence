import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { createAdminUser, listUserCreationRoles } from '../../../api/modules/users.api'
import { listLocationsForUserAssignment } from '../../../api/modules/catalog.api'
import type { Location } from '../../../lib/catalog'
import { roleLabels } from '../../../lib/validation'
import type { UserRole } from '../../../lib/validation'

const stockOperationalRoles = new Set<UserRole>(['magasinier', 'chef_cuisine', 'point_vente', 'acheteur', 'fiche_technique', 'maintenance'])

export function UserCreatePage() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState<UserRole[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [referencesLoading, setReferencesLoading] = useState(true)
  const [rolesError, setRolesError] = useState<string | null>(null)
  const [locationsError, setLocationsError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [directionPin, setDirectionPin] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReferencesLoading(true)
    setRolesError(null)
    setLocationsError(null)
    const describeError = (error: unknown) => {
      const value = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
      const code = typeof value?.code === 'string' ? `${value.code}: ` : ''
      const message = typeof value?.message === 'string' ? value.message : error instanceof Error ? error.message : String(error)
      const details = typeof value?.details === 'string' && value.details ? ` — ${value.details}` : ''
      const hint = typeof value?.hint === 'string' && value.hint ? ` (${value.hint})` : ''
      return `${code}${message}${details}${hint}`
    }

    void Promise.allSettled([listUserCreationRoles(), listLocationsForUserAssignment()])
      .then(([roleResult, locationResult]) => {
        if (cancelled) return
        if (roleResult.status === 'fulfilled') {
          const acceptedRoles = roleResult.value as UserRole[]
          setRoles(acceptedRoles)
          setRole((current) => current && acceptedRoles.includes(current) ? current : acceptedRoles[0] ?? '')
        } else {
          const message = describeError(roleResult.reason)
          setRolesError(message)
          if (import.meta.env.DEV) console.error('[UserCreatePage] Chargement des rôles échoué', roleResult.reason)
        }

        if (locationResult.status === 'fulfilled') {
          setLocations(locationResult.value.filter((location) => location.is_active !== false))
        } else {
          const message = describeError(locationResult.reason)
          setLocationsError(message)
          if (import.meta.env.DEV) console.error('[UserCreatePage] Chargement des localisations échoué', locationResult.reason)
        }
      })
      .finally(() => { if (!cancelled) setReferencesLoading(false) })
    return () => { cancelled = true }
  }, [])

  const currentRole = role || undefined
  const usesGlobalStockRead = currentRole === 'direction' || currentRole === 'controleur'
  const needsStockLocation = currentRole ? stockOperationalRoles.has(currentRole) : false
  const noStockLocationWarning = useMemo(() => needsStockLocation && locationIds.length === 0, [locationIds.length, needsStockLocation])

  const toggleLocation = (locationId: string, checked: boolean) => {
    setLocationIds((current) => checked
      ? current.includes(locationId) ? current : [...current, locationId]
      : current.filter((id) => id !== locationId))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!role) return toast.error('Sélectionnez un rôle.')
    if (rolesError) return toast.error('Impossible de créer le profil tant que le référentiel des rôles est indisponible.')
    if (locationsError && stockOperationalRoles.has(role)) return toast.error('Impossible d’affecter ce rôle opérationnel tant que les localisations ne sont pas chargées.')
    if (!fullName.trim()) return toast.error('Le nom complet est obligatoire.')
    if (!email.trim()) return toast.error('L’e-mail est obligatoire.')
    if (role === 'direction' && !/^\d{4,8}$/.test(directionPin)) return toast.error('Le PIN Direction doit contenir 4 à 8 chiffres.')
    if (usesGlobalStockRead && locationIds.length) return toast.error('Direction et Contrôleur utilisent la portée globale définie par leur rôle.')

    setSaving(true)
    try {
      const result = await createAdminUser({
        email: email.trim(),
        fullName: fullName.trim(),
        role,
        status,
        locationIds: usesGlobalStockRead ? [] : locationIds,
        ...(role === 'direction' ? { directionPin } : {}),
      })
      setDirectionPin('')
      toast.success('Utilisateur créé. Une invitation de définition du mot de passe a été envoyée par e-mail.')
      navigate(`/admin/users/${result.profileId}`, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'La création de l’utilisateur a échoué.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link to="/admin/users" className="text-sm font-semibold text-[#1E3A8A] hover:underline">← Utilisateurs</Link>
        <p className="eyebrow mt-4">Administration</p>
        <h1 className="page-title mt-2">Ajouter un utilisateur</h1>
        <p className="mt-2 text-sm text-slate-600">Un e-mail d’invitation permettra à la personne de choisir son mot de passe. Son PIN personnel sera défini séparément depuis son profil.</p>
      </header>

      <form onSubmit={submit} className="surface space-y-6 p-6">
        {rolesError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Chargement des rôles impossible : {rolesError}</div>}
        {locationsError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Chargement des localisations impossible : {locationsError}</div>}
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="field-label">Nom complet *</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="input mt-2" autoComplete="name" required maxLength={160} />
          </label>
          <label className="block">
            <span className="field-label">E-mail *</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="input mt-2" autoComplete="email" required />
          </label>
          <label className="block">
            <span className="field-label">Rôle *</span>
            <select value={role} onChange={(event) => { setRole(event.target.value as UserRole); if (event.target.value === 'direction' || event.target.value === 'controleur') setLocationIds([]) }} className="input mt-2" required disabled={referencesLoading || roles.length === 0}>
              {roles.map((item) => <option key={item} value={item}>{roleLabels[item] ?? item}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="field-label">Statut *</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')} className="input mt-2">
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </label>
        </div>

        <fieldset disabled={referencesLoading || usesGlobalStockRead} className="rounded-md border border-slate-200 p-4 disabled:opacity-70">
          <legend className="px-1 text-sm font-semibold text-slate-800">Localisations STOCK autorisées</legend>
          {usesGlobalStockRead ? (
            <p className="text-sm text-slate-600">{role === 'direction' ? 'Direction voit toutes les localisations sans affectation.' : 'Contrôleur conserve la lecture globale STOCK selon son rôle; cela ne lui accorde pas de droit générique d’écriture.'}</p>
          ) : role === 'caisse' || role === 'consultation' ? (
            <p className="mb-3 text-sm text-slate-600">L’affectation est facultative pour ce rôle. Aucune localisation n’est attribuée automatiquement.</p>
          ) : (
            <p className="mb-3 text-sm text-slate-600">Les localisations sélectionnées sont indépendantes du rôle. Sans affectation, ce profil n’aura accès à aucun stock localisé.</p>
          )}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {locations.map((location) => (
              <label key={location.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={locationIds.includes(location.id)} onChange={(event) => toggleLocation(location.id, event.target.checked)} />
                {location.name}
              </label>
            ))}
            {!referencesLoading && locations.length === 0 && <p className="text-sm text-slate-500">Aucune localisation active disponible.</p>}
          </div>
          {noStockLocationWarning && <p role="status" className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Attention : ce rôle opérationnel n’aura aucun accès STOCK tant qu’aucune localisation ne lui est affectée.</p>}
        </fieldset>

        {role === 'direction' && <label className="block max-w-sm">
          <span className="field-label">PIN personnel Direction *</span>
          <input value={directionPin} onChange={(event) => setDirectionPin(event.target.value.replace(/\D/g, '').slice(0, 8))} type="password" inputMode="numeric" autoComplete="new-password" className="input mt-2" minLength={4} maxLength={8} required />
          <span className="mt-1 block text-xs text-slate-500">Une validation sensible protège la création d’un autre profil Direction. Le PIN n’est jamais journalisé.</span>
        </label>}

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          <Link to="/admin/users" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={saving || referencesLoading || Boolean(rolesError) || !role} className="btn-primary">
            {saving ? 'Création et invitation…' : 'Créer et envoyer l’invitation'}
          </button>
        </div>
      </form>
    </div>
  )
}
