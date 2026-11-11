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
})
const emit = defineEmits(['update:modelValue'])

const PER_PAGE = 50

const loading = ref(false)
const downloading = ref(false)
const errorMessage = ref('')
const dados = ref(null)
const page = ref(1)

const itens = computed(() => dados.value?.data ?? [])
const meta = computed(() => dados.value?.meta ?? { total: 0, last_page: 1 })
const comDestino = computed(() => props.params?.contar === 'encaminhamentos')

// Encaminhamentos mostram também o destino; a coluna de pessoa é quem encaminhou.
const autorLabel = computed(() => (comDestino.value ? 'Quem encaminhou' : 'Analista'))

// Mesmo parâmetros do relatório + a linha/célula clicada. `chave` vai sempre
// como string: `__vazio__` e ids numéricos são comparados como texto no backend.
function montarParams(extra = {}) {
  const consulta = { ...props.params, chave: String(props.chave), ...extra }
  if (props.coluna) consulta.coluna = props.coluna
  return consulta
}

async function carregar() {
  if (!props.modelValue || !props.params || props.chave === null) return

  loading.value = true
  errorMessage.value = ''
  try {
    dados.value = await reportService.chamados(
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
  () => [props.modelValue, props.chave, props.coluna],
  () => {
    if (!props.modelValue) return
    dados.value = null
    page.value = 1
    carregar()
  },
)

watch(page, carregar)

async function baixarLista() {
  downloading.value = true
  errorMessage.value = ''
  try {
    const blob = await reportService.chamados(montarParams({ formato: 'xlsx' }))
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    // Mesmo nome que o backend usa no Content-Disposition.
    link.download = 'relatorio-chamados.xlsx'
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
            Linha: {{ dados.linha?.rotulo }}<template v-if="dados.coluna"> · {{ dados.coluna.rotulo }}</template>
          </div>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" aria-label="Fechar" @click="fechar" />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-3">
          {{ errorMessage }}
        </v-alert>

        <v-progress-linear v-if="loading" indeterminate class="mb-2" />

        <v-table v-if="dados" density="compact">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Título</th>
              <th>Status</th>
              <th>Data</th>
              <th>{{ autorLabel }}</th>
              <th>Grupo do chamado</th>
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
