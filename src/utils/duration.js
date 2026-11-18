import { t } from '@/plugins/i18n'

function joinParts(parts) {
  if (parts.length <= 1) return parts.join('')
  return t('duration.list', {
    rest: parts.slice(0, -1).join(', '),
    last: parts[parts.length - 1],
  })
}

export function formatDurationMinutes(minutes) {
  const abs = Math.max(0, Math.round(minutes ?? 0))
  const days = Math.floor(abs / 1440)
  const hours = Math.floor((abs % 1440) / 60)
  const mins = abs % 60

  const parts = []
  if (days > 0) parts.push(t('duration.days', days))
  if (hours > 0) parts.push(t('duration.hours', hours))
  if (mins > 0 || parts.length === 0) parts.push(t('duration.minutes', mins))

  return joinParts(parts)
}
