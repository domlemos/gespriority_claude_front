<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SlaFormModal from '@/components/admin/SlaFormModal.vue'
import SlaAdvancedFilterModal from '@/components/admin/SlaAdvancedFilterModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import slaService from '@/services/slaService'
import clientService from '@/services/clientService'
import { extractErrorMessage } from '@/utils/errors'
import { formatDurationMinutes } from '@/utils/duration'
import { prioridadeLabel } from '@/utils/incidentLabels'
import ResponsiveDataTable from '@/components/ResponsiveDataTable.vue'

const PRIORIDADE_COLORS = {
  baixa: 'secondary',
  media: 'info',
  alta: 'warning',
  urgente: 'error',
}

const { t } = useI18n()

const headers = computed(() => [
  { title: t('admin.common.name'), key: 'nome', sortable: false },
  { title: t('admin.common.priority'), key: 'prioridade', sortable: false },
  { title: t('admin.common.client'), key: 'client_id', sortable: false },
  { title: t('admin.slas.response'), key: 'tempo_resposta_minutos', sortable: false },
  { title: t('admin.slas.resolution'), key: 'tempo_resolucao_minutos', sortable: false },
  { title: t('admin.slas.businessHours'), key: 'apenas_horas_uteis', sortable: false },
  { title: t('admin.common.active'), key: 'ativo', sortable: false },
  { title: t('common.actions'), key: 'actions', sortable: false, align: 'end' },
])

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)
const clientNames = ref({})
const clientOptions = ref([])

const formOpen = ref(false)
const editingSla = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const slaToDelete = ref(null)

const filterModalOpen = ref(false)
const appliedFilters = ref({})

const hasActiveFilters = computed(() =>
  Object.values(appliedFilters.value).some((value) => value !== null && value !== undefined),
)

function clientName(clientId) {
  return clientId === null ? t('admin.slas.global') : (clientNames.value[clientId] ?? `#${clientId}`)
}

async function loadClientNames() {
  const { data } = await clientService.list({ per_page: 200 })
  clientOptions.value = data
  clientNames.value = Object.fromEntries(data.map((client) => [client.id, client.name]))
}

function clearFilters() {
  appliedFilters.value = {}
  page.value = 1
  loadSlas()
}

function applyFilters(filters) {
  appliedFilters.value = filters
  page.value = 1
  loadSlas()
}

function buildFilterParams() {
  const params = {}
  for (const [key, value] of Object.entries(appliedFilters.value)) {
    if (value !== null && value !== undefined) params[key] = value
  }
  return params
}

async function loadSlas() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await slaService.list({
      page: page.value,
      per_page: itemsPerPage.value,
      ...buildFilterParams(),
    })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('admin.slas.loadError'))
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadSlas()
}

function openCreate() {
  editingSla.value = null
  formOpen.value = true
}

function openEdit(sla) {
  editingSla.value = sla
  formOpen.value = true
}

function askDelete(sla) {
  slaToDelete.value = sla
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await slaService.remove(slaToDelete.value.id)
    deleteOpen.value = false
    await loadSlas()

    if (items.value.length === 0 && page.value > 1) {
      page.value -= 1
      await loadSlas()
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('admin.slas.deleteError'))
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}

loadClientNames()
</script>

<template>
  <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
    <h1 class="text-h5 font-weight-bold">{{ $t('admin.slas.title') }}</h1>
    <div class="d-flex flex-wrap align-center ga-2">
      <v-btn v-if="hasActiveFilters" variant="text" size="small" prepend-icon="mdi-filter-off" @click="clearFilters">
        {{ $t('admin.common.clearFilters') }}
      </v-btn>
      <v-btn variant="outlined" prepend-icon="mdi-filter-variant" @click="filterModalOpen = true">
        {{ $t('admin.common.advancedFilter') }}
      </v-btn>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">{{ $t('admin.slas.new') }}</v-btn>
    </div>
  </div>

  <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
    {{ errorMessage }}
  </v-alert>

  <SlaAdvancedFilterModal
    v-model="filterModalOpen"
    :filters="appliedFilters"
    :client-options="clientOptions"
    @apply="applyFilters"
  />

  <ResponsiveDataTable
    :headers="headers"
    :items="items"
    :items-length="totalItems"
    :items-per-page="itemsPerPage"
    :loading="loading"
    @update:options="onOptionsUpdate"
  >
    <template #item.prioridade="{ item }">
      <v-chip size="small" :color="PRIORIDADE_COLORS[item.prioridade]" variant="tonal">
        {{ prioridadeLabel(item.prioridade) }}
      </v-chip>
    </template>

    <template #item.client_id="{ item }">
      {{ clientName(item.client_id) }}
    </template>

    <template #item.tempo_resposta_minutos="{ item }">
      {{ formatDurationMinutes(item.tempo_resposta_minutos) }}
    </template>

    <template #item.tempo_resolucao_minutos="{ item }">
      {{ formatDurationMinutes(item.tempo_resolucao_minutos) }}
    </template>

    <template #item.apenas_horas_uteis="{ item }">
      {{ item.apenas_horas_uteis ? $t('admin.common.yes') : $t('admin.common.no') }}
    </template>

    <template #item.ativo="{ item }">
      <v-chip size="small" :color="item.ativo ? 'success' : 'default'" variant="tonal">
        {{ item.ativo ? $t('admin.common.active') : $t('admin.common.inactive') }}
      </v-chip>
    </template>

    <template #item.actions="{ item }">
      <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(item)" />
      <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
    </template>
  </ResponsiveDataTable>

  <SlaFormModal v-model="formOpen" :sla="editingSla" @saved="loadSlas" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message="$t('admin.slas.deleteMessage', { name: slaToDelete?.nome })"
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
