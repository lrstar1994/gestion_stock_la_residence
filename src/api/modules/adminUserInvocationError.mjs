function isRecord(value) {
  return typeof value === 'object' && value !== null
}

async function readResponseBody(context) {
  if (!isRecord(context)) return null

  if (typeof context.text === 'function') {
    try {
      const text = await context.text()
      if (!text) return null
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    } catch {
      return null
    }
  }

  if (typeof context.json === 'function') {
    try {
      return await context.json()
    } catch {
      return null
    }
  }

  return null
}

/** Extracts a useful Edge Function error without assuming context is a Response. */
export async function getAdminUserInvocationErrorMessage(error) {
  const context = isRecord(error) ? error.context : null
  const body = await readResponseBody(context)

  if (isRecord(body)) {
    if (typeof body.error === 'string' && body.error.trim()) return body.error
    if (typeof body.message === 'string' && body.message.trim()) return body.message
  }
  if (typeof body === 'string' && body.trim()) return body

  if (isRecord(context) && context instanceof Error && context.message) return context.message
  if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) return error.message
  if (isRecord(context) && typeof context.message === 'string' && context.message.trim()) return context.message
  return 'Une erreur inconnue est survenue pendant l’invitation.'
}
