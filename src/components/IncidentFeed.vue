<script setup>
import { nextTick, onMounted, ref } from 'vue'
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

const newComment = ref('')
const posting = ref(false)

const editingId = ref(null)
const editText = ref('')
const savingEdit = ref(false)

const deleteOpen = ref(false)
const deleting = ref(false)
const entryToDelete = ref(null)

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR')
}

function isOwnComment(entry) {
  return entry.tipo === 'comentario' && entry.user?.id === auth.user?.id
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

async function submitComment() {
  if (!newComment.value.trim()) return

  posting.value = true
  errorMessage.value = ''

  try {
    const created = await incidentDescriptionService.create(props.incidentId, {
      descricao: newComment.value,
    })
    entries.value.push(created)
    newComment.value = ''
    await nextTick()
    scrollToBottom()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível adicionar o comentário.')
  } finally {
    posting.value = false
  }
}

function startEdit(entry) {
  editingId.value = entry.id
  editText.value = entry.descricao
}

function cancelEdit() {
  editingId.value = null
  editText.value = ''
}

async function saveEdit(entry) {
  if (!editText.value.trim()) return

  savingEdit.value = true
  errorMessage.value = ''

  try {
    const updated = await incidentDescriptionService.update(props.incidentId, entry.id, {
      descricao: editText.value,
    })
    const index = entries.value.findIndex((item) => item.id === entry.id)
    if (index !== -1) entries.value[index] = updated
    cancelEdit()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível editar o comentário.')
  } finally {
    savingEdit.value = false
  }
}

function askDelete(entry) {
  entryToDelete.value = entry
  deleteOpen.value = true
}

async function confirmDelete() {
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
</script>

<template>
  <v-card variant="outlined" class="d-flex flex-column" style="height: 640px">
    <v-card-title class="text-subtitle-1 font-weight-bold">Feed do incidente</v-card-title>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mx-4 mb-2">
      {{ errorMessage }}
    </v-alert>

    <div ref="feedBody" class="flex-grow-1 overflow-y-auto pa-4 pt-0">
      <div v-if="loading" class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="!entries.length" class="text-body-2 text-medium-emphasis text-center py-8">
        Nenhuma entrada no feed ainda.
      </div>

      <template v-for="entry in entries" :key="entry.id">
        <div v-if="entry.tipo === 'escalonamento'" class="d-flex justify-center my-3">
          <v-chip size="small" variant="tonal" color="default">
            {{ entry.descricao }} — {{ formatDateTime(entry.created_at) }}
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

              <template v-if="isOwnComment(entry) && editingId !== entry.id">
                <v-btn icon="mdi-pencil" variant="text" size="x-small" @click="startEdit(entry)" />
                <v-btn icon="mdi-delete" variant="text" size="x-small" color="error" @click="askDelete(entry)" />
              </template>
            </div>

            <div v-if="editingId === entry.id">
              <v-textarea v-model="editText" auto-grow rows="2" density="compact" hide-details class="mt-1" />
              <div class="d-flex justify-end mt-1">
                <v-btn variant="text" size="small" @click="cancelEdit">Cancelar</v-btn>
                <v-btn color="primary" size="small" :loading="savingEdit" @click="saveEdit(entry)">Salvar</v-btn>
              </div>
            </div>

            <div v-else class="text-body-2" style="white-space: pre-wrap">{{ entry.descricao }}</div>
          </div>
        </div>
      </template>
    </div>

    <v-card-actions v-if="auth.hasPermission('tickets.manage')" class="flex-column align-stretch pa-4 pt-0">
      <v-textarea
        v-model="newComment"
        label="Adicionar comentário"
        auto-grow
        rows="2"
        density="compact"
        hide-details
        class="mb-2"
      />
      <v-btn color="primary" block :loading="posting" :disabled="!newComment.trim()" @click="submitComment">
        Comentar
      </v-btn>
    </v-card-actions>
  </v-card>

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    message="Excluir este comentário? Essa ação não pode ser desfeita."
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
