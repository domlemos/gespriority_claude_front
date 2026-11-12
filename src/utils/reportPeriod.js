// Período e quebra dos relatórios (abas Indicadores e Avançado): opções dos
// controles e a validação de limite de colunas, com as mesmas mensagens do backend.

export const QUEBRA_OPTIONS = [
  { value: 'nenhuma', title: 'Não' },
  { value: 'dia', title: 'Dia' },
  { value: 'semana', title: 'Semana' },
  { value: 'mes', title: 'Mês' },
]
export const QUEBRA_NOMES = { dia: 'dia', semana: 'semana', mes: 'mês' }
export const QUEBRA_LIMITES = { dia: 62, semana: 53, mes: 24 }

export const PERIODO_OPTIONS = [
  { value: 'este_mes', title: 'Este mês' },
  { value: 'mes_passado', title: 'Mês passado' },
  { value: 'ultimos_7_dias', title: 'Últimos 7 dias' },
  { value: 'personalizado', title: 'Personalizado' },
]

export function parseDia(valor) {
  const [y, m, d] = valor.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

// Número de colunas que a quebra geraria no período personalizado. Os atalhos
// nunca estouram o limite (no máximo ~31 dias), então só o personalizado é checado.
export function contarColunas(inicio, fim, tipoQuebra) {
  const DIA = 86400000
  const ini = parseDia(inicio)
  const end = parseDia(fim)
  if (tipoQuebra === 'dia') return Math.floor((end - ini) / DIA) + 1
  if (tipoQuebra === 'semana') {
    const segunda = (t) => t - ((new Date(t).getUTCDay() + 6) % 7) * DIA
    return Math.round((segunda(end) - segunda(ini)) / (7 * DIA)) + 1
  }
  const i = new Date(ini)
  const f = new Date(end)
  return (f.getUTCFullYear() - i.getUTCFullYear()) * 12 + f.getUTCMonth() - i.getUTCMonth() + 1
}

// Mesmas mensagens do backend, mostradas antes de enviar. '' = válido.
export function validarQuebra({ quebra, periodoAtalho, dataInicio, dataFim }) {
  if (quebra === 'nenhuma') return ''
  const nome = QUEBRA_NOMES[quebra]
  const personalizado = periodoAtalho === 'personalizado'
  const temPeriodo = personalizado ? dataInicio && dataFim : periodoAtalho
  if (!temPeriodo) return `Informe um período para quebrar por ${nome}.`
  if (personalizado && parseDia(dataFim) >= parseDia(dataInicio)) {
    const limite = QUEBRA_LIMITES[quebra]
    if (contarColunas(dataInicio, dataFim, quebra) > limite) {
      return `Período longo demais para quebra por ${nome}: máximo de ${limite} colunas.`
    }
  }
  return ''
}

// Parâmetros de período da requisição: atalho e datas são mutuamente exclusivos no backend.
export function paramsPeriodo({ periodoAtalho, dataInicio, dataFim }) {
  if (periodoAtalho === 'personalizado') {
    const params = {}
    if (dataInicio) params.data_inicio = dataInicio
    if (dataFim) params.data_fim = dataFim
    return params
  }
  return periodoAtalho ? { periodo: periodoAtalho } : {}
}
