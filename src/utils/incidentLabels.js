export const PRIORIDADE_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const PRIORIDADE_COLORS = {
  baixa: 'secondary',
  media: 'info',
  alta: 'warning',
  urgente: 'error',
}

export const STATUS_LABELS = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  pendente: 'Pendente',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
  cancelado: 'Cancelado',
}

export const STATUS_COLORS = {
  aberto: 'info',
  em_andamento: 'primary',
  pendente: 'warning',
  resolvido: 'success',
  fechado: 'default',
  cancelado: 'error',
}

export const ORIGEM_LABELS = {
  portal: 'Portal',
  email: 'E-mail',
  telefone: 'Telefone',
  chat: 'Chat',
  presencial: 'Presencial',
  monitoramento: 'Monitoramento',
}

export const SLA_STATUS_LABELS = {
  dentro_prazo: 'Dentro do prazo',
  estourado: 'Fora do Prazo',
  sem_sla: 'Sem SLA',
}

export const SLA_STATUS_COLORS = {
  dentro_prazo: 'success',
  estourado: 'error',
  sem_sla: 'default',
}

import { formatDurationMinutes } from '@/utils/duration'

export function formatRemainingMinutes(minutes) {
  if (minutes === null || minutes === undefined) return null

  const duration = formatDurationMinutes(Math.abs(minutes))

  return minutes < 0 ? `Atrasado ${duration}` : `${duration} restantes`
}
