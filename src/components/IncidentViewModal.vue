<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import IncidentFeedPanel from '@/components/IncidentFeedPanel.vue'
import incidentService from '@/services/incidentService'
import { extractErrorMessage } from '@/utils/errors'
import { formatDateTime as formatDateTimeLocale } from '@/utils/format'
import {
  prioridadeLabel,
  PRIORIDADE_COLORS,
  statusLabel,
  STATUS_COLORS,
  origemLabel,
  tipoLabel,
  TIPO_COLORS,
} from '@/utils/incidentLabels'

// Visualização do chamado sem sair da tela atual (ex.: lista de chamados de um
// relatório). Edição continua na página do chamado.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  incidentId: { type: [String, Number], default: null },
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const router = useRouter()
const incident = ref(null)
const loading = ref(false)
const errorMessage = ref('')

function formatDateTime(iso) {
  return iso ? formatDateTimeLocale(iso) : '—'
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
        ? t('incidents.view.notFound')
        : error?.response?.status === 403
          ? t('incidents.view.forbidden')
          : extractErrorMessage(error, t('incidents.view.loadError'))
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
        <span>{{ $t('incidents.view.title', { id: incidentId }) }}</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" :aria-label="$t('common.close')" @click="close" />
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
              {{ statusLabel(incident.status) }}
            </v-chip>
            <v-chip size="small" variant="tonal" :color="TIPO_COLORS[incident.tipo]">
              {{ tipoLabel(incident.tipo) }}
            </v-chip>
            <v-chip v-if="incident.prioridade" size="small" variant="tonal" :color="PRIORIDADE_COLORS[incident.prioridade]">
              {{ $t('incidents.view.priority', { label: prioridadeLabel(incident.prioridade) }) }}
            </v-chip>
          </div>

          <v-row dense class="mb-2">
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ $t('incidents.view.cliente') }}</div>
              <div>{{ incident.customer?.name ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ $t('incidents.view.item') }}</div>
              <div>{{ incident.item?.nome ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ $t('incidents.view.origem') }}</div>
              <div>{{ origemLabel(incident.origem) ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ $t('incidents.view.grupoSolucao') }}</div>
              <div>{{ incident.grupo_solucao?.nome ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ $t('incidents.view.responsavel') }}</div>
              <div>{{ incident.responsavel?.name ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ $t('incidents.view.abertoEm') }}</div>
              <div>{{ formatDateTime(incident.created_at) }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ $t('incidents.view.prazoResposta') }}</div>
              <div>{{ formatDateTime(incident.prazo_resposta) }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ $t('incidents.view.prazoResolucao') }}</div>
              <div>{{ formatDateTime(incident.prazo_resolucao) }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ $t('incidents.view.concluidoEm') }}</div>
              <div>{{ formatDateTime(incident.concluido_em) }}</div>
            </v-col>
          </v-row>

          <v-divider class="mb-4" />
          <IncidentFeedPanel :incident-id="incident.id" />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.close') }}</v-btn>
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-open-in-app" :disabled="!incident" @click="abrirPagina">
          {{ $t('incidents.view.openPage') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
