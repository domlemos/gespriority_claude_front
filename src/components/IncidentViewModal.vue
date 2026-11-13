<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import IncidentFeedPanel from '@/components/IncidentFeedPanel.vue'
import incidentService from '@/services/incidentService'
import { extractErrorMessage } from '@/utils/errors'
import {
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  ORIGEM_LABELS,
  TIPO_LABELS,
  TIPO_COLORS,
} from '@/utils/incidentLabels'

// Visualização do chamado sem sair da tela atual (ex.: lista de chamados de um
// relatório). Edição continua na página do chamado.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  incidentId: { type: [String, Number], default: null },
})

const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const incident = ref(null)
const loading = ref(false)
const errorMessage = ref('')

function formatDateTime(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '—'
}

function close() {
  emit('update:modelValue', false)
}

function abrirPagina() {
  const id = props.incidentId
  close()
  router.push(`/incidents/${id}`)
}

async function load() {
  incident.value = null
  errorMessage.value = ''
  loading.value = true
  try {
    incident.value = await incidentService.get(props.incidentId)
  } catch (error) {
    errorMessage.value =
      error?.response?.status === 404
        ? 'Chamado não encontrado.'
        : error?.response?.status === 403
          ? 'Você não tem acesso a este chamado.'
          : extractErrorMessage(error, 'Não foi possível carregar o chamado.')
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.incidentId],
  ([aberto, id]) => {
    if (aberto && id !== null && id !== undefined) load()
  },
  { immediate: true },
)
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="960" scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center text-subtitle-1 font-weight-bold">
        <span>Chamado #{{ incidentId }}</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" aria-label="Fechar" @click="close" />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable">
          {{ errorMessage }}
        </v-alert>

        <div v-else-if="loading" class="d-flex justify-center py-12">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <template v-else-if="incident">
          <div class="text-h6 mb-2">{{ incident.titulo }}</div>
          <div class="d-flex flex-wrap mb-4" style="gap: 8px">
            <v-chip size="small" variant="tonal" :color="STATUS_COLORS[incident.status]">
              {{ STATUS_LABELS[incident.status] ?? incident.status }}
            </v-chip>
            <v-chip size="small" variant="tonal" :color="TIPO_COLORS[incident.tipo]">
              {{ TIPO_LABELS[incident.tipo] ?? incident.tipo }}
            </v-chip>
            <v-chip v-if="incident.prioridade" size="small" variant="tonal" :color="PRIORIDADE_COLORS[incident.prioridade]">
              Prioridade {{ PRIORIDADE_LABELS[incident.prioridade] ?? incident.prioridade }}
            </v-chip>
          </div>

          <v-row dense class="mb-2">
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">Cliente</div>
              <div>{{ incident.customer?.name ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">Item</div>
              <div>{{ incident.item?.nome ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">Origem</div>
              <div>{{ ORIGEM_LABELS[incident.origem] ?? incident.origem ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">Grupo de Solução</div>
              <div>{{ incident.grupo_solucao?.nome ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">Responsável</div>
              <div>{{ incident.responsavel?.name ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">Aberto em</div>
              <div>{{ formatDateTime(incident.created_at) }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">Prazo de resposta</div>
              <div>{{ formatDateTime(incident.prazo_resposta) }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">Prazo de resolução</div>
              <div>{{ formatDateTime(incident.prazo_resolucao) }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">Concluído em</div>
              <div>{{ formatDateTime(incident.concluido_em) }}</div>
            </v-col>
          </v-row>

          <v-divider class="mb-4" />
          <IncidentFeedPanel :incident-id="incident.id" />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Fechar</v-btn>
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-open-in-app" :disabled="!incident" @click="abrirPagina">
          Abrir página do chamado
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
