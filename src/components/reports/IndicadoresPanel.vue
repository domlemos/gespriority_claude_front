<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Chart as ChartJS, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Bar } from 'vue-chartjs'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import IndicadoresTable from '@/components/reports/IndicadoresTable.vue'
import ReportPeriodControls from '@/components/reports/ReportPeriodControls.vue'
import ReportTicketListDialog from '@/components/reports/ReportTicketListDialog.vue'
import reportService from '@/services/reportService'
import solutionGroupService from '@/services/solutionGroupService'
import { baixarImagemGraficos } from '@/utils/chartImage'
import { useAuthStore } from '@/stores/auth'
import { downloadBlob } from '@/utils/download'
import { extractErrorMessage } from '@/utils/errors'
import { paramsPeriodo, validarQuebra } from '@/utils/reportPeriod'

ChartJS.register(...registerables, ChartDataLabels)

const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('relatorios.manage'))

// Uma cor por indicador (sem quebra) ou por linha (com quebra).
const PALETTE = ['#FF8C1A', '#7922B9', '#2563EB', '#166534', '#F59E0B', '#E53935', '#FFA64D', '#C371FF']

// --- filtros ---
const grupos = ref([])
const periodoAtalho = ref('este_mes')
const dataInicio = ref(null)
const dataFim = ref(null)
const quebra = ref('nenhuma')
const porIntegrante = ref(false)

const podeDetalhar = computed(() => grupos.value.length === 1)
watch(podeDetalhar, (pode) => {
  if (!pode) porIntegrante.value = false
})

const solutionGroupOptions = ref([])
const loadingGrupos = ref(false)

const generating = ref(false)
const downloading = ref(false)
const errorMessage = ref('')

// Resultado exibido e os parâmetros que o geraram (a planilha usa os mesmos,
// mesmo que o usuário mexa nos filtros depois).
const resultado = ref(null)
const resultadoParams = ref(null)

async function loadGrupos() {
  loadingGrupos.value = true
  try {
    // Mesmo lookup de grupos dos filtros da aba Avançado.
    const { data } = await solutionGroupService.list({ per_page: 200 })
    solutionGroupOptions.value = data
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os grupos de solução.')
  } finally {
    loadingGrupos.value = false
  }
}

onMounted(loadGrupos)

function buildParams() {
  const periodo = { periodoAtalho: periodoAtalho.value, dataInicio: dataInicio.value, dataFim: dataFim.value }
  const params = { grupos: [...grupos.value], quebra: quebra.value, ...paramsPeriodo(periodo) }
  if (porIntegrante.value) params.por_integrante = true
  return params
}

// Mesmas mensagens do backend, mostradas antes de enviar.
function validar() {
  const periodo = { periodoAtalho: periodoAtalho.value, dataInicio: dataInicio.value, dataFim: dataFim.value }
  const erroQuebra = validarQuebra({ quebra: quebra.value, ...periodo })
  if (erroQuebra) return erroQuebra
  const temPeriodo = periodoAtalho.value === 'personalizado' ? dataInicio.value && dataFim.value : periodoAtalho.value
  return temPeriodo ? '' : 'Informe um período.'
}

async function onGenerate() {
  const erro = validar()
  if (erro) {
    errorMessage.value = erro
    return
  }

  errorMessage.value = ''
  generating.value = true
  resultado.value = null

  try {
    const params = buildParams()
    resultado.value = await reportService.indicadores({ ...params, formato: 'json' })
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
    const blob = await reportService.indicadores({ ...resultadoParams.value, formato: 'xlsx' })
    // Mesmo nome que o backend usa no Content-Disposition.
    downloadBlob(blob, 'relatorio-indicadores.xlsx')
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível baixar a planilha.')
  } finally {
    downloading.value = false
  }
}

// --- gráficos ---
const resultadoComQuebra = computed(() => !!resultado.value && resultado.value.quebra !== 'nenhuma')

