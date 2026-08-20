function pluralize(value, singular, plural) {
  return value === 1 ? singular : plural
}

function joinParts(parts) {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
}

export function formatDurationMinutes(minutes) {
  const abs = Math.max(0, Math.round(minutes ?? 0))
  const days = Math.floor(abs / 1440)
  const hours = Math.floor((abs % 1440) / 60)
  const mins = abs % 60

  const parts = []
  if (days > 0) parts.push(`${days} ${pluralize(days, 'dia', 'dias')}`)
  if (hours > 0) parts.push(`${hours} ${pluralize(hours, 'hora', 'horas')}`)
  if (mins > 0 || parts.length === 0) parts.push(`${mins} ${pluralize(mins, 'minuto', 'minutos')}`)

  return joinParts(parts)
}
