<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import IncidentFeedPanel from '@/components/IncidentFeedPanel.vue'
import incidentService from '@/services/incidentService'
import customerService from '@/services/customerService'
import categoryService from '@/services/categoryService'
import subcategoryService from '@/services/subcategoryService'
import itemService from '@/services/itemService'
import solutionGroupService from '@/services/solutionGroupService'
import userService from '@/services/userService'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/errors'
import { PRIORIDADE_LABELS, ORIGEM_LABELS, STATUS_LABELS } from '@/utils/incidentLabels'

const props = defineProps({
  id: { type: [String, Number], default: null },
})

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const isEditing = computed(() => props.id !== null)
const canManage = computed(() => auth.hasPermission('tickets.manage'))

const priorityOptions = Object.entries(PRIORIDADE_LABELS).map(([value, title]) => ({ value, title }))
const originOptions = Object.entries(ORIGEM_LABELS).map(([value, title]) => ({ value, title }))
const statusOptions = Object.entries(STATUS_LABELS).map(([value, title]) => ({ value, title }))

const loading = ref(false)
const loadFailed = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const successSnackbar = ref(false)
const feedRef = ref(null)

const customerId = ref(null)
const titulo = ref('')
const prioridade = ref(null)
const origem = ref(null)
const status = ref(null)
const categoriaId = ref(null)
const subcategoriaId = ref(null)
const itemId = ref(null)
const grupoSolucaoId = ref(null)
const responsavelId = ref(null)
const descricaoInicial = ref('')

const customerOptions = ref([])
const categoryOptions = ref([])
const subcategoryOptions = ref([])
const itemOptions = ref([])
const solutionGroupOptions = ref([])
const userOptions = ref([])

const filteredSubcategoryOptions = computed(() =>
  categoriaId.value
    ? subcategoryOptions.value.filter((sub) => sub.categoria_id === categoriaId.value)
    : [],
)

const filteredItemOptions = computed(() =>
  subcategoriaId.value
    ? itemOptions.value.filter((item) => item.subcategoria_id === subcategoriaId.value)
    : [],
)

const filteredResponsavelOptions = computed(() =>
  grupoSolucaoId.value
    ? userOptions.value.filter((user) => user.grupo_solucao_id === grupoSolucaoId.value)
    : [],
)

function customerLabel(customer) {
  if (!customer || typeof customer !== 'object') return ''
  return `${customer.client?.name ?? '—'} — ${customer.name} (${customer.email})`
}

function watchCategoriaChange() {
  subcategoriaId.value = null
  itemId.value = null
}

function watchSubcategoriaChange() {
  itemId.value = null
}

function watchGrupoSolucaoChange() {
  if (!filteredResponsavelOptions.value.some((user) => user.id === responsavelId.value)) {
    responsavelId.value = null
  }
}

async function loadCustomers() {
  customerOptions.value = []
  const { data } = await customerService.list({ per_page: 200 })
  customerOptions.value = data
}

async function loadCategories() {
  categoryOptions.value = []
  const { data } = await categoryService.list({ per_page: 200 })
  categoryOptions.value = data
}

async function loadSubcategories() {
  subcategoryOptions.value = []
  const { data } = await subcategoryService.list({ per_page: 200 })
  subcategoryOptions.value = data
}

async function loadItems() {
  itemOptions.value = []
  const { data } = await itemService.list({ per_page: 200 })
  itemOptions.value = data
}

async function loadSolutionGroups() {
  solutionGroupOptions.value = []
  const { data } = await solutionGroupService.list({ per_page: 200 })
  solutionGroupOptions.value = data
}

async function loadUsers() {
  userOptions.value = []
  const { data } = await userService.list({ per_page: 200 })
  userOptions.value = data
}

// 'incident-new' e 'incident-edit' renderizam o mesmo componente — ao
// navegar entre elas via router (não um reload de página), o Vue reaproveita
// a instância em vez de remontar, então os refs em memória do incidente
// anterior continuam com o valor antigo até algo os sobrescrever. Chamado no
// início de `init()`, antes de aplicar dados do incidente ou de um clone,
// pra nunca vazar campo de uma edição anterior pro formulário de criação.
function resetForm() {
  customerId.value = null
  titulo.value = ''
  prioridade.value = null
  origem.value = null
  status.value = null
  categoriaId.value = null
  subcategoriaId.value = null
  itemId.value = null
  grupoSolucaoId.value = null
  responsavelId.value = null
  descricaoInicial.value = ''
}

function resolveClassificationFromItemId(currentItemId) {
  itemId.value = currentItemId

  const item = itemOptions.value.find((option) => option.id === currentItemId)
  if (!item) return

  subcategoriaId.value = item.subcategoria_id

  const subcategory = subcategoryOptions.value.find((option) => option.id === item.subcategoria_id)
  if (subcategory) {
    categoriaId.value = subcategory.categoria_id
  }
}

