<script setup>
import { computed, ref, watch } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import IncidentFeedPanel from '@/components/IncidentFeedPanel.vue'
import IncidentCreateModal from '@/components/IncidentCreateModal.vue'
import incidentService from '@/services/incidentService'
import clientService from '@/services/clientService'
import customerService from '@/services/customerService'
import categoryService from '@/services/categoryService'
import subcategoryService from '@/services/subcategoryService'
import itemService from '@/services/itemService'
import solutionGroupService from '@/services/solutionGroupService'
import userService from '@/services/userService'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/errors'
import { PRIORIDADE_LABELS, ORIGEM_LABELS, STATUS_LABELS, TIPO_LABELS } from '@/utils/incidentLabels'

// Só edição — a abertura de chamado é a modal `IncidentCreateModal`.
const props = defineProps({
  id: { type: [String, Number], required: true },
})

const auth = useAuthStore()

const canManage = computed(() => auth.hasPermission('tickets.manage'))
// Depois da abertura, sem `tickets.edit_all` (Analista/Agente) só dá pra
// mexer em classificação, grupo/responsável e status — Tipo, Empresa/
// Solicitante, Título e Origem ficam travados (mesma regra do backend em
// `IncidenteController::garantirPermissaoParaCamposRestritos()`).
const canEditRestrictedFields = computed(() => canManage.value && auth.hasPermission('tickets.edit_all'))
const restrictedFieldHint = computed(() =>
  canManage.value && !canEditRestrictedFields.value ? 'Não pode ser alterado após a abertura' : '',
)

const tipoOptions = Object.entries(TIPO_LABELS).map(([value, title]) => ({ value, title }))
const originOptions = Object.entries(ORIGEM_LABELS).map(([value, title]) => ({ value, title }))
const statusOptions = Object.entries(STATUS_LABELS).map(([value, title]) => ({ value, title }))

const loading = ref(false)
const loadFailed = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const successSnackbar = ref(false)
// Status como está gravado — fechar (mudar pra 'fechado') exige a mensagem
// de encerramento, a única entrada do staff que o cliente vê no portal.
const statusGravado = ref(null)
// Grupo como está gravado: trocar o grupo devolve o chamado para 'aberto' no
// backend (exceto fechado/cancelado) — o formulário avisa e não pede a
// mensagem de encerramento, já que o fechamento seria ignorado.
const grupoGravado = ref(null)
const STATUS_MANTIDOS_NA_TROCA_DE_GRUPO = ['fechado', 'cancelado']
const trocaGrupoReabre = computed(
  () =>
    props.id &&
    statusGravado.value !== null &&
    grupoSolucaoId.value !== grupoGravado.value &&
    !STATUS_MANTIDOS_NA_TROCA_DE_GRUPO.includes(statusGravado.value),
)
const encerramentoOpen = ref(false)
const mensagemEncerramento = ref('')
const feedRef = ref(null)
const createModalOpen = ref(false)
// Valores do chamado atual pré-preenchidos na modal ao clonar; null = novo.
const createInitial = ref(null)

const tipo = ref('incidente')
// Empresa não é campo do incidente (a API só recebe `customer_id`; a empresa
// é sempre derivada do solicitante) — só filtra o select de Solicitante.
const clientId = ref(null)
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
const clientOptions = ref([])
const customerOptions = ref([])
const categoryOptions = ref([])
const subcategoryOptions = ref([])
const itemOptions = ref([])
const solutionGroupOptions = ref([])
const userOptions = ref([])

const filteredCustomerOptions = computed(() =>
  clientId.value ? customerOptions.value.filter((customer) => customer.client?.id === clientId.value) : [],
)

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

// Prioridade nunca é escolhida no formulário — o backend sempre a deriva do
// `prioridade_padrao` do item (ver "SLA por Categorização" no
// BACKEND_SPECS.md). Só exibimos o valor: o do item selecionado (prévia do
// que o backend vai aplicar ao salvar) ou, sem item, o que já está gravado.
const prioridadeExibida = computed(() => {
  const item = itemOptions.value.find((option) => option.id === itemId.value)
  const valor = item?.prioridade_padrao ?? prioridade.value
  return valor ? PRIORIDADE_LABELS[valor] ?? valor : '—'
})

