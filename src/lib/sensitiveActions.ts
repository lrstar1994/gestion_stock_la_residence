import type { UserRole } from './validation'

export const sensitivePermissions = {
  manualStockMovement: 'stock.manual.validate',
  retroactiveTransfer: 'stock.transfers.validate_sensitive',
  validateInventory: 'inventories.validate',
  validateInventoryAdjustment: 'stock_corrections.validate_from_inventory',
  updateArticleUnit: 'items.sensitive_update.validate',
  updateArticleConversion: 'items.conversion.update',
  mergeReferential: 'referentials.merge',
  deleteReferential: 'referentials.delete_unused',
} as const

export type SensitivePermission = (typeof sensitivePermissions)[keyof typeof sensitivePermissions]

const rolePermissions: Partial<Record<UserRole, SensitivePermission[]>> = {
  direction: Object.values(sensitivePermissions),
}

export function hasSensitivePermission(role: UserRole | undefined, permission: SensitivePermission) {
  return Boolean(role && rolePermissions[role]?.includes(permission))
}

export const personalPinSchema = {
  minLength: 4,
  maxLength: 8,
  pattern: /^[0-9]{4,8}$/,
}

export function validatePersonalPin(pin: string) {
  return personalPinSchema.pattern.test(pin)
}