// Ao clonar (ver `cloneAsNew`), a rota muda de 'incident-edit' pra
// 'incident-new' — componente diferente montado do zero, os refs em memória
// do incidente de origem já não existem mais. Os valores viajam via query
// string e são reaplicados aqui, depois que as listas de opções (usadas por
// `resolveClassificationFromItemId`) já carregaram.
function applyCloneFromQuery() {
  customerId.value = route.query.customer_id ? Number(route.query.customer_id) : null
  titulo.value = typeof route.query.titulo === 'string' ? route.query.titulo : ''
  prioridade.value = route.query.prioridade || null
  origem.value = route.query.origem || null
  grupoSolucaoId.value = route.query.grupo_solucao_id ? Number(route.query.grupo_solucao_id) : null
  responsavelId.value = route.query.responsavel_id ? Number(route.query.responsavel_id) : null

  const cloneItemId = route.query.item_id ? Number(route.query.item_id) : null
  if (cloneItemId) resolveClassificationFromItemId(cloneItemId)
}

async function loadIncident() {
  const incident = await incidentService.get(props.id)

  customerId.value = incident.customer_id ?? incident.customer?.id ?? null
  titulo.value = incident.titulo
  prioridade.value = incident.prioridade
  origem.value = incident.origem
  status.value = incident.status
  grupoSolucaoId.value = incident.grupo_solucao_id ?? incident.grupo_solucao?.id ?? null
  responsavelId.value = incident.responsavel_id ?? incident.responsavel?.id ?? null

  // Não resolve a classificação aqui: `loadIncident` roda em paralelo com
  // `loadItems`/`loadSubcategories` no `Promise.all` de `init()`, então
  // `itemOptions`/`subcategoryOptions` podem ainda estar vazios neste ponto.
  // Devolve o `item_id` para `init()` resolver só depois que TODAS as
  // promises (incluindo as listas) já tiverem terminado.
  return incident.item_id ?? incident.item?.id ?? null
}

async function init() {
  loading.value = true
  loadFailed.value = false
  errorMessage.value = ''
  resetForm()

  try {
    const [, , , , , , incidentItemId] = await Promise.all([
      loadCustomers(),
      loadCategories(),
      loadSubcategories(),
      loadItems(),
      loadSolutionGroups(),
      loadUsers(),
      isEditing.value ? loadIncident() : Promise.resolve(null),
    ])

    if (incidentItemId) {
      resolveClassificationFromItemId(incidentItemId)
    } else if (!isEditing.value && route.query.clone === '1') {
      applyCloneFromQuery()
    }
  } catch (error) {
    loadFailed.value = true
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os dados do incidente.')
  } finally {
    loading.value = false
  }
}

function buildBasePayload() {
  return {
    customer_id: customerId.value,
    titulo: titulo.value,
    prioridade: prioridade.value,
    origem: origem.value,
    item_id: itemId.value,
    grupo_solucao_id: grupoSolucaoId.value,
    responsavel_id: responsavelId.value,
  }
}

async function onSubmit() {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (isEditing.value) {
      await incidentService.update(props.id, { ...buildBasePayload(), status: status.value })
      successMessage.value = 'Incidente atualizado com sucesso.'
      successSnackbar.value = true
      feedRef.value?.reload()
    } else {
      const created = await incidentService.create({
        ...buildBasePayload(),
        descricao: descricaoInicial.value,
      })
      router.replace({ name: 'incident-edit', params: { id: created.id } })
      return
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o incidente.')
  } finally {
    saving.value = false
  }
}

function cloneAsNew() {
  router.push({
    name: 'incident-new',
    query: {
      clone: '1',
      customer_id: customerId.value ?? '',
      titulo: titulo.value ?? '',
      prioridade: prioridade.value ?? '',
      origem: origem.value ?? '',
      item_id: itemId.value ?? '',
      grupo_solucao_id: grupoSolucaoId.value ?? '',
      responsavel_id: responsavelId.value ?? '',
    },
  })
}

watch(() => props.id, () => {
  init()
})

init()
</script>

