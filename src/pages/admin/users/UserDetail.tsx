import { roleLabels, statusLabels } from '../../../lib/validation'
import type { Profile } from '../../../lib/validation'

export function UserDetail({ user }: { user: Profile }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Email" value={user.email} />
        <Info label="Nom complet" value={user.full_name} />
        <Info label="Role" value={roleLabels[user.role]} />
        <Info label="Statut" value={statusLabels[user.status]} />
        <Info label="Date d'inscription" value={new Date(user.created_at).toLocaleDateString('fr-FR')} />
        {user.rejection_reason && <Info label="Motif du refus" value={user.rejection_reason} />}
      </dl>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
