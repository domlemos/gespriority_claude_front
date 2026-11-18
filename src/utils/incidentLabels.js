import { t } from '@/plugins/i18n'
import { formatDurationMinutes } from '@/utils/duration'

const GROUPS = {
  prioridade: ['baixa', 'media', 'alta', 'urgente'],
  status: [
    'aberto',
    'em_andamento',
    'pendente',
    'aguardando_interno',
    'aguardando_externo',
    'resolvido',
    'fechado',
    'cancelado',
  ],
  origem: ['portal', 'email', 'telefone', 'chat', 'presencial', 'monitoramento'],
  tipo: ['incidente', 'solicitacao'],
}

// Tradução de `labels.<grupo>.<code>`; sem chave, devolve o próprio código.
function labelOf(group, code) {
  if (code === null || code === undefined) return code
  const key = `labels.${group}.${code}`
  const text = t(key)
  return text === key ? code : text
}

function optionsOf(group) {
  return GROUPS[group].map((value) => ({ value, title: labelOf(group, value) }))
}

export const prioridadeLabel = (code) => labelOf('prioridade', code)
export const statusLabel = (code) => labelOf('status', code)
export const origemLabel = (code) => labelOf('origem', code)
export const tipoLabel = (code) => labelOf('tipo', code)
export const slaStatusLabel = (code) => labelOf('slaStatus', code)

export const prioridadeOptions = () => optionsOf('prioridade')
export const statusOptions = () => optionsOf('status')
export const origemOptions = () => optionsOf('origem')
export const tipoOptions = () => optionsOf('tipo')

export const PRIORIDADE_COLORS = {
  baixa: 'secondary',
  media: 'info',
  alta: 'warning',
  urgente: 'error',
}

export const STATUS_COLORS = {
  aberto: 'info',
  em_andamento: 'primary',
  pendente: 'warning',
  aguardando_interno: 'deep-purple',
  aguardando_externo: 'orange-darken-2',
  resolvido: 'success',
  fechado: 'default',
  cancelado: 'error',
}

export const TIPO_COLORS = {
  incidente: 'default',
  solicitacao: 'info',
}

export const SLA_STATUS_COLORS = {
  dentro_prazo: 'success',
  estourado: 'error',
  sem_sla: 'default',
}

export function formatRemainingMinutes(minutes) {
  if (minutes === null || minutes === undefined) return null

  const duration = formatDurationMinutes(Math.abs(minutes))

  return minutes < 0
    ? t('labels.remaining.late', { duration })
    : t('labels.remaining.left', { duration })
}
