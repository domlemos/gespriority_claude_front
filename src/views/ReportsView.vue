<script setup>
import { computed, onMounted, ref } from 'vue'
import { Chart as ChartJS, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Bar, Pie } from 'vue-chartjs'
import AppLayout from '@/layouts/AppLayout.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import reportService, { AGRUPAMENTO_LABELS } from '@/services/reportService'
import ReportResultTable from '@/components/reports/ReportResultTable.vue'
import clientService from '@/services/clientService'
import customerService from '@/services/customerService'
import categoryService from '@/services/categoryService'
import subcategoryService from '@/services/subcategoryService'
import itemService from '@/services/itemService'
import solutionGroupService from '@/services/solutionGroupService'
import userService from '@/services/userService'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/errors'
import { STATUS_LABELS, TIPO_LABELS } from '@/utils/incidentLabels'

ChartJS.register(...registerables, ChartDataLabels)

const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('relatorios.manage'))

const CONTAR_OPTIONS = [
  { value: 'abertos', title: 'Abertos' },
  { value: 'concluidos', title: 'Concluídos' },
  { value: 'resolvidos', title: 'Resolvidos' },
  { value: 'fechados', title: 'Fechados' },
  { value: 'cancelados', title: 'Cancelados' },
  { value: 'encaminhamentos', title: 'Encaminhamentos' },
]

// Matriz contar -> agrupamentos válidos (espelha o backend).
const AGRUPAR_POR_INCIDENTE = ['categoria', 'subcategoria', 'item', 'grupo_chamado', 'responsavel', 'aberto_por', 'cliente', 'tipo']
const AGRUPAR_POR_CONCLUSAO = ['analista', 'grupo_analista', 'grupo_chamado', 'categoria', 'subcategoria', 'item', 'cliente', 'tipo', 'status_sla']
const AGRUPAR_POR_CONTAR = {
  abertos: AGRUPAR_POR_INCIDENTE,
  cancelados: AGRUPAR_POR_INCIDENTE,
  concluidos: AGRUPAR_POR_CONCLUSAO,
  resolvidos: AGRUPAR_POR_CONCLUSAO,
  fechados: AGRUPAR_POR_CONCLUSAO,
  encaminhamentos: ['quem_encaminhou', 'para_grupo', 'para_responsavel'],
}

const QUEBRA_OPTIONS = [
  { value: 'nenhuma', title: 'Não' },
  { value: 'dia', title: 'Dia' },
  { value: 'semana', title: 'Semana' },
  { value: 'mes', title: 'Mês' },
]
const QUEBRA_NOMES = { dia: 'dia', semana: 'semana', mes: 'mês' }
const QUEBRA_LIMITES = { dia: 62, semana: 53, mes: 24 }

const PERIODO_OPTIONS = [
  { value: 'este_mes', title: 'Este mês' },
  { value: 'mes_passado', title: 'Mês passado' },
  { value: 'ultimos_7_dias', title: 'Últimos 7 dias' },
  { value: 'personalizado', title: 'Personalizado' },
]

const CHART_TYPE_OPTIONS = [
  { value: 'colunas', title: 'Colunas' },
  { value: 'barras', title: 'Barras' },
  { value: 'pizza', title: 'Pizza' },
]
const CHART_TYPE_OPTIONS_QUEBRA = CHART_TYPE_OPTIONS.filter((o) => o.value !== 'pizza')

const statusOptions = Object.entries(STATUS_LABELS).map(([value, title]) => ({ value, title }))
const tipoOptions = Object.entries(TIPO_LABELS).map(([value, title]) => ({ value, title }))

const PALETTE = ['#FF8C1A', '#7922B9', '#2563EB', '#166534', '#F59E0B', '#E53935', '#FFA64D', '#C371FF']

// --- saída ---
const chartType = ref('colunas')