// Sem quebra: um gráfico, linhas no eixo e uma barra por indicador.
// Com quebra: um gráfico por indicador, períodos no eixo e uma barra por linha.
const graficos = computed(() => {
  if (!resultado.value) return []
  const { linhas, indicadores, colunas } = resultado.value

  const comOpcoes = (grafico) => ({ ...grafico, options: chartOptions(grafico) })

  if (!resultadoComQuebra.value) {
    return [
      comOpcoes({
        chave: 'todos',
        titulo: null,
        data: {
          labels: linhas.map((l) => l.rotulo),
          datasets: indicadores.map((ind, i) => ({
            label: ind.rotulo,
            data: linhas.map((l) => l.valores[ind.chave].total),
            backgroundColor: PALETTE[i % PALETTE.length],
            borderWidth: 0,
          })),
        },
        // datasetIndex = indicador, index = linha.
        alvo: (index, datasetIndex) => ({ linha: linhas[index], indicador: indicadores[datasetIndex], coluna: null }),
      }),
    ]
  }

  return indicadores.map((ind) =>
    comOpcoes({
      chave: ind.chave,
      titulo: ind.rotulo,
      data: {
        labels: colunas.map((c) => c.rotulo),
        datasets: linhas.map((l, i) => ({
          label: l.rotulo,
          data: colunas.map((c) => l.valores[ind.chave].celulas[c.chave] ?? 0),
          backgroundColor: PALETTE[i % PALETTE.length],
          borderWidth: 0,
        })),
      },
      // datasetIndex = linha, index = período.
      alvo: (index, datasetIndex) => ({ linha: linhas[datasetIndex], indicador: ind, coluna: colunas[index].chave }),
    }),
  )
})

function chartOptions(grafico) {
  const quebrado = resultadoComQuebra.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    // Espaço extra pro rótulo de dado não ficar cortado na borda do canvas.
    layout: { padding: { top: 24, right: 24 } },
    plugins: {
      // O título geral fica acima dos gráficos (e é desenhado na imagem
      // exportada); com quebra, cada gráfico leva o nome do indicador.
      title: {
        display: !!grafico.titulo,
        text: grafico.titulo ?? '',
        font: { size: 14, weight: 'bold' },
        padding: { bottom: 8 },
      },
      legend: { display: true, position: 'top' },
      // Muitas barras com quebra: esconde os zeros e usa fonte menor.
      datalabels: {
        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
        color: '#3A3A3A',
        font: { weight: 'bold', size: quebrado ? 10 : 12 },
        anchor: 'end',
        align: 'end',
        offset: 4,
      },
    },
    // Contagens: `precision: 0` evita ticks quebrados (0,5, 1,5...).
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    // Clicar numa barra abre a mesma lista de chamados da célula da tabela.
    onClick: (event, elements) => {
      if (!elements.length) return
      const { index, datasetIndex } = elements[0]
      const { linha, indicador, coluna } = grafico.alvo(index, datasetIndex)
      abrirChamados({ chave: linha.chave, indicador: indicador.chave, coluna, rotulo: linha.rotulo })
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default'
    },
  }
}

const chartHeight = computed(() => (resultadoComQuebra.value ? 300 : 420))

// --- lista de chamados por trás de uma célula ---
// O atalho de período é resolvido pelo backend a cada requisição; a lista recebe
// as datas já resolvidas que o resultado devolveu, para bater com o número clicado.
const paramsLista = computed(() => {
  if (!resultadoParams.value || !resultado.value) return null
  const { periodo: _atalho, data_inicio: _ini, data_fim: _fim, ...demais } = resultadoParams.value
  const periodo = resultado.value.periodo
  return periodo ? { ...demais, data_inicio: periodo.inicio, data_fim: periodo.fim } : demais
})

const listaAberta = ref(false)
const listaChave = ref(null)
const listaIndicador = ref(null)
const listaColuna = ref(null)
const listaNumero = ref(null)

// `{chave, indicador, coluna, rotulo}`: chave e rótulo da linha, chave do
// indicador e chave da coluna de período (null = Total do indicador).
function abrirChamados({ chave, indicador, coluna }) {
  if (!resultadoParams.value || !resultado.value) return
  const linha = resultado.value.linhas.find((l) => l.chave === chave)
  const valor = linha?.valores[indicador]
  listaChave.value = chave
  listaIndicador.value = indicador
  listaColuna.value = coluna
  listaNumero.value = coluna ? (valor?.celulas[coluna] ?? 0) : (valor?.total ?? null)
  listaAberta.value = true
}

