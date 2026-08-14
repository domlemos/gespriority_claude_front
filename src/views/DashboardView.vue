<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import incidentService from '@/services/incidentService'
import customerService from '@/services/customerService'
import categoryService from '@/services/categoryService'
import subcategoryService from '@/services/subcategoryService'
import itemService from '@/services/itemService'
import solutionGroupService from '@/services/solutionGroupService'
import userService from '@/services/userService'
import { extractErrorMessage } from '@/utils/errors'
import {
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  ORIGEM_LABELS,
  SLA_STATUS_LABELS,
  SLA_STATUS_COLORS,
  formatRemainingMinutes,
} from '@/utils/incidentLabels'

const auth = useAuthStore()
const router = useRouter()

const statusOptions = Object.entries(STATUS_LABELS).map(([value, title]) => ({ value, title }))
const priorityOptions = Object.entries(PRIORIDADE_LABELS).map(([value, title]) => ({ value, title }))
const originOptions = Object.entries(ORIGEM_LABELS).map(([value, title]) => ({ value, title }))

const headers = [
  { title: 'Número', key: 'numero', sortable: false },
  { title: 'Título', key: 'titulo', sortable: false },
  { title: 'Cliente', key: 'cliente', sortable: false },
  { title: 'Classificação', key: 'classificacao', sortable: false },
  { title: 'Prioridade', key: 'prioridade', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Grupo', key: 'grupo_solucao', sortable: false },
  { title: 'Responsável', key: 'responsavel', sortable: false },
  { title: 'Abertura', key: 'data_abertura', sortable: false },
  { title: 'SLA Resposta', key: 'status_sla_resposta', sortable: false },
  { title: 'SLA Resolução', key: 'status_sla_resolucao', sortable: false },
]

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR')
}

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)

const statusFilter = ref(null)
const prioridadeFilter = ref(null)
const origemFilter = ref(null)
const customerFilter = ref(null)
const categoriaFilter = ref(null)
const subcategoriaFilter = ref(null)
const itemFilter = ref(null)
const grupoSolucaoFilter = ref(null)
const responsavelFilter = ref(null)

const customerOptions = ref([])
const categoryOptions = ref([])
const subcategoryOptions = ref([])
const itemOptions = ref([])
const solutionGroupOptions = ref([])
const userOptions = ref([])

const filteredSubcategoryOptions = computed(() =>
  categoriaFilter.value
    ? subcategoryOptions.value.filter((sub) => sub.categoria_id === categoriaFilter.value)
    : [],
)

const filteredItemOptions = computed(() =>
  subcategoriaFilter.value
    ? itemOptions.value.filter((item) => item.subcategoria_id === subcategoriaFilter.value)
    : [],
)

const hasActiveFilters = computed(() =>
  [statusFilter, prioridadeFilter, origemFilter, customerFilter, itemFilter, grupoSolucaoFilter, responsavelFilter]
    .some((filter) => filter.value !== null),
)

function customerLabel(customer) {
  if (!customer || typeof customer !== 'object') return ''
  return `${customer.client?.name ?? '—'} — ${customer.name} (${customer.email})`
}

function classification(item) {
  if (!item.categoria) return '—'
  return [item.categoria, item.subcategoria, item.item].filter(Boolean).join(' / ')
}

function onCategoriaFilterChange() {
  subcategoriaFilter.value = null
  itemFilter.value = null
}

function onSubcategoriaFilterChange() {
  itemFilter.value = null
}

function clearFilters() {
  statusFilter.value = null
  prioridadeFilter.value = null
  origemFilter.value = null
  customerFilter.value = null
  categoriaFilter.value = null
  subcategoriaFilter.value = null
  itemFilter.value = null
  grupoSolucaoFilter.value = null
  responsavelFilter.value = null
}