// --- filtros ---
const contar = ref('abertos')
const agruparPor = ref(null)
const quebra = ref('nenhuma')
const periodoAtalho = ref(null) // este_mes | mes_passado | ultimos_7_dias | personalizado | null
const status = ref(null)
const tipo = ref(null)
const dataInicio = ref(null)
const dataFim = ref(null)
const clientId = ref(null)
const customerId = ref(null)
const categoriaId = ref(null)
const subcategoriaId = ref(null)
const itemId = ref(null)
const grupoSolucaoId = ref(null)
const grupoAnalistaId = ref(null)
const responsavelId = ref(null)

const agruparPorOptions = computed(() =>
  AGRUPAR_POR_CONTAR[contar.value].map((value) => ({ value, title: AGRUPAMENTO_LABELS[value] })),
)

// Trocar "o que contar" muda a lista de agrupamentos; se o escolhido deixou de
// existir, limpa para o usuário não enviar uma combinação que o backend recusa.
function onContarChange() {
  if (agruparPor.value && !AGRUPAR_POR_CONTAR[contar.value].includes(agruparPor.value)) {
    agruparPor.value = null
  }
}

// Rótulo do período: diz qual data o "o que contar" usa.
const periodoLabel = computed(() => {
  const data =
    contar.value === 'abertos'
      ? 'data da abertura'
      : contar.value === 'cancelados'
        ? 'data do cancelamento'
        : contar.value === 'encaminhamentos'
          ? 'data do encaminhamento'
          : 'data da conclusão'
  return `Período — ${data}`
})

const comQuebra = computed(() => quebra.value !== 'nenhuma')
const chartTypeOptions = computed(() => (comQuebra.value ? CHART_TYPE_OPTIONS_QUEBRA : CHART_TYPE_OPTIONS))

// Pizza não faz sentido com colunas de período (uma fatia por linha esconderia a quebra).
function onQuebraChange() {
  if (comQuebra.value && chartType.value === 'pizza') chartType.value = 'colunas'
}