const filteredResponsavelOptions = computed(() =>
  grupoSolucaoId.value
    ? userOptions.value.filter((user) => user.grupo_solucao_id === grupoSolucaoId.value)
    : [],
)

function customerLabel(customer) {
  if (!customer || typeof customer !== 'object') return ''
  return `${customer.name} (${customer.email})`
}

function onClientChange() {
  customerId.value = null
}

// O incidente só traz o solicitante — a empresa é derivada
// dele. Chamado depois do `Promise.all` de `init()`, quando `customerOptions`
// já carregou (mesmo motivo de `resolveClassificationFromItemId`).
function syncClientFromCustomer() {
  const customer = customerOptions.value.find((option) => option.id === customerId.value)
  clientId.value = customer?.client?.id ?? null
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

async function loadClients() {
  clientOptions.value = []
  const { data } = await clientService.lookup()
  clientOptions.value = data
}

async function loadCustomers() {
  customerOptions.value = []
  const { data } = await customerService.lookup()
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
  const { data } = await userService.lookup()
  userOptions.value = data
}

// Ao navegar de um chamado pra outro via router (não um reload de página),
// o Vue reaproveita a instância em vez de remontar, então os refs em memória
// do incidente anterior continuam com o valor antigo até algo os
// sobrescrever. Chamado no início de `init()`, antes de aplicar os dados do
// incidente, pra nunca vazar campo de um chamado pro outro.
function resetForm() {
  tipo.value = 'incidente'
  clientId.value = null
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

async function loadIncident() {
  const incident = await incidentService.get(props.id)

  tipo.value = incident.tipo ?? 'incidente'
  customerId.value = incident.customer_id ?? incident.customer?.id ?? null
  titulo.value = incident.titulo
  prioridade.value = incident.prioridade
  origem.value = incident.origem
  status.value = incident.status
  statusGravado.value = incident.status
  grupoSolucaoId.value = incident.grupo_solucao_id ?? incident.grupo_solucao?.id ?? null
  grupoGravado.value = grupoSolucaoId.value
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
    const [, , , , , , , incidentItemId] = await Promise.all([
      loadClients(),
      loadCustomers(),
      loadCategories(),
      loadSubcategories(),
      loadItems(),
      loadSolutionGroups(),
      loadUsers(),
      loadIncident(),
    ])

    showAttachmentFailuresFromCreation()

    if (incidentItemId) {
      resolveClassificationFromItemId(incidentItemId)
    }

    syncClientFromCustomer()
  } catch (error) {
    loadFailed.value = true
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os dados do chamado.')
  } finally {
    loading.value = false
  }
}

// Falha de upload na abertura não desfaz o incidente (já foi criado) — a
// lista de arquivos que falharam viaja no history state da navegação feita
// pela `IncidentCreateModal` e vira um aviso aqui, pro usuário reanexar pela
// aba de anexos. Sai do state logo em seguida pra não reaparecer num F5.
function showAttachmentFailuresFromCreation() {
  const falhas = window.history.state?.anexosComFalha
  if (!Array.isArray(falhas) || !falhas.length) return

  errorMessage.value = `Chamado criado, mas não foi possível anexar: ${falhas.join('; ')}. Anexe novamente pela aba de anexos.`
  window.history.replaceState({ ...window.history.state, anexosComFalha: undefined }, '')
}

function buildBasePayload() {
  return {
    tipo: tipo.value,
    customer_id: customerId.value,
    titulo: titulo.value,
    origem: origem.value,
    item_id: itemId.value,
    grupo_solucao_id: grupoSolucaoId.value,
    responsavel_id: responsavelId.value,
  }
}

function onSubmit() {
  if (status.value === 'fechado' && statusGravado.value !== 'fechado' && !trocaGrupoReabre.value) {
    mensagemEncerramento.value = ''
    encerramentoOpen.value = true
    return
  }

  salvar()
}

async function confirmarEncerramento() {
  encerramentoOpen.value = false
  await salvar(mensagemEncerramento.value.trim())
}

async function salvar(mensagem = null) {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const atualizado = await incidentService.update(props.id, {
      ...buildBasePayload(),
      status: status.value,
      ...(mensagem ? { mensagem_encerramento: mensagem } : {}),
    })
    // O backend pode ter mudado o status (troca de grupo → 'aberto'): vale o que voltou.
    status.value = atualizado.status
    statusGravado.value = atualizado.status
    grupoGravado.value = grupoSolucaoId.value
    successMessage.value = 'Chamado atualizado com sucesso.'
    successSnackbar.value = true
    feedRef.value?.reload()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o chamado.')
  } finally {
    saving.value = false
  }
}

