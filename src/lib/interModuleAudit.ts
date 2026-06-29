export type AuditSeverity = 'critical' | 'warning' | 'info'

export type AuditStatus = 'ok' | 'attention'

export type AuditIssue = {
  id: string
  module: string
  severity: AuditSeverity
  title: string
  description: string
  sourceLabel: string
  sourcePath: string
  targetLabel?: string
  targetPath?: string
}

export type AuditSection = {
  key: string
  title: string
  description: string
  status: AuditStatus
  issues: AuditIssue[]
}

export type InterModuleAudit = {
  generatedAt: string
  totalIssues: number
  criticalIssues: number
  warningIssues: number
  sections: AuditSection[]
}

export const severityLabels: Record<AuditSeverity, string> = {
  critical: 'Critique',
  warning: 'A verifier',
  info: 'Info',
}
