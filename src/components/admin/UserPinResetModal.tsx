import { useState } from 'react'
import toast from 'react-hot-toast'
import { resetProfilePinForUser } from '../../api/modules/users.api'
import { validatePersonalPin } from '../../lib/sensitiveActions'
import type { Profile } from '../../lib/validation'

export function UserPinResetModal({ user, onClose }: { user: Profile; onClose: () => void }) {
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (!validatePersonalPin(pin)) {
      setErrorMessage('Votre PIN Direction doit contenir 4 à 8 chiffres.')
      return
    }
    setSaving(true)
    setErrorMessage('')
    try {
      await resetProfilePinForUser(user.id, pin)
      toast.success('Le PIN de cet utilisateur a été réinitialisé. Il devra définir un nouveau PIN dans Mon profil.')
      onClose()
    } catch {
      // Ne pas recopier une réponse technique qui pourrait contenir des paramètres.
      setErrorMessage('Réinitialisation non confirmée. Vérifiez votre PIN Direction, vos droits et la connexion. Une nouvelle tentative est sans danger.')
    } finally {
      setPin('')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="pin-reset-title" className="surface w-full max-w-lg space-y-4 p-6">
        <h2 id="pin-reset-title" className="text-xl font-bold">Réinitialiser le PIN</h2>
        <p className="text-sm">Utilisateur : <strong>{user.full_name}</strong> ({user.email}).</p>
        <p className="text-sm">L’ancien PIN sera invalidé. Le compte et la connexion email/mot de passe restent inchangés. Cet utilisateur devra définir lui-même un nouveau PIN dans Mon profil avant toute action sensible.</p>
        <label className="block">
          <span className="field-label">Votre PIN personnel Direction</span>
          <input autoFocus type="password" inputMode="numeric" autoComplete="off" required minLength={4} maxLength={8} pattern="[0-9]{4,8}" disabled={saving} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))} className="input mt-2" />
        </label>
        {errorMessage && <p role="alert" className="text-sm text-red-700">{errorMessage}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" disabled={saving} onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Réinitialisation…' : 'Confirmer la réinitialisation du PIN'}</button>
        </div>
      </form>
    </div>
  )
}
