<script setup>
import { computed, ref, watch } from 'vue'
import reportService from '@/services/reportService'
import { extractErrorMessage } from '@/utils/errors'
import { STATUS_LABELS } from '@/utils/incidentLabels'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // Parâmetros exatos que geraram o resultado na tela (contar, agrupar_por, quebra, filtros).
  params: { type: Object, default: null },
  chave: { type: [String, Number], default: null },
  // Chave da coluna de período; null = todos os períodos da linha.
  coluna: { type: String, default: null },
  // Número que o usuário clicou na tabela (total da linha ou célula); null se desconhecido.
  numeroClicado: { type: Number, default: null },
  // 'consulta' = relatório Avançado; 'indicadores' = aba Indicadores por grupo;
  // 'fluxos' = aba Mapa de fluxos (número de um nó ou seta).
  fonte: { type: String, default: 'consulta', validator: (v) => ['consulta', 'indicadores', 'fluxos'].includes(v) },
  // Só 'indicadores': chave do indicador (abertos, resolvidos...) da célula clicada.
  indicador: { type: String, default: null },
  // Só 'fluxos': `{ modo: 'no', no, metrica }` ou `{ modo: 'seta', origem, destino }`.
  alvo: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

const PER_PAGE = 50

const loading = ref(false)
const downloading = ref(false)
const errorMessage = ref('')
const dados = ref(null)
const page = ref(1)

// Um chamado concluído em dois períodos conta em cada célula mas aparece uma vez na lista.
const listaMenorQueNumero = computed(
  () => !!dados.value && props.numeroClicado !== null && props.numeroClicado !== meta.value.total,
)

const itens = computed(() => dados.value?.data ?? [])
const meta = computed(() => dados.value?.meta ?? { total: 0, last_page: 1 })
const comDestino = computed(
  () =>
    (props.fonte === 'consulta' && props.params?.contar === 'encaminhamentos') ||
    (props.fonte === 'fluxos' && (props.alvo?.modo === 'seta' || ['recebidos', 'encaminhados'].includes(props.alvo?.metrica))),
)

// Segunda linha do cabeçalho: o rótulo do filtro (fluxos) ou da linha/coluna clicada.
const subtitulo = computed(() => {
  const d = dados.value
  if (!d) return ''
  if (props.fonte === 'fluxos') return d.filtro?.rotulo ?? ''
  return [`Linha: ${d.linha?.rotulo}`, d.indicador?.rotulo, d.coluna?.rotulo].filter(Boolean).join(' · ')
})

const pronto = computed(() => (props.fonte === 'fluxos' ? !!props.alvo : props.chave !== null))

// Cada fonte tem seu endpoint de lista; as duas respondem no mesmo formato de itens.
function buscarChamados(consulta) {
  if (props.fonte === 'fluxos') return reportService.fluxosChamados(consulta)
  return props.fonte === 'indicadores'
    ? reportService.indicadoresChamados(consulta)
    : reportService.chamados(consulta)
}

// Encaminhamentos mostram também o destino; a coluna de pessoa é quem encaminhou.
const autorLabel = computed(() => (comDestino.value ? 'Quem encaminhou' : 'Analista'))

// Mesmo parâmetros do relatório + a linha/célula clicada. `chave` vai sempre
// como string: `__vazio__` e ids numéricos são comparados como texto no backend.
function montarParams(extra = {}) {
  if (props.fonte === 'fluxos') {
    const a = props.alvo
    const selecao = a.modo === 'seta' ? { origem: a.origem, destino: a.destino } : { no: a.no, metrica: a.metrica }
    return { ...props.params, ...selecao, ...extra }
  }
  const consulta = { ...props.params, chave: String(props.chave), ...extra }
  if (props.coluna) consulta.coluna = props.coluna
  if (props.fonte === 'indicadores') consulta.indicador = props.indicador
  return consulta
}

async function carregar() {
  if (!props.modelValue || !props.params || !pronto.value) return

  loading.value = true
  errorMessage.value = ''
  try {
    dados.value = await buscarChamados(
      montarParams({ page: page.value, per_page: PER_PAGE, formato: 'json' }),
    )
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar a lista de chamados.')
  } finally {
    loading.value = false
  }
}

