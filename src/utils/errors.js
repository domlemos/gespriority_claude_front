import { t } from '@/plugins/i18n'

// Extrai uma mensagem amigável de um erro do axios vindo da API Laravel:
// - 422 (ValidationException): primeira mensagem de `errors`
// - 429 (throttle): mensagem de rate limit
// - 401/demais: `message` do corpo, ou um fallback genérico
export function extractErrorMessage(error, fallback = t('errors.generic')) {
  const status = error?.response?.status
  const data = error?.response?.data

  if (status === 429) {
    return t('errors.tooManyAttempts')
  }

  if (status === 422 && data?.errors) {
    const firstField = Object.values(data.errors)[0]
    return Array.isArray(firstField) ? firstField[0] : fallback
  }

  return data?.message ?? fallback
}
