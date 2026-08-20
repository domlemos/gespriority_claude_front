<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import IncidentAdvancedFilterModal from '@/components/IncidentAdvancedFilterModal.vue'
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
  SLA_STATUS_LABELS,
  SLA_STATUS_COLORS,
  formatRemainingMinutes,
} from '@/utils/incidentLabels'

const auth = useAuthStore()
const router = useRouter()

const headers = [
  { title: 'Número', key: 'numero', sortable: true },
  { title: 'Título', key: 'titulo', sortable: true },
  { title: 'Cliente', key: 'cliente', sortable: true },
  { title: 'Classificação', key: 'classificacao', sortable: false },
  { title: 'Prioridade', key: 'prioridade', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Grupo', key: 'grupo_solucao', sortable: true },
  { title: 'Responsável', key: 'responsavel', sortable: true },
  { title: 'Abertura', key: 'data_abertura', sortable: true },
  { title: 'SLA Resposta', key: 'status_sla_resposta', sortable: true },
  { title: 'SLA Resolução', key: 'status_sla_resolucao', sortable: true },
]

// Ordenação client-side, só sobre a página já carregada: os status de SLA
// são calculados por requisição contra `now()`, não são coluna de banco —
// ordenar isso no backend exigiria replicar essa lógica em SQL bruto (fora
// de escopo). Como o valor numérico (minutos restantes) já vem em cada
// item, ordenar localmente é trivial; só não reflete incidentes de outras
// páginas.
const LOCAL_SORT_FIELDS = {
  status_sla_resposta: 'tempo_restante_resposta_minutos',
  status_sla_resolucao: 'tempo_restante_resolucao_minutos',
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR')
}

const DEFAULT_ITEMS_PER_PAGE = 15

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(DEFAULT_ITEMS_PER_PAGE)
const sortBy = ref([])

const filterModalOpen = ref(false)
const appliedFilters = ref({})

const customerOptions = ref([])
const categoryOptions = ref([])
const subcategoryOptions = ref([])
const itemOptions = ref([])
const solutionGroupOptions = ref([])
const userOptions = ref([])

const hasActiveFilters = computed(() =>
  Object.values(appliedFilters.value).some((value) => value !== null && value !== undefined),
)

function classification(item) {
  if (!item.categoria) return '—'
  return [item.categoria, item.subcategoria, item.item].filter(Boolean).join(' / ')
}

function clearFilters() {
  appliedFilters.value = {}
  page.value = 1
  itemsPerPage.value = DEFAULT_ITEMS_PER_PAGE
  loadIncidents()
}

function applyFilters(filters) {
  appliedFilters.value = filters
  page.value = 1
  itemsPerPage.value = DEFAULT_ITEMS_PER_PAGE
  loadIncidents()
}

// Sem limite de per_page no backend (ver BACKEND_SPECS.md §3.4.8) — um
// valor bem acima de qualquer volume real de incidentes já traz tudo numa
// página só, sem precisar de uma segunda requisição só pra descobrir o total.
const ALL_RECORDS_PAGE_SIZE = 100000

function showAllRecords() {
  appliedFilters.value = { todos_status: true }
  page.value = 1
  itemsPerPage.value = ALL_RECORDS_PAGE_SIZE
  loadIncidents()
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
  for (const [key, value] of Object.entries(appliedFilters.value)) {
    if (value !== null && value !== undefined) params[key] = value
  }

  const [sort] = sortBy.value
  if (sort && !LOCAL_SORT_FIELDS[sort.key]) {
    params.sort_by = sort.key
    params.sort_dir = sort.order
  }

  return params
}

function applyLocalSort() {
  const [sort] = sortBy.value
  const field = sort && LOCAL_SORT_FIELDS[sort.key]
  if (!field) return

  const direction = sort.order === 'desc' ? -1 : 1

  items.value = [...items.value].sort((a, b) => {
    const aVal = a[field]
    const bVal = b[field]
    if (aVal === null || aVal === undefined) return bVal === null || bVal === undefined ? 0 : 1
    if (bVal === null || bVal === undefined) return -1
    return (aVal - bVal) * direction
  })
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
    applyLocalSort()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os incidentes.')
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage, sortBy: newSortBy }) {
  const isLocalSortOnly =
    newPage === page.value &&
    newItemsPerPage === itemsPerPage.value &&
    newSortBy[0] &&
    LOCAL_SORT_FIELDS[newSortBy[0].key]

  sortBy.value = newSortBy

  if (isLocalSortOnly) {
    applyLocalSort()
    return
  }

  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadIncidents()
}

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
      <div class="d-flex align-center ga-2">
        <v-btn v-if="hasActiveFilters" variant="text" size="small" prepend-icon="mdi-filter-off" @click="clearFilters">
          Limpar filtros
        </v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-filter-variant" @click="filterModalOpen = true">
          Filtro Avançado
        </v-btn>
        <v-btn v-if="auth.hasPermission('tickets.manage')" color="primary" prepend-icon="mdi-plus" @click="openCreate">
          Novo Incidente
        </v-btn>
      </div>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <IncidentAdvancedFilterModal
      v-model="filterModalOpen"
      :filters="appliedFilters"
      :customer-options="customerOptions"
      :category-options="categoryOptions"
      :subcategory-options="subcategoryOptions"
      :item-options="itemOptions"
      :solution-group-options="solutionGroupOptions"
      :user-options="userOptions"
      @apply="applyFilters"
      @show-all="showAllRecords"
    />

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
</style>