// Cada abertura começa limpa na página 1, sem mostrar a lista anterior.
watch(
  () => [props.modelValue, props.chave, props.coluna, props.indicador, props.alvo],
  () => {
    if (!props.modelValue) return
    dados.value = null
    // Voltar à página 1 já dispara a carga pelo watch de `page`; só carrega
    // aqui quando a página não muda, para não duplicar a requisição.
    if (page.value !== 1) {
      page.value = 1
      return
    }
    carregar()
  },
)

watch(page, carregar)

async function baixarLista() {
  downloading.value = true
  errorMessage.value = ''
  try {
    const blob = await buscarChamados(montarParams({ formato: 'xlsx' }))
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    // Mesmo nome que o backend usa no Content-Disposition.
    const nomes = { indicadores: 'indicadores-chamados.xlsx', fluxos: 'mapa-de-fluxos-chamados.xlsx' }
    link.download = nomes[props.fonte] ?? 'relatorio-chamados.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível baixar a lista.')
  } finally {
    downloading.value = false
  }
}

function formatData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function fechar() {
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="1100" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-start justify-space-between" style="white-space: normal">
        <div>
          <div class="text-subtitle-1 font-weight-bold">{{ dados?.titulo ?? 'Chamados' }}</div>
          <div v-if="dados" class="text-body-2 text-medium-emphasis">
            {{ subtitulo }}
          </div>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" aria-label="Fechar" @click="fechar" />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-3">
          {{ errorMessage }}
        </v-alert>

        <v-progress-linear v-if="loading" indeterminate class="mb-2" />

        <div v-if="listaMenorQueNumero" class="text-body-2 text-medium-emphasis mb-2">
          <template v-if="fonte === 'indicadores'">
            {{ meta.total }} chamados — o total soma {{ numeroClicado }} porque um chamado conta em cada período em que o evento ocorreu, mas aparece uma vez nesta lista.
          </template>
          <template v-else>
            {{ meta.total }} chamados distintos — a linha soma {{ numeroClicado }} porque um chamado conta em cada período em que foi concluído.
          </template>
        </div>

        <v-table v-if="dados" density="compact">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Título</th>
              <th>Status</th>
              <th>Data</th>
              <th>{{ autorLabel }}</th>
              <th>Grupo de Solução</th>
              <th v-if="comDestino">Destino</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in itens" :key="`${item.incidente_id}-${index}`">
              <td class="text-no-wrap">
                <router-link v-if="item.acessivel" :to="`/incidents/${item.incidente_id}`" target="_blank">
                  #{{ item.incidente_id }}
                </router-link>
                <template v-else>
                  #{{ item.incidente_id }}
                  <v-chip size="x-small" variant="tonal" class="ml-1">fora dos seus grupos</v-chip>
                </template>
              </td>
              <td>{{ item.titulo }}</td>
              <td class="text-no-wrap">{{ STATUS_LABELS[item.status] ?? item.status }}</td>
              <td class="text-no-wrap">{{ formatData(item.data) }}</td>
              <td>{{ item.autor?.name ?? '—' }}</td>
              <td>{{ item.grupo_chamado?.nome ?? '—' }}</td>
              <td v-if="comDestino">{{ item.destino ?? '—' }}</td>
            </tr>
            <tr v-if="!itens.length && !loading">
              <td :colspan="comDestino ? 7 : 6" class="text-center text-medium-emphasis">Nenhum chamado.</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>

      <v-card-actions>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-file-excel-outline"
          :loading="downloading"
          :disabled="!dados"
          @click="baixarLista"
        >
          Baixar lista
        </v-btn>
        <v-spacer />
        <span v-if="dados" class="text-caption text-medium-emphasis mr-2">{{ meta.total }} no total</span>
        <v-pagination v-if="meta.last_page > 1" v-model="page" :length="meta.last_page" :total-visible="5" density="comfortable" />
        <v-btn variant="text" @click="fechar">Fechar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
