<script setup>
import { computed, ref, watch } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import portalIncidentService from '@/services/portalIncidentService'
import { extractErrorMessage } from '@/utils/errors'
import { STATUS_LABELS, STATUS_COLORS } from '@/utils/incidentLabels'

const props = defineProps({
  id: { type: [String, Number], required: true },
})

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

async function load() {
  loading.value = true
  errorMessage.value = ''

  try {
    incident.value = await portalIncidentService.get(props.id)
  } catch (error) {
    incident.value = null
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
    const entrada = await portalIncidentService.comment(props.id, comentario.value.trim())
    incident.value.descricoes.push(entrada)
    comentario.value = ''
  } catch (error) {
    commentError.value = extractErrorMessage(error, 'Não foi possível enviar o comentário.')
  } finally {
    sending.value = false
  }
}

watch(() => props.id, load, { immediate: true })
</script>

<template>
  <AppLayout>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" density="comfortable" class="mr-2" :to="{ name: 'portal' }" />
      <h1 class="text-h5 font-weight-bold ma-0">Chamado #{{ id }}</h1>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else-if="incident">
      <v-card variant="outlined" class="mb-4" max-width="860">
        <v-card-text>
          <div class="d-flex align-center flex-wrap ga-2 mb-2">
            <span class="text-h6 font-weight-bold">{{ incident.titulo }}</span>
            <v-chip size="small" :color="STATUS_COLORS[incident.status]" variant="tonal">
              {{ STATUS_LABELS[incident.status] ?? incident.status }}
            </v-chip>
          </div>
          <div class="text-caption text-medium-emphasis">
            Aberto em {{ formatDateTime(incident.created_at) }} · Atualizado em {{ formatDateTime(incident.updated_at) }}
          </div>
        </v-card-text>
      </v-card>

      <v-card variant="outlined" max-width="860">
        <v-card-title class="text-subtitle-1 font-weight-bold">Histórico</v-card-title>

        <v-card-text>
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
              class="mb-2"
            />
            <div class="d-flex justify-end">
              <v-btn color="primary" :loading="sending" :disabled="!comentario.trim()" @click="enviarComentario">
                Comentar
              </v-btn>
            </div>
          </template>
          <div v-else class="text-body-2 text-medium-emphasis">
            Este chamado foi encerrado e não aceita novos comentários.
          </div>
        </v-card-text>
      </v-card>
    </template>
  </AppLayout>
</template>