<template>
  <AppLayout fluid>
    <div class="d-flex align-center justify-space-between mb-4 form-header">
      <div class="d-flex align-center">
        <v-btn icon="mdi-arrow-left" variant="text" density="comfortable" class="mr-2" :to="{ name: 'dashboard' }" />
        <h1 class="text-h5 font-weight-bold ma-0">
          {{ isEditing ? `Incidente #${id}` : 'Novo Incidente' }}
        </h1>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn v-if="canManage && isEditing" variant="outlined" :to="{ name: 'incident-new' }">
          Novo Incidente
        </v-btn>
        <v-btn v-if="canManage && isEditing" variant="outlined" @click="cloneAsNew">
          Clonar Incidente
        </v-btn>
        <v-btn v-if="canManage" color="primary" :loading="saving" @click="onSubmit">
          Salvar
        </v-btn>
      </div>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-snackbar v-model="successSnackbar" :timeout="3000" color="success" transition="fade-transition">
      {{ successMessage }}
    </v-snackbar>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-row v-else-if="!loadFailed">
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-2 bg-surface d-flex flex-column" style="min-height: 500px">
          <v-card-text class="flex-grow-1 overflow-y-auto" style="min-height: 0">
            <v-form @submit.prevent="onSubmit">
              <v-autocomplete
                v-model="customerId"
                :items="customerOptions"
                :item-title="customerLabel"
                item-value="id"
                label="Cliente"
                no-data-text="Nenhum cliente encontrado"
                clearable
                required
                :disabled="!canManage"
                class="mb-2"
              />

              <v-text-field
                v-model="titulo"
                label="Título"
                required
                :disabled="!canManage"
                class="mb-2"
              />

              <v-row dense class="mb-2">
                <v-col cols="4">
                  <v-select
                    v-model="prioridade"
                    :items="priorityOptions"
                    label="Prioridade"
                    required
                    :disabled="!canManage"
                  />
                </v-col>

                <v-col cols="4">
                  <v-select
                    v-model="origem"
                    :items="originOptions"
                    label="Origem"
                    required
                    :disabled="!canManage"
                  />
                </v-col>

                <v-col v-if="isEditing" cols="4">
                  <v-select
                    v-model="status"
                    :items="statusOptions"
                    label="Status"
                    required
                    :disabled="!canManage"
                  />
                </v-col>
              </v-row>

              <div class="text-caption text-medium-emphasis mb-1">Classificação</div>
              <v-row dense class="mb-2">
                <v-col cols="4">
                  <v-select
                    v-model="categoriaId"
                    :items="categoryOptions"
                    item-title="nome"
                    item-value="id"
                    label="Categoria"
                    clearable
                    :disabled="!canManage"
                    @update:model-value="watchCategoriaChange"
                  />
                </v-col>
                <v-col cols="4">
                  <v-select
                    v-model="subcategoriaId"
                    :items="filteredSubcategoryOptions"
                    item-title="nome"
                    item-value="id"
                    label="Subcategoria"
                    clearable
                    :disabled="!canManage || !categoriaId"
                    @update:model-value="watchSubcategoriaChange"
                  />
                </v-col>
                <v-col cols="4">
                  <v-select
                    v-model="itemId"
                    :items="filteredItemOptions"
                    item-title="nome"
                    item-value="id"
                    label="Item"
                    clearable
                    :disabled="!canManage || !subcategoriaId"
                  />
                </v-col>
              </v-row>

              <v-row dense class="mb-2">
                <v-col cols="6">
                  <v-select
                    v-model="grupoSolucaoId"
                    :items="solutionGroupOptions"
                    item-title="nome"
                    item-value="id"
                    label="Grupo de Solução"
                    clearable
                    :disabled="!canManage"
                    @update:model-value="watchGrupoSolucaoChange"
                  />
                </v-col>

                <v-col cols="6">
                  <v-select
                    v-model="responsavelId"
                    :items="filteredResponsavelOptions"
                    item-title="name"
                    item-value="id"
                    label="Responsável"
                    clearable
                    :disabled="!canManage || !grupoSolucaoId"
                    :hint="!grupoSolucaoId ? 'Selecione um grupo de solução primeiro' : ''"
                    persistent-hint
                  />
                </v-col>
              </v-row>

              <v-textarea
                v-if="!isEditing"
                v-model="descricaoInicial"
                label="Descrição"
                required
                rows="4"
                :disabled="!canManage"
                class="mb-2"
              />
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <IncidentFeedPanel v-if="isEditing" ref="feedRef" :incident-id="id" />
      </v-col>
    </v-row>
  </AppLayout>
</template>

<style scoped>
/*
 * O layout inteiro (AppLayout > v-main) rola com a página, então sem
 * `position: sticky` o botão "Salvar" sai da tela ao rolar um formulário
 * longo. `top` usa o offset de layout que o Vuetify expõe via variável CSS
 * (altura real do v-app-bar), com fallback pro valor padrão de 64px.
 */
.form-header {
  position: sticky;
  top: var(--v-layout-top, 64px);
  z-index: 2;
  background: rgb(var(--v-theme-background));
  padding-block: 6px;
}
</style>