// --- relatórios salvos ---
const AGRUPAR_POR_LABELS = { grupo: 'Por grupo', integrante: 'Por integrante' }
const savedReports = ref([])
const successSnackbar = ref(false)

async function loadSavedReports() {
  try {
    const { data } = await reportService.listSaved({ per_page: 50 })
    // Os salvos de indicadores moram nesta aba; a aba Avançado mostra o resto.
    savedReports.value = data.filter((r) => r.contar === 'indicadores')
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os relatórios salvos.')
  }
}

onMounted(loadSavedReports)

const saveModalOpen = ref(false)
const saveName = ref('')
const saving = ref(false)

function openSaveModal() {
  const erro = validar()
  if (erro) {
    errorMessage.value = erro
    return
  }
  errorMessage.value = ''
  saveName.value = ''
  saveModalOpen.value = true
}

async function confirmSave() {
  if (!saveName.value.trim()) return

  saving.value = true
  errorMessage.value = ''

  try {
    const { grupos: gruposSel, quebra: quebraSel, por_integrante: _pi, ...periodo } = buildParams()
    const filtros = { ...periodo }
    if (gruposSel.length) filtros.grupos = gruposSel
    await reportService.createSaved({
      nome: saveName.value,
      contar: 'indicadores',
      agrupar_por: porIntegrante.value ? 'integrante' : 'grupo',
      quebra: quebraSel,
      filtros,
    })
    saveModalOpen.value = false
    successSnackbar.value = true
    await loadSavedReports()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o relatório.')
  } finally {
    saving.value = false
  }
}

function loadSavedIntoFilters(report) {
  const f = report.filtros || {}
  grupos.value = f.grupos ?? []
  quebra.value = report.quebra ?? 'nenhuma'
  porIntegrante.value = report.agrupar_por === 'integrante'
  dataInicio.value = f.data_inicio ?? null
  dataFim.value = f.data_fim ?? null
  if (f.periodo) periodoAtalho.value = f.periodo
  else if (f.data_inicio || f.data_fim) periodoAtalho.value = 'personalizado'
  else periodoAtalho.value = null
}

