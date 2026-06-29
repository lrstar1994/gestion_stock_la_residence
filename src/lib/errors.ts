export function getErrorMessage(error: unknown, fallback = 'Une erreur est survenue. Veuillez reessayer.') {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}