function openCreate() {
  createInitial.value = null
  createModalOpen.value = true
}

function cloneAsNew() {
  createInitial.value = { ...buildBasePayload() }
  createModalOpen.value = true
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
          Chamado #{{ id }}
        </h1>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn v-if="canManage" variant="outlined" @click="openCreate">
          Novo Chamado
        </v-btn>
        <v-btn v-if="canManage" variant="outlined" @click="cloneAsNew">
          Clonar Chamado
        </v-btn>
        <v-btn v-if="canManage" color="primary" :loading="saving" @click="onSubmit">
          Salvar
        </v-btn>
      </div>
    </div>

    <IncidentCreateModal v-model="createModalOpen" :initial="createInitial" />

    <v-dialog v-model="encerramentoOpen" max-width="640">
      <v-card>
        <v-card-title class="text-subtitle-1 font-weight-bold">Fechar chamado</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">
            Escreva a mensagem de encerramento. Ela fica visível para o cliente no portal — os demais
            comentários continuam internos.
          </p>
          <v-textarea
            v-model="mensagemEncerramento"
            label="Mensagem de encerramento"
            rows="5"
            auto-grow
            autofocus
            counter="5000"
            :maxlength="5000"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="encerramentoOpen = false">Cancelar</v-btn>
          <v-btn color="primary" :disabled="!mensagemEncerramento.trim()" @click="confirmarEncerramento">
            Fechar chamado
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
              <v-text-field
                v-model="titulo"
                label="Título"
                required
                :disabled="!canEditRestrictedFields"
                :hint="restrictedFieldHint"
                persistent-hint
                class="mb-2"
              />

              <v-select
                v-model="tipo"
                :items="tipoOptions"
                label="Tipo"
                required
                :disabled="!canEditRestrictedFields"
                :hint="restrictedFieldHint"
                persistent-hint
                class="mb-2"
              />

              <v-autocomplete
                v-model="clientId"
                :items="clientOptions"
                item-title="name"
                item-value="id"
                label="Empresa"
                no-data-text="Nenhuma empresa encontrada"
                clearable
                required
                :disabled="!canEditRestrictedFields"
                :hint="restrictedFieldHint"
                persistent-hint
                class="mb-2"
                @update:model-value="onClientChange"
              />

              <v-autocomplete
                v-model="customerId"
                :items="filteredCustomerOptions"
                :item-title="customerLabel"
                item-value="id"
                label="Solicitante"
                :no-data-text="clientId ? 'Nenhum solicitante nesta empresa' : 'Selecione a empresa primeiro'"
                clearable
                required
                :disabled="!canEditRestrictedFields || !clientId"
                :hint="restrictedFieldHint"
                persistent-hint
                class="mb-2"
              />

              <v-row dense class="mb-2">
                <v-col cols="4">
                  <v-text-field
                    :model-value="prioridadeExibida"
                    label="Prioridade"
                    readonly
                    hint="Calculada automaticamente pelo item"
                    persistent-hint
                  />
                </v-col>

                <v-col cols="4">
                  <v-select
                    v-model="origem"
                    :items="originOptions"
                    label="Origem"
                    required
                    :disabled="!canEditRestrictedFields"
                    :hint="restrictedFieldHint"
                    persistent-hint
                  />
                </v-col>

                <v-col cols="4">
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
                    required
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
                    :hint="trocaGrupoReabre ? 'Ao salvar, o status volta para Aberto.' : ''"
                    persistent-hint
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

            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <IncidentFeedPanel ref="feedRef" :incident-id="id" />
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
