<script setup>
import { computed, ref, watch } from 'vue'
import portalIncidentService from '@/services/portalIncidentService'
import { extractErrorMessage } from '@/utils/errors'
import { STATUS_LABELS, STATUS_COLORS } from '@/utils/incidentLabels'

// Chamado do cliente: dados básicos, histórico (só a abertura, os próprios
// comentários e a mensagem de encerramento — filtrado no backend) e
// comentário novo enquanto o chamado não foi encerrado.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  incidentId: { type: [String, Number], default: null },
})

const emit = defineEmits(['update:modelValue'])

const incident = ref(null)
const loading = ref(false)
const errorMessage = ref('')
const comentario = ref('')
const sending = ref(false)
const commentError = ref('')

// Mesma regra do backend: chamado encerrado não aceita comentário novo.
const aceitaComentario = computed(() => incident.value && !['fechado', 'cancelado'].includes(incident.value.status))

function formatDateTime(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '—'
}

function initials(name) {
  return (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function close() {
  if (!sending.value) emit('update:modelValue', false)
}

async function load() {
  incident.value = null
  comentario.value = ''
  commentError.value = ''
  errorMessage.value = ''
  loading.value = true

  try {
    incident.value = await portalIncidentService.get(props.incidentId)
  } catch (error) {
    errorMessage.value =
      error?.response?.status === 404
        ? 'Chamado não encontrado.'
        : extractErrorMessage(error, 'Não foi possível carregar o chamado.')
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
    commentError.value = extractErrorMessage(error, 'Não foi possível enviar o comentário.')
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
        Chamado #{{ incidentId }}
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
          <div class="d-flex align-center flex-wrap ga-2 mb-1">
            <span class="text-h6 font-weight-bold">{{ incident.titulo }}</span>
            <v-chip size="small" :color="STATUS_COLORS[incident.status]" variant="tonal">
              {{ STATUS_LABELS[incident.status] ?? incident.status }}
            </v-chip>
          </div>
          <div class="text-caption text-medium-emphasis mb-4">
            Aberto em {{ formatDateTime(incident.created_at) }} · Atualizado em {{ formatDateTime(incident.updated_at) }}
          </div>

          <div class="text-subtitle-2 font-weight-bold mb-3">Histórico</div>

          <div v-for="entry in incident.descricoes" :key="entry.id" class="d-flex mb-4">
            <v-avatar :color="entry.autor.equipe ? 'primary' : 'grey-darken-1'" size="36" class="mr-3">
              <span class="text-caption font-weight-bold">{{ initials(entry.autor.nome) }}</span>
            </v-avatar>

            <div class="flex-grow-1">
              <div class="d-flex align-center flex-wrap ga-2">
                <span class="font-weight-bold text-body-2">{{ entry.autor.nome }}</span>
                <span v-if="entry.autor.equipe" class="text-caption text-medium-emphasis">(equipe de suporte)</span>
                <span class="text-caption text-medium-emphasis">{{ formatDateTime(entry.created_at) }}</span>
                <v-chip
                  v-if="entry.tipo === 'encerramento'"
                  size="x-small"
                  variant="tonal"
                  color="success"
                  prepend-icon="mdi-check-circle-outline"
                >
                  Encerramento
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
              label="Adicionar comentário"
              hint="Envie mais detalhes ou responda à equipe de suporte."
              persistent-hint
              rows="3"
              auto-grow
              counter="5000"
              :maxlength="5000"
            />
          </template>
          <div v-else class="text-body-2 text-medium-emphasis">
            Este chamado foi encerrado e não aceita novos comentários.
          </div>
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <!-- "Voltar", não "Fechar": evita parecer que encerra o chamado. -->
        <v-btn variant="text" :disabled="sending" @click="close">Voltar</v-btn>
        <v-btn
          v-if="aceitaComentario"
          color="primary"
          :loading="sending"
          :disabled="!comentario.trim()"
          @click="enviarComentario"
        >
          Comentar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
