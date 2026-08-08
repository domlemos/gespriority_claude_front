<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import incidentService from '@/services/incidentService'
import { extractErrorMessage } from '@/utils/errors'
import {
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  ORIGEM_LABELS,
} from '@/utils/incidentLabels'

const auth = useAuthStore()
const router = useRouter()

const headers = [
  { title: 'Número', key: 'numero', sortable: false },
  { title: 'Título', key: 'titulo', sortable: false },
  { title: 'Cliente', key: 'cliente', sortable: false },
  { title: 'Classificação', key: 'classificacao', sortable: false },
  { title: 'Prioridade', key: 'prioridade', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Origem', key: 'origem', sortable: false },
  { title: 'Resposta (h)', key: 'tempo_resposta_horas', sortable: false },
  { title: 'Resolução (h)', key: 'tempo_resolucao_horas', sortable: false },
]

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)

function classification(item) {
  if (!item.categoria) return '—'
  return [item.categoria, item.subcategoria, item.item].filter(Boolean).join(' / ')
}

async function loadIncidents() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await incidentService.dashboard({ page: page.value, per_page: itemsPerPage.value })
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

function onRowClick(event, { item }) {
  router.push({ name: 'incident-edit', params: { id: item.numero } })
}

function openCreate() {
  router.push({ name: 'incident-new' })
}
</script>

<template>
  <AppLayout>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5 font-weight-bold">Incidentes</h1>
      <v-btn v-if="auth.hasPermission('tickets.manage')" color="primary" prepend-icon="mdi-plus" @click="openCreate">
        Novo Incidente
      </v-btn>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

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

      <template #item.origem="{ item }">
        {{ ORIGEM_LABELS[item.origem] ?? item.origem }}
      </template>

      <template #item.tempo_resposta_horas="{ item }">
        {{ item.tempo_resposta_horas ?? '—' }}
      </template>

      <template #item.tempo_resolucao_horas="{ item }">
        {{ item.tempo_resolucao_horas ?? '—' }}
      </template>
    </v-data-table-server>
  </AppLayout>
</template>

<style scoped>
.incident-table :deep(tbody tr) {
  cursor: pointer;
}
</style>
