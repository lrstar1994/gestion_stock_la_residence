import type { Profile } from './validation'

export const nonPurchaseDisbursementCategories = ['operations', 'personnel', 'remboursement', 'administration', 'fiscalite', 'divers', 'transfert_interne'] as const
export const nonPurchaseDisbursementStatuses = ['draft', 'pending_direction', 'approved', 'cash_given', 'justified', 'closed', 'refused', 'cancelled'] as const
export const nonPurchaseDisbursementTypes = [
  'avance_personnel', 'remboursement_client', 'remboursement_employe', 'paiement_prestataire',
  'frais_administratifs_fiscaux', 'maintenance_reparation', 'transport_deplacement',
  'transfert_interne', 'exception_direction', 'regularisation', 'sans_justificatif', 'annulation_retour',
] as const
export const paymentModes = ['especes', 'cheque', 'virement', 'mvola', 'autre'] as const
export const supportingDocumentStatuses = ['present', 'manquant', 'a_regulariser'] as const

export type NonPurchaseDisbursementCategory = (typeof nonPurchaseDisbursementCategories)[number]
export type NonPurchaseDisbursementStatus = (typeof nonPurchaseDisbursementStatuses)[number]
export type NonPurchaseDisbursementType = (typeof nonPurchaseDisbursementTypes)[number]
export type PaymentMode = (typeof paymentModes)[number]
export type SupportingDocumentStatus = (typeof supportingDocumentStatuses)[number]

export const nonPurchaseDisbursementTypeLabels: Record<NonPurchaseDisbursementType, string> = {
  avance_personnel: 'Avance au personnel', remboursement_client: 'Remboursement client',
  remboursement_employe: "Remboursement d'une depense faite par un employe",
  paiement_prestataire: 'Paiement fournisseur / prestataire sans marchandises',
  frais_administratifs_fiscaux: 'Frais administratifs / fiscaux',
  maintenance_reparation: 'Maintenance / reparation sans entree stock',
  transport_deplacement: 'Transport / course / deplacement', transfert_interne: 'Transfert interne de caisse',
  exception_direction: 'Decaissement exceptionnel Direction', regularisation: "Regularisation d'un decaissement deja fait",
  sans_justificatif: 'Decaissement sans justificatif immediat', annulation_retour: "Annulation / retour d'argent",
}

export const nonPurchaseDisbursementStatusLabels: Record<NonPurchaseDisbursementStatus, string> = {
  draft: 'Brouillon', pending_direction: 'En attente Direction', approved: 'Valide - Caisse a decaisser',
  cash_given: 'Decaissement effectue', justified: 'Justificatif recu', closed: 'Classe',
  refused: 'Refuse', cancelled: 'Annule',
}

export const paymentModeLabels: Record<PaymentMode, string> = { especes: 'Especes', cheque: 'Cheque', virement: 'Virement', mvola: 'MVola', autre: 'Autre' }
export const supportingDocumentStatusLabels: Record<SupportingDocumentStatus, string> = { present: 'Present', manquant: 'Justificatif manquant / a regulariser', a_regulariser: 'A regulariser' }

export type NonPurchaseMetadata = {
  type: NonPurchaseDisbursementType
  beneficiary: string
  paymentMode: PaymentMode
  service: string
  supportingDocumentStatus: SupportingDocumentStatus
  supportingDocumentPath?: string
  supportingDocumentName?: string
  comment: string
  validationRequired: boolean
}

export type NonPurchaseDisbursement = {
  id: string; reference: string; category: NonPurchaseDisbursementCategory; cash_source: string; request_date: string
  requested_by: string | null; reason: string; amount_requested: number; amount_validated: number | null
  amount_given: number | null; amount_justified: number | null; status: NonPurchaseDisbursementStatus
  validation_comment: string | null; created_at: string; updated_at: string
  requester?: Pick<Profile, 'id' | 'full_name' | 'role'> | null; metadata: NonPurchaseMetadata
}

export type NonPurchaseDisbursementFormValues = NonPurchaseMetadata & {
  category: NonPurchaseDisbursementCategory; cashSource: string; actualDate: string; reason: string; amount: number
}

export function parseNonPurchaseMetadata(value?: string | null): NonPurchaseMetadata {
  const fallback: NonPurchaseMetadata = { type: 'exception_direction', beneficiary: '', paymentMode: 'especes', service: '', supportingDocumentStatus: 'manquant', comment: '', validationRequired: true }
  if (!value) return fallback
  try { return { ...fallback, ...(JSON.parse(value) as Partial<NonPurchaseMetadata>) } } catch { return fallback }
}

export function getDisbursementRelay(item: Pick<NonPurchaseDisbursement, 'status' | 'metadata'>) {
  if (item.status === 'pending_direction') return { stage: 'Validation Direction', owner: 'Direction', action: 'Valider ou refuser le decaissement.', nextOwner: 'Caisse', classification: 'Non classe' }
  if (item.status === 'approved') return { stage: 'Decaissement effectif', owner: 'Caisse', action: 'Effectuer le paiement et confirmer la sortie.', nextOwner: 'Caisse / Controle', classification: 'Non classe' }
  if (item.status === 'cash_given' && item.metadata.supportingDocumentStatus !== 'present') return { stage: 'Regularisation du justificatif', owner: 'Caisse / Controle', action: 'Joindre et controler le justificatif manquant.', nextOwner: 'Direction / Controle final', classification: 'Non classe - a regulariser' }
  if (item.status === 'cash_given') return { stage: 'Justificatif / classement', owner: 'Caisse / Controle', action: 'Controler la piece et classer le dossier.', nextOwner: 'Direction / Controle final', classification: 'A classer' }
  if (item.status === 'justified') return { stage: 'Cloture', owner: 'Direction / Controle final', action: 'Cloturer le dossier ou signaler une anomalie.', nextOwner: 'Dossier classe', classification: 'A classer' }
  if (item.status === 'closed') return { stage: 'Dossier cloture', owner: 'Aucun', action: 'Aucune action attendue.', nextOwner: 'Aucun', classification: 'Classe' }
  return { stage: 'Saisie du decaissement', owner: 'Demandeur / Direction', action: 'Completer puis soumettre le dossier.', nextOwner: 'Direction', classification: 'Non classe' }
}