function parseDia(valor) {
  const [y, m, d] = valor.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

// Número de colunas que a quebra geraria no período personalizado. Os atalhos
// nunca estouram o limite (no máximo ~31 dias), então só o personalizado é checado.
function contarColunas(inicio, fim, tipoQuebra) {
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

// Mesmas mensagens do backend, mostradas antes de enviar.
function validarQuebra() {
  if (!comQuebra.value) return ''
  const nome = QUEBRA_NOMES[quebra.value]
  const personalizado = periodoAtalho.value === 'personalizado'
  const temPeriodo = personalizado ? dataInicio.value && dataFim.value : periodoAtalho.value
  if (!temPeriodo) return `Informe um período para quebrar por ${nome}.`
  if (personalizado && parseDia(dataFim.value) >= parseDia(dataInicio.value)) {
    const limite = QUEBRA_LIMITES[quebra.value]
    if (contarColunas(dataInicio.value, dataFim.value, quebra.value) > limite) {
      return `Período longo demais para quebra por ${nome}: máximo de ${limite} colunas.`
    }
  }
  return ''
}

const clientOptions = ref([])
const customerOptions = ref([])
const categoryOptions = ref([])
const subcategoryOptions = ref([])
const itemOptions = ref([])
const solutionGroupOptions = ref([])
const userOptions = ref([])

const filteredCustomerOptions = computed(() =>
  clientId.value ? customerOptions.value.filter((c) => c.client?.id === clientId.value) : customerOptions.value,
)
const filteredSubcategoryOptions = computed(() =>
  categoriaId.value ? subcategoryOptions.value.filter((s) => s.categoria_id === categoriaId.value) : [],
)
const filteredItemOptions = computed(() =>
  subcategoriaId.value ? itemOptions.value.filter((i) => i.subcategoria_id === subcategoriaId.value) : [],
)

function onClientChange() {
  customerId.value = null
}
function onCategoriaChange() {
  subcategoriaId.value = null
  itemId.value = null
}
function onSubcategoriaChange() {
  itemId.value = null
}

const loading = ref(false)
const generating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const successSnackbar = ref(false)

// Resultado exibido e os parâmetros que o geraram (a planilha usa os mesmos,
// mesmo que o usuário mexa nos filtros depois).
const resultado = ref(null)
const resultadoParams = ref(null)
const downloading = ref(false)

async function loadFilterOptions() {
  loading.value = true
  try {
    const [clients, customers, categories, subcategories, items, groups, users] = await Promise.all([
      clientService.lookup(),
      customerService.lookup(),
      categoryService.list({ per_page: 200 }),
      subcategoryService.list({ per_page: 200 }),
      itemService.list({ per_page: 200 }),
      solutionGroupService.list({ per_page: 200 }),
      userService.lookup(),
    ])
    clientOptions.value = clients.data
    customerOptions.value = customers.data
    categoryOptions.value = categories.data
    subcategoryOptions.value = subcategories.data
    itemOptions.value = items.data
    solutionGroupOptions.value = groups.data
    userOptions.value = users.data
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as opções de filtro.')
  } finally {
    loading.value = false
  }
}

const savedReports = ref([])

async function loadSavedReports() {
  try {
    const { data } = await reportService.listSaved({ per_page: 50 })
    savedReports.value = data
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os relatórios salvos.')
  }
}

onMounted(() => {
  loadFilterOptions()
  loadSavedReports()
})

function buildFiltros() {
  const filtros = {}
  if (status.value) filtros.status = status.value
  if (tipo.value) filtros.tipo = tipo.value
  // Atalho e datas são mutuamente exclusivos no backend.
  if (periodoAtalho.value === 'personalizado') {
    if (dataInicio.value) filtros.data_inicio = dataInicio.value
    if (dataFim.value) filtros.data_fim = dataFim.value
  } else if (periodoAtalho.value) {
    filtros.periodo = periodoAtalho.value
  }
  if (clientId.value) filtros.client_id = clientId.value
  if (customerId.value) filtros.customer_id = customerId.value
  if (categoriaId.value) filtros.categoria_id = categoriaId.value
  if (subcategoriaId.value) filtros.subcategoria_id = subcategoriaId.value
  if (itemId.value) filtros.item_id = itemId.value
  if (grupoSolucaoId.value) filtros.grupo_solucao_id = grupoSolucaoId.value
  if (grupoAnalistaId.value) filtros.grupo_analista_id = grupoAnalistaId.value
  if (responsavelId.value) filtros.responsavel_id = responsavelId.value
  return filtros
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function onGenerate() {
  if (!agruparPor.value) {
    errorMessage.value = 'Selecione o agrupamento do relatório.'
    return
  }
  const erroQuebra = validarQuebra()
  if (erroQuebra) {
    errorMessage.value = erroQuebra
    return
  }

  errorMessage.value = ''
  generating.value = true
  resultado.value = null

  try {
    const params = { contar: contar.value, agrupar_por: agruparPor.value, quebra: quebra.value, ...buildFiltros() }
    resultado.value = await reportService.gerar({ ...params, formato: 'json' })
    resultadoParams.value = params
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível gerar o relatório.')
  } finally {
    generating.value = false
  }
}

async function downloadPlanilha() {
  if (!resultadoParams.value) return

  errorMessage.value = ''
  downloading.value = true

  try {
    const blob = await reportService.gerar({ ...resultadoParams.value, formato: 'xlsx' })
    // Mesmo nome que o backend usa no Content-Disposition.
    downloadBlob(blob, `relatorio-${resultadoParams.value.contar}-${resultadoParams.value.agrupar_por}.xlsx`)
    successMessage.value = 'Planilha gerada com sucesso.'
    successSnackbar.value = true
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível baixar a planilha.')
  } finally {
    downloading.value = false
  }
}

// Gráfico e tabela não ouvem o evento ainda além da emissão: a lista de
// chamados é montada em outra etapa.
function onAbrirChamados() {}

const resultadoComQuebra = computed(() => !!resultado.value && resultado.value.quebra !== 'nenhuma')

const chartComponent = computed(() => {
  if (chartType.value === 'pizza' && !resultadoComQuebra.value) return Pie
  return Bar
})

const chartJsData = computed(() => {
  if (!resultado.value) return null
  const rows = resultado.value.linhas
  const labels = rows.map((row) => row.rotulo)

  // Com quebra: barras agrupadas, um dataset por coluna de período.
  if (resultadoComQuebra.value) {
    return {
      labels,
      datasets: resultado.value.colunas.map((col, index) => ({
        label: col.rotulo,
        data: rows.map((row) => row.celulas[col.chave] ?? 0),
        backgroundColor: PALETTE[index % PALETTE.length],
        borderWidth: 0,
      })),
    }
  }

  return {
    labels,
    datasets: [
      {
        label: AGRUPAMENTO_LABELS[resultado.value.agrupar_por] ?? resultado.value.agrupar_por,
        data: rows.map((row) => row.total),
        backgroundColor: rows.map((_, index) => PALETTE[index % PALETTE.length]),
        borderWidth: 0,
      },
    ],
  }
})

// Quebra o título em linhas de até `max` caracteres (sem cortar palavras) para
// caber no canvas e na imagem exportada.
function quebrarTitulo(texto, max = 90) {
  const linhas = []
  let atual = ''
  for (const palavra of (texto ?? '').split(' ')) {
    if (atual && `${atual} ${palavra}`.length > max) {
      linhas.push(atual)
      atual = palavra
    } else {
      atual = atual ? `${atual} ${palavra}` : palavra
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

const chartOptions = computed(() => {
  const isPizza = chartType.value === 'pizza' && !resultadoComQuebra.value
  const quebrado = resultadoComQuebra.value

  // Os dados são sempre contagens — `precision: 0` evita ticks quebrados (0,5, 1,5...).
  const integerTicks = { beginAtZero: true, ticks: { precision: 0 } }

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: chartType.value === 'barras' ? 'y' : 'x',
    // Espaço extra pro rótulo de dado não ficar cortado na borda do canvas
    // quando a barra/coluna mais alta chega perto do topo do gráfico.
    layout: { padding: { top: 24, right: isPizza ? 0 : 24 } },
    plugins: {
      // O título vem pronto do backend; fica dentro do canvas para sair
      // também na imagem exportada.
      title: {
        display: true,
        text: quebrarTitulo(resultado.value?.titulo),
        font: { size: 14, weight: 'bold' },
        padding: { bottom: 16 },
      },
      legend: { display: isPizza || quebrado, position: isPizza ? 'right' : 'top' },
      // Mostra o número de cada barra/coluna/fatia direto no gráfico. Com
      // quebra são muitas barras: esconde os zeros e usa fonte menor.
      datalabels: {
        display: quebrado ? (ctx) => ctx.dataset.data[ctx.dataIndex] > 0 : true,
        color: isPizza ? '#FFFFFF' : '#3A3A3A',
        font: { weight: 'bold', size: quebrado ? 10 : 12 },
        anchor: isPizza ? 'center' : 'end',
        align: isPizza ? 'center' : 'end',
        offset: isPizza ? 0 : 4,
      },
    },
    scales: isPizza ? undefined : { x: integerTicks, y: integerTicks },
  }
})

// Barras horizontais com muitas linhas precisam de altura proporcional.
const chartHeight = computed(() => {
  const linhas = resultado.value?.linhas.length ?? 0
  if (chartType.value !== 'barras') return 420
  const porLinha = resultadoComQuebra.value ? 14 * (resultado.value.colunas.length + 1) : 28
  return Math.max(420, linhas * porLinha + 120)
})

const chartRef = ref(null)

// `chart.toBase64Image()` exporta só o canvas — sem preenchimento, ele é
// transparente por padrão (nenhum problema dentro do card branco da tela,
// mas some/vira ilegível se a imagem for aberta sobre um fundo escuro fora
// do app). Compõe num canvas novo com fundo branco antes de exportar; o
// título do gráfico (`plugins.title` acima) já identifica o relatório tanto
// na tela quanto na imagem exportada, sem precisar de lógica separada aqui.
function exportImage() {
  const chart = chartRef.value?.chart
  if (!chart) return

  const source = chart.canvas
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0)

  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png', 1)
  link.download = `relatorio-${resultado.value.contar}-${resultado.value.agrupar_por}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
}

// --- salvar relatório ---
const saveModalOpen = ref(false)
const saveName = ref('')
const saving = ref(false)

function openSaveModal() {
  if (!agruparPor.value) {
    errorMessage.value = 'Selecione o agrupamento antes de salvar o relatório.'
    return
  }
  const erroQuebra = validarQuebra()
  if (erroQuebra) {
    errorMessage.value = erroQuebra
    return
  }
  saveName.value = ''
  saveModalOpen.value = true
}

async function confirmSave() {
  if (!saveName.value.trim()) return

  saving.value = true
  errorMessage.value = ''

  try {
    await reportService.createSaved({
      nome: saveName.value,
      contar: contar.value,
      agrupar_por: agruparPor.value,
      quebra: quebra.value,
      filtros: buildFiltros(),
    })
    saveModalOpen.value = false
    successMessage.value = 'Relatório salvo com sucesso.'
    successSnackbar.value = true
    await loadSavedReports()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o relatório.')
  } finally {
    saving.value = false
  }
}

function loadSavedIntoFilters(report) {
  // Salvos antes da Fase 2 podem vir sem `contar`; nesse caso mantém o atual.
  if (report.contar) contar.value = report.contar
  agruparPor.value = AGRUPAR_POR_CONTAR[contar.value].includes(report.agrupar_por) ? report.agrupar_por : null
  quebra.value = report.quebra ?? 'nenhuma'
  onQuebraChange()
  const f = report.filtros || {}

  if (f.periodo) {
    periodoAtalho.value = f.periodo
  } else if (f.data_inicio || f.data_fim) {
    periodoAtalho.value = 'personalizado'
  } else {
    periodoAtalho.value = null
  }

  status.value = f.status ?? null
  tipo.value = f.tipo ?? null
  dataInicio.value = f.data_inicio ?? null
  dataFim.value = f.data_fim ?? null
  clientId.value = f.client_id ?? null
  customerId.value = f.customer_id ?? null
  itemId.value = f.item_id ?? null
  grupoSolucaoId.value = f.grupo_solucao_id ?? null
  grupoAnalistaId.value = f.grupo_analista_id ?? null
  responsavelId.value = f.responsavel_id ?? null

  // subcategoria/categoria são resolvidas a partir do item quando ele veio
  // no filtro salvo, senão usa os valores salvos diretamente (o relatório
  // pode ter sido salvo com filtro de categoria sem item específico).
  const item = itemOptions.value.find((i) => i.id === itemId.value)
  subcategoriaId.value = item?.subcategoria_id ?? f.subcategoria_id ?? null
  const subcategoria = subcategoryOptions.value.find((s) => s.id === subcategoriaId.value)
  categoriaId.value = subcategoria?.categoria_id ?? f.categoria_id ?? null

  successMessage.value = `Filtros de "${report.nome}" carregados.`
  successSnackbar.value = true
}

const deleteOpen = ref(false)
const deleting = ref(false)
const reportToDelete = ref(null)

function askDeleteSaved(report) {
  reportToDelete.value = report
  deleteOpen.value = true
}

async function confirmDeleteSaved() {
  deleting.value = true

  try {
    await reportService.removeSaved(reportToDelete.value.id)
    deleteOpen.value = false
    await loadSavedReports()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o relatório salvo.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <AppLayout fluid>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5 font-weight-bold ma-0">Relatórios</h1>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-snackbar v-model="successSnackbar" :timeout="3000" color="success" transition="fade-transition">
      {{ successMessage }}
    </v-snackbar>

    <v-row>
      <v-col cols="12" md="4">
        <v-card variant="outlined" class="pa-2 bg-surface">
          <v-card-text>
            <div class="text-caption text-medium-emphasis mb-1">O que contar</div>
            <v-btn-toggle
              v-model="contar"
              mandatory
              color="primary"
              density="comfortable"
              class="mb-3 flex-wrap"
              style="height: auto"
              @update:model-value="onContarChange"
            >
              <v-btn v-for="o in CONTAR_OPTIONS" :key="o.value" :value="o.value" size="small">{{ o.title }}</v-btn>
            </v-btn-toggle>

            <v-select
              v-model="agruparPor"
              :items="agruparPorOptions"
              label="Agrupar por"
              required
              class="mb-2"
            />

            <div class="text-caption text-medium-emphasis mb-1">Quebrar por período</div>
            <v-btn-toggle
              v-model="quebra"
              mandatory
              color="primary"
              density="comfortable"
              class="mb-3"
              @update:model-value="onQuebraChange"
            >
              <v-btn v-for="o in QUEBRA_OPTIONS" :key="o.value" :value="o.value" size="small">{{ o.title }}</v-btn>
            </v-btn-toggle>

            <div class="text-caption text-medium-emphasis mb-1">{{ periodoLabel }}</div>
            <v-btn-toggle
              v-model="periodoAtalho"
              color="primary"
              density="comfortable"
              class="mb-2 flex-wrap"
              style="height: auto"
            >
              <v-btn v-for="o in PERIODO_OPTIONS" :key="o.value" :value="o.value" size="small">{{ o.title }}</v-btn>
            </v-btn-toggle>
            <v-row v-if="periodoAtalho === 'personalizado'" dense class="mb-2">
              <v-col cols="6">
                <v-text-field v-model="dataInicio" type="date" label="Data início" density="compact" clearable />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="dataFim" type="date" label="Data fim" density="compact" clearable />
              </v-col>
            </v-row>
            <div v-else-if="!periodoAtalho" class="text-caption text-medium-emphasis mb-2">Sem período: todo o histórico.</div>

            <v-row dense class="mb-2">
              <v-col cols="6">
                <v-select v-model="status" :items="statusOptions" label="Status" clearable density="compact" />
              </v-col>
              <v-col cols="6">
                <v-select v-model="tipo" :items="tipoOptions" label="Tipo" clearable density="compact" />
              </v-col>
            </v-row>

            <v-row dense class="mb-2">
              <v-col cols="6">
                <v-select
                  v-model="clientId"
                  :items="clientOptions"
                  item-title="name"
                  item-value="id"
                  label="Cliente"
                  clearable
                  density="compact"
                  @update:model-value="onClientChange"
                />
              </v-col>
              <v-col cols="6">
                <v-select
                  v-model="customerId"
                  :items="filteredCustomerOptions"
                  item-title="name"
                  item-value="id"
                  label="Usuário do cliente"
                  clearable
                  density="compact"
                />
              </v-col>
            </v-row>

            <div class="text-caption text-medium-emphasis mb-1">Classificação</div>
            <v-row dense class="mb-2">
              <v-col cols="4">
                <v-select
                  v-model="categoriaId"
                  :items="categoryOptions"
                  item-title="nome"
                  item-value="id"
                  label="Categoria"
                  clearable
                  density="compact"
                  @update:model-value="onCategoriaChange"
                />
              </v-col>
              <v-col cols="4">
                <v-select
                  v-model="subcategoriaId"
                  :items="filteredSubcategoryOptions"
                  item-title="nome"
                  item-value="id"
                  label="Subcategoria"
                  clearable
                  density="compact"
                  :disabled="!categoriaId"
                  @update:model-value="onSubcategoriaChange"
                />
              </v-col>
              <v-col cols="4">
                <v-select
                  v-model="itemId"
                  :items="filteredItemOptions"
                  item-title="nome"
                  item-value="id"
                  label="Item"
                  clearable
                  density="compact"
                  :disabled="!subcategoriaId"
                />
              </v-col>
            </v-row>

            <v-row dense class="mb-2">
              <v-col cols="6">
                <v-select
                  v-model="grupoSolucaoId"
                  :items="solutionGroupOptions"
                  item-title="nome"
                  item-value="id"
                  label="Grupo do chamado"
                  clearable
                  density="compact"
                />
              </v-col>
              <v-col cols="6">
                <v-select
                  v-model="grupoAnalistaId"
                  :items="solutionGroupOptions"
                  item-title="nome"
                  item-value="id"
                  label="Grupo do analista"
                  clearable
                  density="compact"
                />
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="responsavelId"
                  :items="userOptions"
                  item-title="name"
                  item-value="id"
                  label="Responsável"
                  clearable
                  density="compact"
                />
              </v-col>
            </v-row>

            <v-divider class="my-3" />

            <v-select
              v-model="chartType"
              :items="chartTypeOptions"
              label="Tipo de gráfico"
              class="mb-2"
            />

            <div class="d-flex flex-column mt-2" style="gap: 8px">
              <v-btn color="primary" block :loading="generating" @click="onGenerate">
                Gerar Relatório
              </v-btn>
              <v-btn v-if="canManage" color="primary" variant="tonal" block @click="openSaveModal">
                Salvar Relatório
              </v-btn>
            </div>

            <template v-if="savedReports.length">
              <v-divider class="my-3" />
              <div class="text-caption text-medium-emphasis mb-1">Relatórios salvos</div>
              <v-list density="compact" class="pa-0">
                <v-list-item
                  v-for="report in savedReports"
                  :key="report.id"
                  :title="report.nome"
                  :subtitle="AGRUPAMENTO_LABELS[report.agrupar_por] ?? report.agrupar_por"
                  @click="loadSavedIntoFilters(report)"
                >
                  <template v-if="canManage" #append>
                    <v-btn
                      icon="mdi-delete"
                      variant="text"
                      size="x-small"
                      color="error"
                      @click.stop="askDeleteSaved(report)"
                    />
                  </template>
                </v-list-item>
              </v-list>
            </template>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <v-card variant="outlined" class="pa-4 bg-surface d-flex flex-column" style="min-height: 560px">
          <template v-if="!resultado">
            <div class="d-flex flex-column align-center justify-center flex-grow-1 text-medium-emphasis">
              <v-icon icon="mdi-chart-bar" size="64" class="mb-2" />
              <div>Configure os filtros e clique em "Gerar Relatório"</div>
            </div>
          </template>

          <template v-else>
            <div class="d-flex justify-end mb-3" style="gap: 8px">
              <v-btn variant="tonal" size="small" prepend-icon="mdi-image" @click="exportImage">
                Exportar imagem
              </v-btn>
              <v-btn
                variant="tonal"
                size="small"
                prepend-icon="mdi-file-excel-outline"
                :loading="downloading"
                @click="downloadPlanilha"
              >
                Baixar planilha
              </v-btn>
            </div>

            <div :style="{ position: 'relative', height: `${chartHeight}px` }" class="mb-4">
              <component
                :is="chartComponent"
                ref="chartRef"
                :data="chartJsData"
                :options="chartOptions"
              />
            </div>

            <ReportResultTable :resultado="resultado" @abrir-chamados="onAbrirChamados" />
          </template>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="saveModalOpen" max-width="480">
      <v-card>
        <v-card-title class="text-subtitle-1 font-weight-bold">Salvar relatório</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="saveName"
            label="Nome do relatório"
            autofocus
            hide-details
            @keyup.enter="confirmSave"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="saveModalOpen = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!saveName.trim()" @click="confirmSave">
            Salvar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDeleteDialog
      v-model="deleteOpen"
      message="Excluir este relatório salvo? Essa ação não pode ser desfeita."
      :loading="deleting"
      @confirm="confirmDeleteSaved"
    />
  </AppLayout>
</template>