async function loadFilterOptions() {
  try {
    const [customers, categories, subcategories, taxonomyItems, groups, users] = await Promise.all([
      customerService.list({ per_page: 200 }),
      categoryService.list({ per_page: 200 }),
      subcategoryService.list({ per_page: 200 }),
      itemService.list({ per_page: 200 }),
      solutionGroupService.list({ per_page: 200 }),
      userService.list({ per_page: 200 }),
    ])
    customerOptions.value = customers.data
    categoryOptions.value = categories.data
    subcategoryOptions.value = subcategories.data
    itemOptions.value = taxonomyItems.data
    solutionGroupOptions.value = groups.data
    userOptions.value = users.data
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as opções de filtro.')
  }
}

function buildFilterParams() {
  const params = {}
  if (statusFilter.value) params.status = statusFilter.value
  if (prioridadeFilter.value) params.prioridade = prioridadeFilter.value
  if (origemFilter.value) params.origem = origemFilter.value
  if (customerFilter.value) params.customer_id = customerFilter.value
  if (itemFilter.value) params.item_id = itemFilter.value
  if (grupoSolucaoFilter.value) params.grupo_solucao_id = grupoSolucaoFilter.value
  if (responsavelFilter.value) params.responsavel_id = responsavelFilter.value
  return params
}

async function loadIncidents() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await incidentService.dashboard({
      page: page.value,
      per_page: itemsPerPage.value,
      ...buildFilterParams(),
    })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os incidentes.')
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadIncidents()
}

watch(
  [statusFilter, prioridadeFilter, origemFilter, customerFilter, itemFilter, grupoSolucaoFilter, responsavelFilter],
  () => {
    page.value = 1
    loadIncidents()
  },
)

function onRowClick(event, { item }) {
  router.push({ name: 'incident-edit', params: { id: item.numero } })
}

function openCreate() {
  router.push({ name: 'incident-new' })
}

loadFilterOptions()
</script>