// Clicar num salvo carrega os filtros no painel e roda o relatório.
async function openSaved(report) {
  loadSavedIntoFilters(report)

  errorMessage.value = ''
  generating.value = true
  resultado.value = null

  try {
    resultado.value = await reportService.executarSaved(report.id)
    // Parâmetros equivalentes ao que o servidor executou, para planilha e lista.
    resultadoParams.value = buildParams()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível executar o relatório salvo.')
  } finally {
    generating.value = false
  }
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

// Componentes dos gráficos na ordem de `graficos` (a imagem os empilha nessa ordem).
const chartRefs = []

// Título, gráficos, legenda e aviso numa só imagem, para ela se explicar sozinha.
function exportImage() {
  const canvases = chartRefs.slice(0, graficos.value.length).map((c) => c?.chart?.canvas).filter(Boolean)
  if (!canvases.length) return
  baixarImagemGraficos(canvases, 'relatorio-indicadores.png', {
    titulo: resultado.value.titulo,
    rodape: [...resultado.value.legenda, ...(resultado.value.aviso ? [resultado.value.aviso] : [])],
  })
}
</script>

<template>
  <div>
    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-snackbar v-model="successSnackbar" :timeout="3000" color="success" transition="fade-transition">
      Relatório salvo com sucesso.
    </v-snackbar>

    <v-card variant="outlined" class="pa-2 bg-surface mb-4">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="5">
            <v-autocomplete
              v-model="grupos"
              :items="solutionGroupOptions"
              :loading="loadingGrupos"
              item-title="nome"
              item-value="id"
              label="Grupos de solução"
              placeholder="Todos os grupos visíveis"
              persistent-placeholder
              multiple
              chips
              closable-chips
              clearable
              density="compact"
              class="mb-2"
            />
            <v-switch
              v-model="porIntegrante"
              :disabled="!podeDetalhar"
              label="Detalhar por integrante"
              color="primary"
              density="compact"
              hide-details
            />
            <div v-if="!podeDetalhar" class="text-caption text-medium-emphasis">
              Selecione um único grupo para detalhar por integrante.
            </div>
          </v-col>
          <v-col cols="12" md="7">
            <ReportPeriodControls
              v-model:quebra="quebra"
              v-model:periodo="periodoAtalho"
              v-model:dataInicio="dataInicio"
              v-model:dataFim="dataFim"
              obrigatorio
            />
          </v-col>
        </v-row>
        <div class="d-flex justify-end" style="gap: 8px">
          <v-btn v-if="canManage" color="primary" variant="tonal" @click="openSaveModal">Salvar Relatório</v-btn>
          <v-btn color="primary" :loading="generating" @click="onGenerate">Gerar Relatório</v-btn>
        </div>

        <template v-if="savedReports.length">
          <v-divider class="my-3" />
          <div class="text-caption text-medium-emphasis mb-1">Relatórios salvos</div>
          <v-list density="compact" class="pa-0">
            <v-list-item
              v-for="report in savedReports"
              :key="report.id"
              :title="report.nome"
              :subtitle="AGRUPAR_POR_LABELS[report.agrupar_por] ?? report.agrupar_por"
              @click="openSaved(report)"
            >
              <template v-if="canManage" #append>
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="x-small"
                  color="error"
                  aria-label="Excluir relatório salvo"
                  @click.stop="askDeleteSaved(report)"
                />
              </template>
            </v-list-item>
          </v-list>
        </template>
      </v-card-text>
    </v-card>

    <v-card variant="outlined" class="pa-4 bg-surface d-flex flex-column" style="min-height: 320px">
      <template v-if="!resultado">
        <div class="d-flex flex-column align-center justify-center flex-grow-1 text-medium-emphasis">
          <v-icon icon="mdi-chart-bar" size="64" class="mb-2" />
          <div>Escolha os grupos e o período e clique em "Gerar Relatório"</div>
        </div>
      </template>

      <template v-else>
        <h2 class="text-subtitle-1 font-weight-bold mb-3">{{ resultado.titulo }}</h2>

        <div
          v-for="(grafico, i) in graficos"
          :key="grafico.chave"
          :style="{ position: 'relative', height: `${chartHeight}px` }"
          class="mb-4"
        >
          <Bar :ref="(el) => (chartRefs[i] = el)" :data="grafico.data" :options="grafico.options" />
        </div>

        <IndicadoresTable :resultado="resultado" class="mb-4" @abrir-chamados="abrirChamados" />

        <div class="text-caption text-medium-emphasis mb-1">Legenda</div>
        <ul class="legenda text-body-2 mb-4">
          <li v-for="(texto, i) in resultado.legenda" :key="i">{{ texto }}</li>
        </ul>

        <v-alert v-if="resultado.aviso" type="warning" variant="tonal" density="comfortable" class="mb-4">
          {{ resultado.aviso }}
        </v-alert>

        <div class="d-flex justify-end" style="gap: 8px">
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
      </template>
    </v-card>

    <v-dialog v-model="saveModalOpen" max-width="480">
      <v-card>
        <v-card-title class="text-subtitle-1 font-weight-bold">Salvar relatório</v-card-title>
        <v-card-text>
          <v-text-field v-model="saveName" label="Nome do relatório" autofocus hide-details @keyup.enter="confirmSave" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="saveModalOpen = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!saveName.trim()" @click="confirmSave">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ReportTicketListDialog
      v-model="listaAberta"
      fonte="indicadores"
      :params="paramsLista"
      :chave="listaChave"
      :indicador="listaIndicador"
      :coluna="listaColuna"
      :numero-clicado="listaNumero"
    />

    <ConfirmDeleteDialog
      v-model="deleteOpen"
      message="Excluir este relatório salvo? Essa ação não pode ser desfeita."
      :loading="deleting"
      @confirm="confirmDeleteSaved"
    />
  </div>
</template>

<style scoped>
.legenda {
  padding-left: 20px;
}
</style>
