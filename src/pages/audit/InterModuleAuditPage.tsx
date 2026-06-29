import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { getInterModuleAudit } from '../../api/modules/interModuleAudit.api'
import { severityLabels } from '../../lib/interModuleAudit'
import type { AuditIssue, InterModuleAudit } from '../../lib/interModuleAudit'

export function InterModuleAuditPage() {
  const [audit, setAudit] = useState<InterModuleAudit | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setAudit(await getInterModuleAudit())
    } catch {
      toast.error("Impossible de charger l'audit inter-modules.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !audit) return <p className="surface p-6 text-sm text-slate-600">Chargement de l'audit...</p>
  if (!audit) return <p className="surface p-6 text-sm text-slate-600">Audit indisponible.</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Controle Direction</p>
          <h1 className="page-title mt-2">Audit inter-modules</h1>
          <p className="mt-2 text-sm text-slate-600">Derniere verification : {new Date(audit.generatedAt).toLocaleString('fr-FR')}</p>
        </div>
        <button type="button" onClick={load} className="btn-primary"><RefreshCw className="mr-2 h-4 w-4" /> Actualiser</button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Problemes detectes" value={String(audit.totalIssues)} />
        <Metric label="Critiques" value={String(audit.criticalIssues)} tone="red" />
        <Metric label="A verifier" value={String(audit.warningIssues)} tone="amber" />
      </section>

      <section className="surface border border-blue-100 bg-blue-50 p-5">
        <h2 className="font-bold text-blue-950">Chaines consolidees</h2>
        <p className="mt-2 text-sm leading-6 text-blue-900">
          Besoins vers commandes, commandes vers receptions, receptions vers stock et factures, ventes vers sorties stock, sorties vers mouvements, inventaires vers corrections stock.
        </p>
      </section>

      <div className="space-y-4">
        {audit.sections.map((section) => (
          <section key={section.key} className="surface overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {section.status === 'ok' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                  <h2 className="font-bold text-slate-950">{section.title}</h2>
                </div>
                <p className="mt-1 text-sm text-slate-600">{section.description}</p>
              </div>
              <span className={section.status === 'ok' ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700' : 'rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700'}>
                {section.status === 'ok' ? 'OK' : `${section.issues.length} point(s)`}
              </span>
            </div>
            <div className="divide-y divide-slate-200">
              {section.issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
              {section.issues.length === 0 && <p className="p-5 text-sm text-slate-600">Aucune anomalie detectee.</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function IssueRow({ issue }: { issue: AuditIssue }) {
  const color = issue.severity === 'critical' ? 'bg-red-50 text-red-700' : issue.severity === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
  return (
    <div className="grid gap-3 px-5 py-4 xl:grid-cols-[150px_1fr_220px] xl:items-center">
      <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${color}`}>{severityLabels[issue.severity]}</span>
      <div>
        <p className="font-bold text-slate-950">{issue.title}</p>
        <p className="mt-1 text-sm text-slate-600">{issue.description}</p>
      </div>
      <div className="flex flex-wrap gap-2 xl:justify-end">
        <Link to={issue.sourcePath} className="btn-secondary">{issue.sourceLabel}</Link>
        {issue.targetPath && <Link to={issue.targetPath} className="btn-secondary">{issue.targetLabel ?? 'Voir'}</Link>}
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'blue' }: { label: string; value: string; tone?: 'blue' | 'red' | 'amber' }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-[#1E3A8A]'
  return <div className="surface p-5"><p className="text-sm text-slate-500">{label}</p><p className={`mt-1 text-2xl font-black ${color}`}>{value}</p></div>
}
