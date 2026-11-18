<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import portalIncidentService from '@/services/portalIncidentService'
import { extractErrorMessage } from '@/utils/errors'
import { formatDate, formatDateTime } from '@/utils/format'
import { statusLabel, STATUS_COLORS } from '@/utils/incidentLabels'

// Chamado do cliente: dados básicos, histórico (só a abertura, os próprios
// comentários e a mensagem de encerramento — filtrado no backend) e
// comentário novo enquanto o chamado não foi encerrado. Chamado fechado há
// até 7 dias pode ser reaberto pelo cliente, com motivo (`pode_reabrir`).
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  incidentId: { type: [String, Number], default: null },
})

const emit = defineEmits(['update:modelValue', 'reopened'])

const { t } = useI18n()

const incident = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const comentario = ref('')
const sending = ref(false)
const commentError = ref('')

const reabrindo = ref(false)
const motivo = ref('')
const reopenError = ref('')
const reopenedMessage = ref('')

// Mesma regra do backend: só chamado fechado recusa comentário (para ele há a
// reabertura); cancelado aceita, já que em geral foi o cliente quem pediu.
const aceitaComentario = computed(() => incident.value && incident.value.status !== 'fechado')

function initials(name) {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

const fechadoSemReabertura = computed(() => incident.value?.status === 'fechado' && !incident.value.pode_reabrir)

function dateOrDash(iso) {
  return iso ? formatDate(iso) : '—'
}

function dateTimeOrDash(iso) {
  return iso ? formatDateTime(iso) : '—'
}

function close() {
  if (!sending.value) emit('update:modelValue', false)
}

function iniciarReabertura() {
  reabrindo.value = true
  motivo.value = ''
  reopenError.value = ''
}

async function confirmarReabertura() {
  sending.value = true
  reopenError.value = ''

  try {
    incident.value = await portalIncidentService.reopen(props.incidentId, motivo.value.trim())
    reabrindo.value = false
    motivo.value = ''
    reopenedMessage.value = t('portal.modal.reopened')
    emit('reopened', incident.value)
  } catch (error) {
    reopenError.value = extractErrorMessage(error, t('portal.modal.reopenError'))
  } finally {
    sending.value = false
  }
}

async function load() {
  incident.value = null
  comentario.value = ''
  commentError.value = ''
  errorMessage.value = ''
  reabrindo.value = false
  motivo.value = ''
  reopenError.value = ''
  reopenedMessage.value = ''
  loading.value = true

  try {
    incident.value = await portalIncidentService.get(props.incidentId)
  } catch (error) {
    errorMessage.value =
      error?.response?.status === 404
        ? t('portal.modal.notFound')
        : extractErrorMessage(error, t('portal.modal.loadError'))
  } finally {
    loading.value = false
  }
}

async function enviarComentario() {
  sending.value = true
  commentError.value = ''

  try {
    const entrada = await portalIncidentService.comment(props.incidentId, comentario.value.trim())
    incident.value.descricoes.push(entrada)
    comentario.value = ''
  } catch (error) {
    commentError.value = extractErrorMessage(error, t('portal.modal.commentError'))
  } finally {
    sending.value = false
  }
}

watch(
  () => [props.modelValue, props.incidentId],
  ([open, id]) => {
    if (open && id) load()
  },
  { immediate: true },
)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="860"
    scrollable
    :persistent="sending"
    @update:model-value="(value) => !value && close()"
  >
    <v-card>
      <v-card-title class="d-flex align-center text-subtitle-1 font-weight-bold">
        {{ $t('portal.modal.title', { id: incidentId }) }}
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" density="comfortable" :disabled="sending" @click="close" />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <div v-if="loading" class="d-flex justify-center py-12">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <template v-else-if="incident">
          <v-alert v-if="reopenedMessage" type="success" variant="tonal" density="comfortable" class="mb-4">
            {{ reopenedMessage }}
          </v-alert>
          <div class="d-flex align-center flex-wrap ga-2 mb-1">
            <span class="text-h6 font-weight-bold">{{ incident.titulo }}</span>
            <v-chip size="small" :color="STATUS_COLORS[incident.status]" variant="tonal">
              {{ statusLabel(incident.status) }}
            </v-chip>
          </div>
          <div class="text-caption text-medium-emphasis mb-4">
            {{ $t('portal.modal.openedUpdated', { created: dateTimeOrDash(incident.created_at), updated: dateTimeOrDash(incident.updated_at) }) }}
          </div>

          <div class="text-subtitle-2 font-weight-bold mb-3">{{ $t('portal.modal.history') }}</div>

          <div v-for="entry in incident.descricoes" :key="entry.id" class="d-flex mb-4">
            <v-avatar :color="entry.autor.equipe ? 'primary' : 'grey-darken-1'" size="36" class="mr-3">
              <span class="text-caption font-weight-bold">{{ initials(entry.autor.nome) }}</span>
            </v-avatar>

            <div class="flex-grow-1">
              <div class="d-flex align-center flex-wrap ga-2">
                <span class="font-weight-bold text-body-2">{{ entry.autor.nome }}</span>
                <span v-if="entry.autor.equipe" class="text-caption text-medium-emphasis">{{ $t('portal.modal.supportTeam') }}</span>
                <span class="text-caption text-medium-emphasis">{{ dateTimeOrDash(entry.created_at) }}</span>
                <v-chip
                  v-if="entry.tipo === 'encerramento'"
                  size="x-small"
                  variant="tonal"
                  color="success"
                  prepend-icon="mdi-check-circle-outline"
                >
                  {{ $t('portal.modal.closing') }}
                </v-chip>
              </div>
              <div class="text-body-2" style="white-space: pre-wrap">{{ entry.descricao }}</div>
            </div>
          </div>

          <v-divider class="my-4" />

          <template v-if="aceitaComentario">
            <v-alert v-if="commentError" type="error" variant="tonal" density="comfortable" class="mb-3">
              {{ commentError }}
            </v-alert>
            <v-textarea
              v-model="comentario"
              :label="$t('portal.modal.addComment')"
              :hint="$t('portal.modal.commentHint')"
              persistent-hint
              rows="3"
              auto-grow
              counter="5000"
              :maxlength="5000"
            />
          </template>
          <template v-else-if="incident.pode_reabrir">
            <div v-if="!reabrindo" class="d-flex align-center flex-wrap ga-3">
              <span class="text-body-2 text-medium-emphasis flex-grow-1">
                {{ $t('portal.modal.reopenPrompt', { date: dateOrDash(incident.reabrir_ate) }) }}
              </span>
              <v-btn color="primary" variant="tonal" prepend-icon="mdi-restore" @click="iniciarReabertura">
                {{ $t('portal.modal.reopen') }}
              </v-btn>
            </div>
            <template v-else>
              <v-alert v-if="reopenError" type="error" variant="tonal" density="comfortable" class="mb-3">
                {{ reopenError }}
              </v-alert>
              <v-textarea
                v-model="motivo"
                :label="$t('portal.modal.reopenReason')"
                :hint="$t('portal.modal.reopenHint')"
                persistent-hint
                rows="3"
                auto-grow
                counter="5000"
                :maxlength="5000"
                autofocus
              />
            </template>
          </template>
          <div v-else class="text-body-2 text-medium-emphasis">
            <template v-if="fechadoSemReabertura">
              {{ $t('portal.modal.finalClosed', { date: dateOrDash(incident.reabrir_ate) }) }}
            </template>
            <template v-else>{{ $t('portal.modal.closedNoComments') }}</template>
          </div>
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <!-- "Voltar", não "Fechar": evita parecer que encerra o chamado. -->
        <v-btn variant="text" :disabled="sending" @click="close">{{ $t('portal.modal.back') }}</v-btn>
        <v-btn v-if="reabrindo" variant="text" :disabled="sending" @click="reabrindo = false">{{ $t('common.cancel') }}</v-btn>
        <v-btn
          v-if="reabrindo"
          color="primary"
          :loading="sending"
          :disabled="!motivo.trim()"
          @click="confirmarReabertura"
        >
          {{ $t('portal.modal.reopenConfirm') }}
        </v-btn>
        <v-btn
          v-if="aceitaComentario"
          color="primary"
          :loading="sending"
          :disabled="!comentario.trim()"
          @click="enviarComentario"
        >
          {{ $t('portal.modal.comment') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