<template>
  <AppLayout fluid>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5 font-weight-bold">Incidentes</h1>
      <v-btn v-if="auth.hasPermission('tickets.manage')" color="primary" prepend-icon="mdi-plus" @click="openCreate">
        Novo Incidente
      </v-btn>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-card variant="outlined" class="pa-4 mb-4">
      <div class="d-flex align-center justify-space-between mb-2">
        <span class="text-subtitle-2 font-weight-bold">Filtros</span>
        <v-btn v-if="hasActiveFilters" variant="text" size="small" prepend-icon="mdi-filter-off" @click="clearFilters">
          Limpar filtros
        </v-btn>
      </div>

      <div class="filters-row">
        <v-select
          v-model="statusFilter"
          :items="statusOptions"
          label="Status"
          clearable
          density="compact"
          hide-details
          class="filter-field"
        />

        <v-select
          v-model="prioridadeFilter"
          :items="priorityOptions"
          label="Prioridade"
          clearable
          density="compact"
          hide-details
          class="filter-field"
        />

        <v-select
          v-model="origemFilter"
          :items="originOptions"
          label="Origem"
          clearable
          density="compact"
          hide-details
          class="filter-field"
        />

        <v-autocomplete
          v-model="customerFilter"
          :items="customerOptions"
          :item-title="customerLabel"
          item-value="id"
          label="Cliente"
          no-data-text="Nenhum cliente encontrado"
          clearable
          density="compact"
          hide-details
          class="filter-field"
        />

        <v-select
          v-model="categoriaFilter"
          :items="categoryOptions"
          item-title="nome"
          item-value="id"
          label="Categoria"
          clearable
          density="compact"
          hide-details
          class="filter-field"
          @update:model-value="onCategoriaFilterChange"
        />

        <v-select
          v-model="subcategoriaFilter"
          :items="filteredSubcategoryOptions"
          item-title="nome"
          item-value="id"
          label="Subcategoria"
          clearable
          density="compact"
          hide-details
          class="filter-field"
          :disabled="!categoriaFilter"
          @update:model-value="onSubcategoriaFilterChange"
        />

        <v-select
          v-model="itemFilter"
          :items="filteredItemOptions"
          item-title="nome"
          item-value="id"
          label="Item"
          clearable
          density="compact"
          hide-details
          class="filter-field"
          :disabled="!subcategoriaFilter"
        />

        <v-select
          v-model="grupoSolucaoFilter"
          :items="solutionGroupOptions"
          item-title="nome"
          item-value="id"
          label="Grupo de Solução"
          clearable
          density="compact"
          hide-details
          class="filter-field"
        />

        <v-select
          v-model="responsavelFilter"
          :items="userOptions"
          item-title="name"
          item-value="id"
          label="Responsável"
          clearable
          density="compact"
          hide-details
          class="filter-field"
        />
      </div>
    </v-card>

    <v-data-table-server
      :headers="headers"
      :items="items"
      :items-length="totalItems"
      :items-per-page="itemsPerPage"
      :loading="loading"
      class="incident-table"
      @update:options="onOptionsUpdate"
      @click:row="onRowClick"
    >
      <template #item.cliente="{ item }">
        <div>{{ item.cliente ?? '—' }}</div>
        <div class="text-caption text-medium-emphasis">{{ item.email_cliente }}</div>
      </template>

      <template #item.classificacao="{ item }">
        {{ classification(item) }}
      </template>

      <template #item.prioridade="{ item }">
        <v-chip size="small" :color="PRIORIDADE_COLORS[item.prioridade]" variant="tonal">
          {{ PRIORIDADE_LABELS[item.prioridade] ?? item.prioridade }}
        </v-chip>
      </template>

      <template #item.status="{ item }">
        <v-chip size="small" :color="STATUS_COLORS[item.status]" variant="tonal">
          {{ STATUS_LABELS[item.status] ?? item.status }}
        </v-chip>
      </template>

      <template #item.grupo_solucao="{ item }">
        {{ item.grupo_solucao ?? '—' }}
      </template>

      <template #item.responsavel="{ item }">
        {{ item.responsavel ?? '—' }}
      </template>

      <template #item.data_abertura="{ item }">
        {{ formatDateTime(item.data_abertura) }}
      </template>

      <template #item.status_sla_resposta="{ item }">
        <v-chip size="small" :color="SLA_STATUS_COLORS[item.status_sla_resposta]" variant="tonal">
          {{ SLA_STATUS_LABELS[item.status_sla_resposta] ?? item.status_sla_resposta }}
        </v-chip>
        <div v-if="item.status_sla_resposta !== 'sem_sla'" class="text-caption text-medium-emphasis mt-1">
          {{ formatRemainingMinutes(item.tempo_restante_resposta_minutos) }}
        </div>
      </template>

      <template #item.status_sla_resolucao="{ item }">
        <v-chip size="small" :color="SLA_STATUS_COLORS[item.status_sla_resolucao]" variant="tonal">
          {{ SLA_STATUS_LABELS[item.status_sla_resolucao] ?? item.status_sla_resolucao }}
        </v-chip>
        <div v-if="item.status_sla_resolucao !== 'sem_sla'" class="text-caption text-medium-emphasis mt-1">
          {{ formatRemainingMinutes(item.tempo_restante_resolucao_minutos) }}
        </div>
      </template>
    </v-data-table-server>
  </AppLayout>
</template>

<style scoped>
.incident-table :deep(tbody tr) {
  cursor: pointer;
}

.filters-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.filter-field {
  flex: 0 1 140px;
  min-width: 120px;
}

.filters-row :deep(.v-field) {
  --v-field-padding-top: 2px;
  font-size: 0.8125rem;
}

.filters-row :deep(.v-field__input) {
  min-height: 32px;
  padding-top: 4px;
  padding-bottom: 4px;
}

.filters-row :deep(.v-label) {
  font-size: 0.8125rem;
}

.filters-row :deep(.v-select__selection),
.filters-row :deep(.v-autocomplete__selection) {
  font-size: 0.8125rem;
}
</style>
