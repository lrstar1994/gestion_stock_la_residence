const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateCreateUserPayload(input, allowedRoles) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Corps de requête invalide.' }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : ''
  const role = typeof input.role === 'string' ? input.role : ''
  const status = input.status
  const locationIds = input.location_ids
  const directionPin = typeof input.direction_pin === 'string' ? input.direction_pin : null

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Adresse e-mail invalide.' }
  if (fullName.length < 2 || fullName.length > 160) return { error: 'Le nom complet doit contenir de 2 à 160 caractères.' }
  if (!Array.isArray(allowedRoles) || !allowedRoles.includes(role)) return { error: 'Rôle invalide.' }
  if (status !== 'active' && status !== 'inactive') return { error: 'Statut utilisateur invalide.' }
  if (!Array.isArray(locationIds) || locationIds.length > 100 || !locationIds.every((id) => typeof id === 'string' && UUID_PATTERN.test(id))) {
    return { error: 'La liste des localisations est invalide.' }
  }
  if (new Set(locationIds).size !== locationIds.length) return { error: 'Une localisation est sélectionnée plusieurs fois.' }
  if ((role === 'direction' || role === 'controleur') && locationIds.length > 0) {
    return { error: 'Direction et Contrôleur ne nécessitent pas d’affectation de localisation.' }
  }
  if (role === 'direction' && (directionPin === null || !/^\d{4,8}$/.test(directionPin))) {
    return { error: 'Le PIN Direction (4 à 8 chiffres) est requis pour créer un autre profil Direction.' }
  }

  return {
    value: {
      email,
      fullName,
      role,
      status,
      locationIds,
      directionPin: role === 'direction' ? directionPin : null,
    },
  }
}

export function isDuplicateAuthEmailError(error) {
  return error?.status === 422 || /already|exists|registered|duplicate/i.test(error?.message ?? '')
}
