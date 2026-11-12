<script setup>
import { computed, onMounted, ref } from 'vue'
import FluxosMapa from '@/components/reports/FluxosMapa.vue'
import ReportPeriodControls from '@/components/reports/ReportPeriodControls.vue'
import ReportTicketListDialog from '@/components/reports/ReportTicketListDialog.vue'
import reportService from '@/services/reportService'
import solutionGroupService from '@/services/solutionGroupService'
import { baixarImagemGraficos } from '@/utils/chartImage'
import { downloadBlob } from '@/utils/download'
import { extractErrorMessage } from '@/utils/errors'
import { paramsPeriodo } from '@/utils/reportPeriod'
import { svgParaCanvas } from '@/utils/svgImagem'

// --- filtros (período obrigatório, sem quebra) ---
const grupos = ref([])
const periodoAtalho = ref('este_mes')
const dataInicio = ref(null)
const dataFim = ref(null)

const solutionGroupOptions = ref([])
const loadingGrupos = ref(false)

const generating = ref(false)
const downloading = ref(false)
const exporting = ref(false)
const errorMessage = ref('')

// Resultado exibido e os parâmetros que o geraram (planilha e lista usam os
// mesmos, mesmo que o usuário mexa nos filtros depois).
const resultado = ref(null)
const resultadoParams = ref(null)

async function loadGrupos() {
  loadingGrupos.value = true
  try {
    // Mesmo lookup de grupos das outras abas.
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
  return { grupos: [...grupos.value], ...paramsPeriodo(periodo) }
}

// Mesma mensagem do backend, mostrada antes de enviar.
function validar() {
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
    resultado.value = await reportService.fluxos({ ...params, formato: 'json' })
    resultadoParams.value = params
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível gerar o mapa de fluxos.')
  } finally {
    generating.value = false
  }
}

async function downloadPlanilha() {
  if (!resultadoParams.value) return

  errorMessage.value = ''
  downloading.value = true

  try {
    const blob = await reportService.fluxos({ ...resultadoParams.value, formato: 'xlsx' })
    // Mesmo nome que o backend usa no Content-Disposition.
    downloadBlob(blob, 'mapa-de-fluxos.xlsx')
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível baixar a planilha.')
  } finally {
    downloading.value = false
  }
}

// Título, mapa, legenda e aviso numa só imagem, em fundo branco.
const mapaRef = ref(null)

async function exportImage() {
  const svg = mapaRef.value?.svg
  if (!svg || !resultado.value) return

  errorMessage.value = ''
  exporting.value = true
  try {
    const canvas = await svgParaCanvas(svg)
    baixarImagemGraficos([canvas], 'mapa-de-fluxos.png', {
      titulo: resultado.value.titulo,
      rodape: [...resultado.value.legenda, ...(resultado.value.aviso ? [resultado.value.aviso] : [])],
    })
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível exportar a imagem.')
  } finally {
    exporting.value = false
  }
}

// --- lista de chamados por trás de um número ou seta ---
// `{ modo: 'no', no, metrica, rotulo }` ou `{ modo: 'seta', origem, destino, rotulo }`,
// emitido pelo mapa; o diálogo de lista (fonte 'fluxos') abre a partir deste alvo.
const listaAlvo = ref(null)
const listaAberta = ref(false)

// O atalho de período é resolvido pelo backend a cada requisição; a lista recebe
// as datas já resolvidas que o resultado devolveu, para bater com o número clicado.
const paramsLista = computed(() => {
  if (!resultadoParams.value || !resultado.value) return null
  const { periodo: _atalho, data_inicio: _ini, data_fim: _fim, ...demais } = resultadoParams.value
  const periodo = resultado.value.periodo
  return periodo ? { ...demais, data_inicio: periodo.inicio, data_fim: periodo.fim } : demais
})

function abrirChamados(alvo) {
  listaAlvo.value = alvo
  listaAberta.value = true
}
</script>

<template>
  <div>
    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

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
            />
          </v-col>
          <v-col cols="12" md="7">
            <ReportPeriodControls
              v-model:periodo="periodoAtalho"
              v-model:dataInicio="dataInicio"
              v-model:dataFim="dataFim"
              :mostrar-quebra="false"
              obrigatorio
            />
          </v-col>
        </v-row>
        <div class="d-flex justify-end">
          <v-btn color="primary" :loading="generating" @click="onGenerate">Gerar Relatório</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="outlined" class="pa-4 bg-surface d-flex flex-column" style="min-height: 320px">
      <template v-if="!resultado">
        <div class="d-flex flex-column align-center justify-center flex-grow-1 text-medium-emphasis">
          <v-icon icon="mdi-sitemap-outline" size="64" class="mb-2" />
          <div>Escolha os grupos e o período e clique em "Gerar Relatório"</div>
        </div>
      </template>

      <template v-else>
        <h2 class="text-subtitle-1 font-weight-bold mb-3">{{ resultado.titulo }}</h2>

        <FluxosMapa
          ref="mapaRef"
          :nos="resultado.nos"
          :arestas="resultado.arestas"
          class="mb-4"
          @abrir-chamados="abrirChamados"
        />

        <div class="text-caption text-medium-emphasis mb-1">Legenda</div>
        <ul class="legenda text-body-2 mb-4">
          <li v-for="(texto, i) in resultado.legenda" :key="i">{{ texto }}</li>
        </ul>

        <v-alert v-if="resultado.aviso" type="warning" variant="tonal" density="comfortable" class="mb-4">
          {{ resultado.aviso }}
        </v-alert>

        <div class="d-flex justify-end" style="gap: 8px">
          <v-btn variant="tonal" size="small" prepend-icon="mdi-image" :loading="exporting" @click="exportImage">
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

    <ReportTicketListDialog v-model="listaAberta" fonte="fluxos" :params="paramsLista" :alvo="listaAlvo" />
  </div>
</template>

<style scoped>
.legenda {
  padding-left: 20px;
}
</style>
