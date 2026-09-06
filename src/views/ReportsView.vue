<script setup>
import { computed, onMounted, ref } from 'vue'
import { Chart as ChartJS, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Bar, Line, Pie } from 'vue-chartjs'
import AppLayout from '@/layouts/AppLayout.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import reportService from '@/services/reportService'
import clientService from '@/services/clientService'
import customerService from '@/services/customerService'
import categoryService from '@/services/categoryService'
import subcategoryService from '@/services/subcategoryService'
import itemService from '@/services/itemService'
import solutionGroupService from '@/services/solutionGroupService'
import userService from '@/services/userService'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/errors'
import { STATUS_LABELS } from '@/utils/incidentLabels'

ChartJS.register(...registerables, ChartDataLabels)

const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('relatorios.manage'))

const AGRUPAMENTO_OPTIONS = [
  { value: 'status_sla', title: 'Status de SLA' },
  { value: 'responsavel', title: 'Responsável' },
  { value: 'aberto_por', title: 'Aberto por' },
  { value: 'resolvido_por', title: 'Resolvido por' },
  { value: 'fechado_por', title: 'Fechado por' },
  { value: 'encaminhado_por', title: 'Encaminhado por' },
  { value: 'encaminhado_para_grupo', title: 'Encaminhado para (grupo)' },
  { value: 'encaminhado_para_responsavel', title: 'Encaminhado para (responsável)' },
  { value: 'grupo_solucao', title: 'Grupo de Solução' },
  { value: 'categoria', title: 'Categoria' },
  { value: 'subcategoria', title: 'Subcategoria' },
  { value: 'item', title: 'Item' },
]
const AGRUPAMENTO_LABELS = Object.fromEntries(AGRUPAMENTO_OPTIONS.map((o) => [o.value, o.title]))

const CHART_TYPE_OPTIONS = [
  { value: 'colunas', title: 'Colunas' },
  { value: 'barras', title: 'Barras' },
  { value: 'pizza', title: 'Pizza' },
  { value: 'linha', title: 'Linha' },
]

const statusOptions = Object.entries(STATUS_LABELS).map(([value, title]) => ({ value, title }))

const PALETTE = ['#FF8C1A', '#7922B9', '#2563EB', '#166534', '#F59E0B', '#E53935', '#FFA64D', '#C371FF']

// --- filtros ---
const agruparPor = ref(null)
const status = ref(null)
const dataInicio = ref(null)
const dataFim = ref(null)
const clientId = ref(null)
const customerId = ref(null)
const categoriaId = ref(null)
const subcategoriaId = ref(null)
const itemId = ref(null)
const grupoSolucaoId = ref(null)
const responsavelId = ref(null)

// --- saída ---
const outputType = ref('grafico') // 'grafico' | 'planilha'
const chartType = ref('colunas')

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

const chartResult = ref(null)

