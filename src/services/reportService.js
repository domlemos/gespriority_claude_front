import api from '@/services/api'

// Rótulos de agrupamento (capitalizados) dos dois caminhos: o novo (`contar`) e
// os nomes legados, que ainda aparecem em relatórios salvos antes da Fase 2.
export const AGRUPAMENTO_LABELS = {
  analista: 'Analista',
  grupo_analista: 'Grupo do analista',
  grupo_chamado: 'Grupo de Solução',
  categoria: 'Categoria',
  subcategoria: 'Subcategoria',
  item: 'Item',
  cliente: 'Cliente',
  tipo: 'Tipo',
  status_sla: 'Status de SLA',
  responsavel: 'Responsável',
  aberto_por: 'Quem abriu',
  quem_encaminhou: 'Quem encaminhou',
  para_grupo: 'Grupo de destino',
  para_responsavel: 'Responsável de destino',
  concluido_por: 'Concluído por (resolvido ou fechado)',
  resolvido_por: 'Resolvido por',
  fechado_por: 'Fechado por',
  encaminhado_por: 'Encaminhado por',
  encaminhado_para_grupo: 'Encaminhado para (grupo)',
  encaminhado_para_responsavel: 'Encaminhado para (responsável)',
  grupo_solucao: 'Grupo de Solução',
}

// Com `responseType: 'blob'` o corpo do 422 também chega como Blob; converte
// de volta para JSON para que `extractErrorMessage` leia `errors`/`message`.
async function parseBlobError(error) {
  const data = error?.response?.data
  if (data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await data.text())
    } catch {
      // corpo não-JSON: mantém o erro como veio
    }
  }
  throw error
}

export default {
  gerar(params = {}) {
    if (params.formato === 'xlsx') {
      return api
        .get('/relatorios/incidentes', { params, responseType: 'blob' })
        .then((res) => res.data)
        .catch(parseBlobError)
    }
    return api.get('/relatorios/incidentes', { params }).then((res) => res.data)
  },
  // Lista de chamados por trás de uma linha/célula do relatório.
  chamados(params = {}) {
    if (params.formato === 'xlsx') {
      return api
        .get('/relatorios/chamados', { params, responseType: 'blob' })
        .then((res) => res.data)
        .catch(parseBlobError)
    }
    return api.get('/relatorios/chamados', { params }).then((res) => res.data)
  },
  // Indicadores por grupo: abertos, resolvidos, fechados e cancelados por grupo
  // de solução (ou por integrante de um grupo).
  indicadores(params = {}) {
    if (params.formato === 'xlsx') {
      return api
        .get('/relatorios/indicadores', { params, responseType: 'blob' })
        .then((res) => res.data)
        .catch(parseBlobError)
    }
    return api.get('/relatorios/indicadores', { params }).then((res) => res.data)
  },
  // Lista de chamados por trás de uma célula dos indicadores (linha × indicador [× coluna]).
  indicadoresChamados(params = {}) {
    if (params.formato === 'xlsx') {
      return api
        .get('/relatorios/indicadores/chamados', { params, responseType: 'blob' })
        .then((res) => res.data)
        .catch(parseBlobError)
    }
    return api.get('/relatorios/indicadores/chamados', { params }).then((res) => res.data)
  },
  // Mapa de fluxos: passagens entre o cliente e os grupos no período, com os
  // números de cada grupo (`formato: 'xlsx'` devolve a planilha).
  fluxos(params = {}) {
    if (params.formato === 'xlsx') {
      return api
        .get('/relatorios/fluxos', { params, responseType: 'blob' })
        .then((res) => res.data)
        .catch(parseBlobError)
    }
    return api.get('/relatorios/fluxos', { params }).then((res) => res.data)
  },
  // Lista de chamados por trás de um número do mapa (`no` + `metrica`) ou de uma seta (`origem` + `destino`).
  fluxosChamados(params = {}) {
    if (params.formato === 'xlsx') {
      return api
        .get('/relatorios/fluxos/chamados', { params, responseType: 'blob' })
        .then((res) => res.data)
        .catch(parseBlobError)
    }
    return api.get('/relatorios/fluxos/chamados', { params }).then((res) => res.data)
  },
  listSaved(params = {}) {
    return api.get('/relatorios-salvos', { params }).then((res) => res.data)
  },
  createSaved(payload) {
    return api.post('/relatorios-salvos', payload).then((res) => res.data.data)
  },
  removeSaved(id) {
    return api.delete(`/relatorios-salvos/${id}`)
  },
  executarSaved(id, formato = 'json') {
    if (formato === 'xlsx') {
      return api
        .get(`/relatorios-salvos/${id}/executar`, { params: { formato }, responseType: 'blob' })
        .then((res) => res.data)
        .catch(parseBlobError)
    }
    return api.get(`/relatorios-salvos/${id}/executar`, { params: { formato } }).then((res) => res.data)
  },
}
