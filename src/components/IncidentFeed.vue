<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import incidentDescriptionService from '@/services/incidentDescriptionService'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import { initials } from '@/utils/text'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  incidentId: { type: [String, Number], required: true },
})

const auth = useAuthStore()

const entries = ref([])
const loading = ref(false)
const errorMessage = ref('')
const feedBody = ref(null)

const commentModalOpen = ref(false)
const commentModalText = ref('')
const commentModalEntry = ref(null)
const commentModalSaving = ref(false)

const deleteOpen = ref(false)
const deleting = ref(false)
const entryToDelete = ref(null)

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR')
}

function isOwnComment(entry) {
  return entry.tipo === 'comentario' && entry.user?.id === auth.user?.id
}

// 'escalonamento' (mudança de grupo/responsável) e 'alteracao' (qualquer
// outro campo do incidente mudando — título, prioridade, origem, status,
// cliente, item) são ambos log de sistema gerado pelo backend
// (IncidenteController), renderizados como chip, nunca como bolha de
// comentário — só 'comentario' é editável/excluível pelo autor.
function isSystemLog(entry) {
  return entry.tipo === 'escalonamento' || entry.tipo === 'alteracao'
}

function systemLogIcon(entry) {
  if (entry.tipo === 'alteracao') return 'mdi-pencil-outline'
  if (entry.descricao.startsWith('Encaminhado')) return 'mdi-account-group'
  if (entry.descricao.startsWith('Atribuído')) return 'mdi-account-check'
  return 'mdi-information-outline'
}

function scrollToBottom() {
  if (feedBody.value) {
    feedBody.value.scrollTop = feedBody.value.scrollHeight
  }
}

async function loadFeed() {
  loading.value = true
  errorMessage.value = ''
  entries.value = []

  try {
    const { data } = await incidentDescriptionService.list(props.incidentId, { per_page: 100 })
    entries.value = [...data].reverse()
    await nextTick()
    scrollToBottom()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar o feed do incidente.')
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  commentModalEntry.value = null
  commentModalText.value = ''
  commentModalOpen.value = true
}

function openEditModal(entry) {
  commentModalEntry.value = entry
  commentModalText.value = entry.descricao
  commentModalOpen.value = true
}

function closeCommentModal() {
  commentModalOpen.value = false
  commentModalEntry.value = null
  commentModalText.value = ''
}

async function submitCommentModal() {
  if (!commentModalText.value.trim()) return

  commentModalSaving.value = true
  errorMessage.value = ''

  try {
    if (commentModalEntry.value) {
      const updated = await incidentDescriptionService.update(props.incidentId, commentModalEntry.value.id, {
        descricao: commentModalText.value,
      })
      const index = entries.value.findIndex((item) => item.id === commentModalEntry.value.id)
      if (index !== -1) entries.value[index] = updated
    } else {
      const created = await incidentDescriptionService.create(props.incidentId, {
        descricao: commentModalText.value,
      })
      entries.value.push(created)
      await nextTick()
      scrollToBottom()
    }
    closeCommentModal()
  } catch (error) {
    errorMessage.value = extractErrorMessage(
      error,
      commentModalEntry.value ? 'Não foi possível editar o comentário.' : 'Não foi possível adicionar o comentário.',
    )
  } finally {
    commentModalSaving.value = false
  }
}

function askDelete(entry) {
  entryToDelete.value = entry
  deleteOpen.value = true
}

async function confirmDelete() {
  errorMessage.value = ''
  deleting.value = true

  try {
    await incidentDescriptionService.remove(props.incidentId, entryToDelete.value.id)
    entries.value = entries.value.filter((item) => item.id !== entryToDelete.value.id)
    deleteOpen.value = false
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o comentário.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}

onMounted(loadFeed)

watch(() => props.incidentId, () => {
  loadFeed()
})

defineExpose({ reload: loadFeed })
</script>

<template>
  <div class="d-flex flex-column h-100" style="min-height: 0">
    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mx-4 mt-2 mb-2">
      {{ errorMessage }}
    </v-alert>

    <div ref="feedBody" class="flex-grow-1 overflow-y-auto pa-4" style="min-height: 0">
      <div v-if="loading" class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="!entries.length" class="text-body-2 text-medium-emphasis text-center py-8">
        Nenhuma entrada no feed ainda.
      </div>

      <template v-for="entry in entries" :key="entry.id">
        <div v-if="isSystemLog(entry)" class="d-flex justify-end my-3">
          <!--
            Sem `— formatDateTime(entry.created_at)` aqui de propósito — a
            mensagem gerada pelo backend (IncidenteController) já embute a
            data/hora ("às HH:mm do dia DD/MM/AAAA."), então concatenar de
            novo duplicava a data no chip.
          -->
          <v-chip size="small" variant="tonal" color="default" :prepend-icon="systemLogIcon(entry)">
            {{ entry.user?.name }}: {{ entry.descricao }}
          </v-chip>
        </div>

        <div v-else class="d-flex mb-4">
          <v-avatar color="primary" size="36" class="mr-3">
            <span class="text-caption font-weight-bold">{{ initials(entry.user?.name) }}</span>
          </v-avatar>

          <div class="flex-grow-1">
            <div class="d-flex align-center">
              <span class="font-weight-bold text-body-2 mr-2">{{ entry.user?.name }}</span>
              <span class="text-caption text-medium-emphasis">{{ formatDateTime(entry.created_at) }}</span>

              <v-spacer />

              <template v-if="isOwnComment(entry)">
                <v-btn icon="mdi-pencil" variant="text" size="x-small" @click="openEditModal(entry)" />
                <v-btn icon="mdi-delete" variant="text" size="x-small" color="error" @click="askDelete(entry)" />
              </template>
            </div>

            <div class="text-body-2" style="white-space: pre-wrap">{{ entry.descricao }}</div>
          </div>
        </div>
      </template>
    </div>

    <div v-if="auth.hasPermission('tickets.manage')" class="pa-4 pt-0 flex-shrink-0">
      <v-btn color="primary" block prepend-icon="mdi-comment-plus-outline" @click="openCreateModal">
        Adicionar Comentário
      </v-btn>
    </div>
  </div>

  <v-dialog v-model="commentModalOpen" max-width="640">
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">
        {{ commentModalEntry ? 'Editar comentário' : 'Adicionar comentário' }}
      </v-card-title>

      <v-card-text>
        <v-textarea
          v-model="commentModalText"
          auto-grow
          rows="8"
          density="comfortable"
          hide-details
          autofocus
          placeholder="Escreva seu comentário..."
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="closeCommentModal">Cancelar</v-btn>
        <v-btn
          color="primary"
          :loading="commentModalSaving"
          :disabled="!commentModalText.trim()"
          @click="submitCommentModal"
        >
          {{ commentModalEntry ? 'Salvar' : 'Comentar' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    message="Excluir este comentário? Essa ação não pode ser desfeita."
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