async function loadFilterOptions() {
  loading.value = true
  try {
    const [clients, customers, categories, subcategories, items, groups, users] = await Promise.all([
      clientService.list({ per_page: 200 }),
      customerService.list({ per_page: 200 }),
      categoryService.list({ per_page: 200 }),
      subcategoryService.list({ per_page: 200 }),
      itemService.list({ per_page: 200 }),
      solutionGroupService.list({ per_page: 200 }),
      userService.list({ per_page: 200 }),
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
  if (dataInicio.value) filtros.data_inicio = dataInicio.value
  if (dataFim.value) filtros.data_fim = dataFim.value
  if (clientId.value) filtros.client_id = clientId.value
  if (customerId.value) filtros.customer_id = customerId.value
  if (categoriaId.value) filtros.categoria_id = categoriaId.value
  if (subcategoriaId.value) filtros.subcategoria_id = subcategoriaId.value
  if (itemId.value) filtros.item_id = itemId.value
  if (grupoSolucaoId.value) filtros.grupo_solucao_id = grupoSolucaoId.value
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

  errorMessage.value = ''
  generating.value = true
  chartResult.value = null

  try {
    const params = { agrupar_por: agruparPor.value, ...buildFiltros() }

    if (outputType.value === 'planilha') {
      const blob = await reportService.gerar({ ...params, formato: 'xlsx' })
      downloadBlob(blob, `relatorio-${agruparPor.value}.xlsx`)
      successMessage.value = 'Planilha gerada com sucesso.'
      successSnackbar.value = true
    } else {
      chartResult.value = await reportService.gerar({ ...params, formato: 'json' })
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível gerar o relatório.')
  } finally {
    generating.value = false
  }
}

const chartComponent = computed(() => {
  if (chartType.value === 'pizza') return Pie
  if (chartType.value === 'linha') return Line
  return Bar
})

const chartJsData = computed(() => {
  if (!chartResult.value) return null
  const rows = chartResult.value.data

  return {
    labels: rows.map((row) => row.rotulo),
    datasets: [
      {
        label: AGRUPAMENTO_LABELS[chartResult.value.agrupado_por] ?? chartResult.value.agrupado_por,
        data: rows.map((row) => row.total),
        backgroundColor: rows.map((_, index) => PALETTE[index % PALETTE.length]),
        borderColor: chartType.value === 'linha' ? PALETTE[0] : undefined,
        borderWidth: chartType.value === 'linha' ? 2 : 0,
        fill: false,
        tension: 0.3,
      },
    ],
  }
})

const chartOptions = computed(() => {
  const isPizza = chartType.value === 'pizza'

  // Os dados são sempre contagens (total de incidentes) — não faz sentido o
  // eixo numérico mostrar valores quebrados (0,5, 1,5...) quando o maior
  // valor é pequeno. `stepSize: 1` força o Chart.js a gerar só ticks
  // inteiros, em vez do espaçamento "bonito" default dele.
  const integerTicks = { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: chartType.value === 'barras' ? 'y' : 'x',
    // Espaço extra pro rótulo de dado não ficar cortado na borda do canvas
    // quando a barra/coluna mais alta chega perto do topo do gráfico.
    layout: { padding: { top: 24, right: isPizza ? 0 : 24 } },
    plugins: {
      title: {
        display: true,
        text: AGRUPAMENTO_LABELS[chartResult.value?.agrupado_por] ?? '',
        font: { size: 16, weight: 'bold' },
        padding: { bottom: 16 },
      },
      legend: { display: isPizza, position: 'right' },
      // Mostra o número de cada barra/coluna/fatia direto no gráfico, não só
      // no tooltip ao passar o mouse.
      datalabels: {
        color: isPizza ? '#FFFFFF' : '#3A3A3A',
        font: { weight: 'bold', size: 12 },
        anchor: isPizza ? 'center' : 'end',
        // Pontos de linha não têm "lado final" como uma barra — o padrão
        // pra esse caso é ancorar no ponto e alinhar o texto acima dele.
        align: isPizza ? 'center' : chartType.value === 'linha' ? 'top' : 'end',
        offset: isPizza ? 0 : 4,
      },
    },
    scales: isPizza ? undefined : { x: integerTicks, y: integerTicks },
  }
})

const chartRef = ref(null)

// `chart.toBase64Image()` exporta só o canvas — sem preenchimento, ele é
// transparente por padrão (nenhum problema dentro do card branco da tela,
// mas some/vira ilegível se a imagem for aberta sobre um fundo escuro fora
// do app). Compõe num canvas novo com fundo branco antes de exportar; o
// título do gráfico (`plugins.title` acima) já identifica o indicador tanto
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
  link.download = `relatorio-${agruparPor.value}.png`
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
      agrupar_por: agruparPor.value,
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
  agruparPor.value = report.agrupar_por
  const f = report.filtros || {}

  status.value = f.status ?? null
  dataInicio.value = f.data_inicio ?? null
  dataFim.value = f.data_fim ?? null
  clientId.value = f.client_id ?? null
  customerId.value = f.customer_id ?? null
  itemId.value = f.item_id ?? null
  grupoSolucaoId.value = f.grupo_solucao_id ?? null
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
            <v-select
              v-model="agruparPor"
              :items="AGRUPAMENTO_OPTIONS"
              label="Agrupar por"
              required
              class="mb-2"
            />

            <v-row dense class="mb-2">
              <v-col cols="12">
                <v-select v-model="status" :items="statusOptions" label="Status" clearable density="compact" />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="dataInicio" type="date" label="Data início" density="compact" clearable />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="dataFim" type="date" label="Data fim" density="compact" clearable />
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
                  label="Grupo de Solução"
                  clearable
                  density="compact"
                />
              </v-col>
              <v-col cols="6">
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

            <div class="text-caption text-medium-emphasis mb-2">Saída</div>
            <v-btn-toggle v-model="outputType" mandatory color="primary" density="comfortable" class="mb-3">
              <v-btn value="grafico" prepend-icon="mdi-chart-bar">Gráfico</v-btn>
              <v-btn value="planilha" prepend-icon="mdi-file-excel-outline">Planilha (.xlsx)</v-btn>
            </v-btn-toggle>

            <v-select
              v-if="outputType === 'grafico'"
              v-model="chartType"
              :items="CHART_TYPE_OPTIONS"
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
                  :subtitle="AGRUPAMENTO_LABELS[report.agrupar_por]"
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
          <template v-if="outputType === 'planilha'">
            <div class="d-flex flex-column align-center justify-center flex-grow-1 text-medium-emphasis">
              <v-icon icon="mdi-file-excel-outline" size="64" class="mb-2" />
              <div>Clique em "Gerar Relatório" para baixar a planilha .xlsx</div>
            </div>
          </template>

          <template v-else-if="!chartResult">
            <div class="d-flex flex-column align-center justify-center flex-grow-1 text-medium-emphasis">
              <v-icon icon="mdi-chart-bar" size="64" class="mb-2" />
              <div>Configure os filtros e clique em "Gerar Relatório"</div>
            </div>
          </template>

          <template v-else>
            <div class="d-flex justify-end mb-3">
              <v-btn variant="tonal" size="small" prepend-icon="mdi-image" @click="exportImage">
                Exportar imagem
              </v-btn>
            </div>

            <div class="flex-grow-1" style="position: relative; min-height: 0">
              <component
                :is="chartComponent"
                ref="chartRef"
                :data="chartJsData"
                :options="chartOptions"
              />
            </div>
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
