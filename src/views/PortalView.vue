<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import portalIncidentService from '@/services/portalIncidentService'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/errors'
import { STATUS_LABELS, STATUS_COLORS } from '@/utils/incidentLabels'

const auth = useAuthStore()
const router = useRouter()

// Backend pagina fixo em 15 — sem seletor de itens por página.
const ITEMS_PER_PAGE = 15

const headers = [
  { title: 'Número', key: 'id', sortable: false },
  { title: 'Título', key: 'titulo', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Aberto em', key: 'created_at', sortable: false },
  { title: 'Atualizado em', key: 'updated_at', sortable: false },
]

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const createdMessage = ref('')

const statusOptions = Object.entries(STATUS_LABELS).map(([value, title]) => ({ value, title }))
const busca = ref('')
const status = ref(null)
// Só aplica a busca depois de uma pausa na digitação, pra não disparar uma
// requisição a cada tecla.
const buscaAplicada = ref('')
let buscaTimer = null
watch(busca, (valor) => {
  clearTimeout(buscaTimer)
  buscaTimer = setTimeout(() => {
    buscaAplicada.value = (valor ?? '').trim()
  }, 400)
})
// `search` do v-data-table-server: quando muda, a tabela volta pra página 1
// e emite `update:options` de novo, que recarrega com os filtros atuais.
const filtrosChave = computed(() => JSON.stringify([buscaAplicada.value, status.value]))

function formatDateTime(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR') : '—'
}

async function loadIncidents({ page }) {
  loading.value = true
  errorMessage.value = ''

  try {
    const params = { page }
    if (buscaAplicada.value) params.busca = buscaAplicada.value
    if (status.value) params.status = status.value
    const { data, meta } = await portalIncidentService.list(params)
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar seus chamados.')
  } finally {
    loading.value = false
  }
}

// O número do incidente recém-aberto viaja no history state do redirect da
// tela de abertura; sai do state logo em seguida pra não reaparecer num F5.
function showCreatedFromState() {
  const criado = window.history.state?.criado
  if (!criado) return

  createdMessage.value = `Incidente #${criado} aberto. Nossa equipe vai analisar e classificar o chamado.`
  window.history.replaceState({ ...window.history.state, criado: undefined }, '')
}

function onRowClick(event, { item }) {
  router.push({ name: 'portal-incident', params: { id: item.id } })
}

showCreatedFromState()
</script>

<template>
  <AppLayout>
    <div class="d-flex align-center justify-space-between mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold mb-1">Olá, {{ auth.user?.name }} 👋</h1>
        <p class="text-body-2 text-medium-emphasis ma-0">Acompanhe aqui os seus chamados.</p>
      </div>

      <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'portal-incident-new' }">
        Abrir incidente
      </v-btn>
    </div>

    <v-alert v-if="createdMessage" type="success" variant="tonal" density="comfortable" closable class="mb-4">
      {{ createdMessage }}
    </v-alert>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-card variant="outlined">
      <v-card-title class="text-subtitle-1 font-weight-bold">Meus chamados</v-card-title>

      <v-row dense class="px-4">
        <v-col cols="12" sm="8">
          <v-text-field
            v-model="busca"
            label="Buscar por número ou título"
            prepend-inner-icon="mdi-magnify"
            clearable
            density="comfortable"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="status"
            :items="statusOptions"
            label="Status"
            clearable
            density="comfortable"
            hide-details
          />
        </v-col>
      </v-row>

      <v-data-table-server
        :headers="headers"
        :items="items"
        :items-length="totalItems"
        :items-per-page="ITEMS_PER_PAGE"
        :items-per-page-options="[ITEMS_PER_PAGE]"
        :loading="loading"
        :search="filtrosChave"
        :no-data-text="buscaAplicada || status ? 'Nenhum chamado encontrado com esses filtros.' : 'Você ainda não tem chamados.'"
        hover
        class="portal-table"
        @update:options="loadIncidents"
        @click:row="onRowClick"
      >
        <template #item.id="{ item }">#{{ item.id }}</template>

        <template #item.status="{ item }">
          <v-chip size="small" :color="STATUS_COLORS[item.status]" variant="tonal">
            {{ STATUS_LABELS[item.status] ?? item.status }}
          </v-chip>
        </template>

        <template #item.created_at="{ item }">{{ formatDateTime(item.created_at) }}</template>
        <template #item.updated_at="{ item }">{{ formatDateTime(item.updated_at) }}</template>
      </v-data-table-server>
    </v-card>
  </AppLayout>
</template>

<style scoped>
.portal-table :deep(tbody tr) {
  cursor: pointer;
}
</style>
