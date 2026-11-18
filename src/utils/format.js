import { currentLocale } from '@/plugins/i18n'

export function formatDateTime(value, options) {
  return new Date(value).toLocaleString(currentLocale(), options)
}

export function formatDate(value, options) {
  return new Date(value).toLocaleDateString(currentLocale(), options)
}

export function formatNumber(value, options) {
  return Number(value).toLocaleString(currentLocale(), options)
}
