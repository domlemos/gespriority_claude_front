<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import attachmentService from '@/services/attachmentService'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  incidentId: { type: [String, Number], required: true },
})

const auth = useAuthStore()
const canManage = computed(() => auth.hasPermission('tickets.manage'))

const MAX_SIZE_BYTES = 10 * 1024 * 1024

const attachments = ref([])
const loading = ref(false)
const uploading = ref(false)
const errorMessage = ref('')
const fileInput = ref(null)

const previewOpen = ref(false)
const previewLoading = ref(false)
const previewUrl = ref('')
const previewAttachment = ref(null)

const previewIndex = computed(() =>
  attachments.value.findIndex((item) => item.id === previewAttachment.value?.id),
)
const hasPrevious = computed(() => previewIndex.value > 0)
const hasNext = computed(() => previewIndex.value !== -1 && previewIndex.value < attachments.value.length - 1)

const deleteOpen = ref(false)
const deleting = ref(false)
const attachmentToDelete = ref(null)

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function thumbIcon(mimeType) {
  if (!mimeType) return 'mdi-file-outline'
  if (mimeType.startsWith('image/')) return 'mdi-file-image-outline'
  if (mimeType === 'application/pdf') return 'mdi-file-pdf-box'
  if (mimeType.includes('word')) return 'mdi-file-word-outline'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'mdi-file-excel-outline'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'mdi-folder-zip-outline'
  return 'mdi-file-outline'
}

function isImage(attachment) {
  return Boolean(attachment?.mime_type?.startsWith('image/'))
}

function isPdf(attachment) {
  return attachment?.mime_type === 'application/pdf'
}

async function loadAttachments() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data } = await attachmentService.list(props.incidentId, { per_page: 100 })
    attachments.value = data
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os anexos.')
  } finally {
    loading.value = false
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

async function onFileSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  if (file.size > MAX_SIZE_BYTES) {
    errorMessage.value = 'O arquivo excede o tamanho máximo de 10 MB.'
    return
  }

  uploading.value = true
  errorMessage.value = ''

  try {
    const created = await attachmentService.upload(props.incidentId, file)
    attachments.value.unshift(created)
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível enviar o anexo.')
  } finally {
    uploading.value = false
  }
}

async function openPreview(attachment) {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }

  previewAttachment.value = attachment
  previewOpen.value = true
  previewLoading.value = true
  errorMessage.value = ''

  try {
    const blob = await attachmentService.download(props.incidentId, attachment.id)
    previewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível abrir o anexo.')
    previewOpen.value = false
  } finally {
    previewLoading.value = false
  }
}

function goToPrevious() {
  if (!hasPrevious.value) return
  openPreview(attachments.value[previewIndex.value - 1])
}

function goToNext() {
  if (!hasNext.value) return
  openPreview(attachments.value[previewIndex.value + 1])
}

function closePreview() {
  previewOpen.value = false
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
  previewAttachment.value = null
}

function askDelete(attachment) {
  attachmentToDelete.value = attachment
  deleteOpen.value = true
}

async function confirmDelete() {
  errorMessage.value = ''
  deleting.value = true

  try {
    await attachmentService.remove(props.incidentId, attachmentToDelete.value.id)
    attachments.value = attachments.value.filter((item) => item.id !== attachmentToDelete.value.id)
    deleteOpen.value = false
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o anexo.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}

onMounted(loadAttachments)

watch(() => props.incidentId, () => {
  loadAttachments()
})
</script>

<template>
  <div class="d-flex flex-column h-100" style="min-height: 0">
    <div v-if="canManage" class="pa-2 flex-shrink-0">
      <v-btn
        block
        variant="tonal"
        color="primary"
        prepend-icon="mdi-paperclip"
        :loading="uploading"
        @click="openFilePicker"
      >
        Anexar arquivo
      </v-btn>

      <input ref="fileInput" type="file" class="d-none" @change="onFileSelected" />
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mx-4 mb-2">
      {{ errorMessage }}
    </v-alert>

    <div class="flex-grow-1 overflow-y-auto pa-4 pt-0" style="min-height: 0">
      <div v-if="loading" class="d-flex justify-center py-6">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="!attachments.length" class="text-body-2 text-medium-emphasis text-center py-6">
        Nenhum anexo ainda.
      </div>

      <v-row v-else dense>
        <v-col v-for="attachment in attachments" :key="attachment.id" cols="6" sm="4">
          <v-card
            variant="outlined"
            class="pa-2 text-center attachment-card"
            style="cursor: pointer; position: relative"
            @click="openPreview(attachment)"
          >
            <v-btn
              v-if="canManage"
              icon="mdi-delete"
              variant="text"
              size="x-small"
              color="error"
              style="position: absolute; top: 0; right: 0"
              @click.stop="askDelete(attachment)"
            />

            <v-icon :icon="thumbIcon(attachment.mime_type)" size="40" color="primary" />

            <div class="text-caption text-truncate mt-1" :title="attachment.nome_original">
              {{ attachment.nome_original }}
            </div>
            <div class="text-caption text-medium-emphasis">{{ formatSize(attachment.tamanho) }}</div>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </div>

  <v-dialog :model-value="previewOpen" max-width="900" @update:model-value="(value) => !value && closePreview()">
    <v-card style="position: relative">
      <v-card-title class="d-flex align-center justify-space-between">
        <span class="text-truncate">{{ previewAttachment?.nome_original }}</span>
        <v-btn icon="mdi-close" variant="text" @click="closePreview" />
      </v-card-title>

      <v-btn
        v-if="attachments.length > 1"
        icon="mdi-chevron-left"
        variant="tonal"
        size="large"
        :disabled="!hasPrevious"
        style="position: absolute; top: 50%; left: 12px; transform: translateY(-50%); z-index: 1"
        @click="goToPrevious"
      />

      <v-btn
        v-if="attachments.length > 1"
        icon="mdi-chevron-right"
        variant="tonal"
        size="large"
        :disabled="!hasNext"
        style="position: absolute; top: 50%; right: 12px; transform: translateY(-50%); z-index: 1"
        @click="goToNext"
      />

      <v-card-text>
        <div v-if="previewLoading" class="d-flex justify-center py-12">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <template v-else>
          <img
            v-if="isImage(previewAttachment)"
            :src="previewUrl"
            style="max-width: 100%; max-height: 70vh; display: block; margin: 0 auto"
          />

          <iframe
            v-else-if="isPdf(previewAttachment)"
            :src="previewUrl"
            style="width: 100%; height: 70vh; border: none"
          />

          <div v-else class="text-center py-8">
            <v-icon icon="mdi-file-outline" size="64" color="primary" class="mb-4" />
            <div class="text-body-2 mb-4">Pré-visualização não disponível para este tipo de arquivo.</div>
            <v-btn
              color="primary"
              prepend-icon="mdi-download"
              :href="previewUrl"
              :download="previewAttachment?.nome_original"
            >
              Baixar arquivo
            </v-btn>
          </div>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    message="Excluir este anexo? Essa ação não pode ser desfeita."
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
