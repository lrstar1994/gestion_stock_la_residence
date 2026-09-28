import { ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { validatePersonalPin } from '../lib/sensitiveActions'

type SensitiveActionModalProps = {
  open: boolean
  title: string
  description: string
  permissionLabel: string
  pinDefined: boolean
  requireReason?: boolean
  busy?: boolean
  onCancel: () => void
  onConfirm: (values: { pin: string; reason: string }) => Promise<void> | void
  children?: ReactNode
}

export function SensitiveActionModal({
  open,
  title,
  description,
  permissionLabel,
  pinDefined,
  requireReason = false,
  busy = false,
  onCancel,
  onConfirm,
  children,
}: SensitiveActionModalProps) {
  const [pin, setPin] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setPin('')
      setReason('')
      setError('')
    }
  }, [open])

  if (!open) return null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!pinDefined) {
      setError('Définissez d’abord votre PIN personnel dans Mon profil.')
      return
    }
    if (!validatePersonalPin(pin)) {
      setError('Le PIN doit contenir entre 4 et 8 chiffres.')
      return
    }
    if (requireReason && !reason.trim()) {
      setError('Le motif est obligatoire pour cette action.')
      return
    }
    setError('')
    try {
      await onConfirm({ pin, reason: reason.trim() })
    } finally {
      setPin('')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="sensitive-action-title">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="rounded-full bg-blue-50 p-2 text-[#1E3A8A]"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <h2 id="sensitive-action-title" className="text-xl font-bold text-slate-950">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          Permission requise : <strong>{permissionLabel}</strong>. Le serveur contrôle la permission et le PIN dans la même transaction, puis crée un audit nominatif.
        </div>

        {!pinDefined && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            Aucun PIN personnel n’est défini. Cette action est bloquée.
          </p>
        )}

        {children}

        {requireReason && (
          <label className="mt-4 block">
            <span className="field-label">Motif obligatoire</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="input mt-2 min-h-20" autoComplete="off" />
          </label>
        )}

        <label className="mt-4 block">
          <span className="field-label">PIN personnel</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            minLength={4}
            maxLength={8}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
            className="input mt-2"
            autoComplete="off"
            aria-describedby="pin-confidentiality"
          />
          <span id="pin-confidentiality" className="mt-2 block text-xs text-slate-500">Le PIN n’est ni journalisé, ni exporté, ni conservé dans le navigateur.</span>
        </label>

        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={busy || !pinDefined} className="btn-primary">
            {busy ? 'Vérification…' : 'Confirmer l’action sensible'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
