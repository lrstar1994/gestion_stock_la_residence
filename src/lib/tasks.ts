import type { UserRole } from './validation'

export type UserTaskCategory = 'achats' | 'caisse' | 'stock' | 'inventaires' | 'articles' | 'receptions' | 'factures'
export type UserTaskPriority = 'haute' | 'normale' | 'basse'

export type UserTask = {
  id: string
  category: UserTaskCategory
  title: string
  description: string
  status: string
  priority: UserTaskPriority
  targetUrl: string
  source: string
  reference: string
  responsible: string
  expectedAction: string
  nextResponsible?: string
  nextStatus?: string
  alert?: string
  requiresPin?: boolean
  validationTask?: boolean
}

export const userTaskCategoryLabels: Record<UserTaskCategory, string> = {
  achats: 'Achats',
  caisse: 'Caisse',
  stock: 'Stock',
  inventaires: 'Inventaires',
  articles: 'Articles',
  receptions: 'Reception marchandises',
  factures: 'Factures',
}

export const userTaskPriorityLabels: Record<UserTaskPriority, string> = {
  haute: 'Haute',
  normale: 'Normale',
  basse: 'Basse',
}

export function sortUserTasks(tasks: UserTask[]) {
  const priorityOrder: Record<UserTaskPriority, number> = { haute: 0, normale: 1, basse: 2 }
  return [...tasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.title.localeCompare(b.title))
}

export function canSeeOperationalTasks(role?: UserRole) {
  return Boolean(role && role !== 'consultation')
}
