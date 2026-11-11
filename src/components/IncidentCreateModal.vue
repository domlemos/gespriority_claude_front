<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import incidentService from '@/services/incidentService'
import attachmentService from '@/services/attachmentService'
import clientService from '@/services/clientService'
import customerService from '@/services/customerService'
import categoryService from '@/services/categoryService'
import subcategoryService from '@/services/subcategoryService'
import itemService from '@/services/itemService'
import solutionGroupService from '@/services/solutionGroupService'
import userService from '@/services/userService'
import { extractErrorMessage } from '@/utils/errors'
import { ATTACHMENT_ACCEPT, attachmentError } from '@/utils/attachmentRules'
import { PRIORIDADE_LABELS, ORIGEM_LABELS, TIPO_LABELS } from '@/utils/incidentLabels'

// Abertura de chamado pelo staff. A edição continua na página do chamado
// (`IncidentFormView`); depois de criar, a modal fecha e leva pra lá.
// `initial` pré-preenche o formulário ao clonar um chamado existente.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initial: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const router = useRouter()

const tipoOptions = Object.entries(TIPO_LABELS).map(([value, title]) => ({ value, title }))
const originOptions = Object.entries(ORIGEM_LABELS).map(([value, title]) => ({ value, title }))

const loading = ref(false)
const loadFailed = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const tipo = ref('incidente')
// Empresa não é campo do incidente (a API só recebe `customer_id`; a empresa
// é sempre derivada do solicitante) — só filtra o select de Solicitante.
const clientId = ref(null)
const customerId = ref(null)
const titulo = ref('')
const origem = ref(null)
const categoriaId = ref(null)
const subcategoriaId = ref(null)
const itemId = ref(null)
const grupoSolucaoId = ref(null)
const responsavelId = ref(null)
const descricao = ref('')
// Anexos escolhidos na abertura — só enviados depois que o incidente existe
// (o endpoint de anexos é aninhado em /incidentes/{id}), ver `onSubmit()`.
// Cada seleção soma à lista (o seletor nativo substituiria a anterior);
// arquivo inválido é recusado já na seleção, com o motivo no alerta.
const anexosPendentes = ref([])
const anexosInput = ref(null)

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

const filteredResponsavelOptions = computed(() =>
  grupoSolucaoId.value
    ? userOptions.value.filter((user) => user.grupo_solucao_id === grupoSolucaoId.value)
    : [],
)

// Prioridade nunca é escolhida — o backend a deriva do `prioridade_padrao`
// do item (ver "SLA por Categorização" no BACKEND_SPECS.md). Aqui é só a
// prévia do que vai ser aplicado, exibida assim que um item é selecionado.
const prioridadeExibida = computed(() => {
  const valor = itemOptions.value.find((option) => option.id === itemId.value)?.prioridade_padrao
  return valor ? PRIORIDADE_LABELS[valor] ?? valor : '—'
})

function customerLabel(customer) {
  if (!customer || typeof customer !== 'object') return ''
  return `${customer.name} (${customer.email})`
}

function onClientChange() {
  customerId.value = null
}

function onCategoriaChange() {
  subcategoriaId.value = null
  itemId.value = null
}

function onSubcategoriaChange() {
  itemId.value = null
}

function onGrupoSolucaoChange() {
  if (!filteredResponsavelOptions.value.some((user) => user.id === responsavelId.value)) {
    responsavelId.value = null
  }
}

function openAnexosPicker() {
  anexosInput.value?.click()
}

function onAnexosSelected(event) {
  const files = Array.from(event.target.files ?? [])
  event.target.value = ''

  const erros = []
  for (const file of files) {
    const erro = attachmentError(file)
    if (erro) {
      erros.push(erro)
      continue
    }

    const duplicado = anexosPendentes.value.some(
      (pendente) => pendente.name === file.name && pendente.size === file.size,
    )
    if (!duplicado) anexosPendentes.value.push(file)
  }

  errorMessage.value = erros.join(' ')
}

function removeAnexoPendente(index) {
  anexosPendentes.value.splice(index, 1)
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function resetForm() {
  tipo.value = 'incidente'
  clientId.value = null
  customerId.value = null
  titulo.value = ''
  origem.value = null
  categoriaId.value = null
  subcategoriaId.value = null
  itemId.value = null
  grupoSolucaoId.value = null
  responsavelId.value = null
  descricao.value = ''
  anexosPendentes.value = []
  errorMessage.value = ''
}

// Só depois que as listas carregaram: a classificação (categoria/
// subcategoria) e a empresa são derivadas do item e do solicitante.
function applyInitial() {
  const initial = props.initial
  if (!initial) return

  tipo.value = initial.tipo || 'incidente'
  customerId.value = initial.customer_id ?? null
  titulo.value = initial.titulo ?? ''
  origem.value = initial.origem ?? null
  grupoSolucaoId.value = initial.grupo_solucao_id ?? null
  responsavelId.value = initial.responsavel_id ?? null

  const item = itemOptions.value.find((option) => option.id === initial.item_id)
  if (item) {
    itemId.value = item.id
    subcategoriaId.value = item.subcategoria_id
    categoriaId.value =
      subcategoryOptions.value.find((option) => option.id === item.subcategoria_id)?.categoria_id ?? null
  }

  clientId.value = customerOptions.value.find((option) => option.id === customerId.value)?.client?.id ?? null
}

async function loadOptions() {
  const [clients, customers, categories, subcategories, items, groups, users] = await Promise.all([
    clientService.lookup(),
    customerService.lookup(),
    categoryService.list({ per_page: 200 }),
    subcategoryService.list({ per_page: 200 }),
    itemService.list({ per_page: 200 }),
    solutionGroupService.list({ per_page: 200 }),
    userService.lookup(),
  ])

  clientOptions.value = clients.data
  customerOptions.value = customers.data
  categoryOptions.value = categories.data
  subcategoryOptions.value = subcategories.data
  itemOptions.value = items.data
  solutionGroupOptions.value = groups.data
  userOptions.value = users.data
}

async function init() {
  resetForm()
  loading.value = true
  loadFailed.value = false

  try {
    await loadOptions()
    applyInitial()
  } catch (error) {
    loadFailed.value = true
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os dados do chamado.')
  } finally {
    loading.value = false
  }
}

async function uploadPendingAttachments(incidentId) {
  const falhas = []

  for (const file of anexosPendentes.value) {
    try {
      await attachmentService.upload(incidentId, file)
    } catch (error) {
      falhas.push(`"${file.name}" (${extractErrorMessage(error, 'erro no envio')})`)
    }
  }

  return falhas
}

function close() {
  if (!saving.value) emit('update:modelValue', false)
}

// Falha de upload não desfaz o incidente (já foi criado) — a lista viaja no
// history state até a página do chamado, que a exibe como aviso (ver
// `showAttachmentFailuresFromCreation` em `IncidentFormView`).
async function onSubmit() {
  saving.value = true
  errorMessage.value = ''

  try {
    const created = await incidentService.create({
      tipo: tipo.value,
      customer_id: customerId.value,
      titulo: titulo.value,
      origem: origem.value,
      item_id: itemId.value,
      grupo_solucao_id: grupoSolucaoId.value,
      responsavel_id: responsavelId.value,
      descricao: descricao.value,
    })
    const anexosComFalha = await uploadPendingAttachments(created.id)

    emit('update:modelValue', false)
    router.push({ name: 'incident-edit', params: { id: created.id }, state: { anexosComFalha } })
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o chamado.')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) init()
  },
  { immediate: true },
)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="860"
    scrollable
    :persistent="saving"
    @update:model-value="(value) => !value && close()"
  >
    <v-card>
      <v-card-title class="d-flex align-center text-subtitle-1 font-weight-bold">
        {{ initial ? 'Novo Chamado (clone)' : 'Novo Chamado' }}
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" density="comfortable" :disabled="saving" @click="close" />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <div v-if="loading" class="d-flex justify-center py-12">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <v-form v-else-if="!loadFailed" @submit.prevent="onSubmit">
          <v-select v-model="tipo" :items="tipoOptions" label="Tipo" required class="mb-2" />

          <v-row dense class="mb-2">
            <v-col cols="12" md="6">
              <v-autocomplete
                v-model="clientId"
                :items="clientOptions"
                item-title="name"
                item-value="id"
                label="Empresa"
                no-data-text="Nenhuma empresa encontrada"
                clearable
                required
                @update:model-value="onClientChange"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-autocomplete
                v-model="customerId"
                :items="filteredCustomerOptions"
                :item-title="customerLabel"
                item-value="id"
                label="Solicitante"
                :no-data-text="clientId ? 'Nenhum solicitante nesta empresa' : 'Selecione a empresa primeiro'"
                clearable
                required
                :disabled="!clientId"
              />
            </v-col>
          </v-row>

          <v-text-field v-model="titulo" label="Título" required class="mb-2" />

          <v-row dense class="mb-2">
            <v-col cols="6">
              <v-select v-model="origem" :items="originOptions" label="Origem" required />
            </v-col>
            <v-col v-if="itemId" cols="6">
              <v-text-field
                :model-value="prioridadeExibida"
                label="Prioridade"
                readonly
                hint="Calculada automaticamente pelo item"
                persistent-hint
              />
            </v-col>
          </v-row>

          <div class="text-caption text-medium-emphasis mb-1">Classificação</div>
          <v-row dense class="mb-2">
            <v-col cols="12" md="4">
              <v-select
                v-model="categoriaId"
                :items="categoryOptions"
                item-title="nome"
                item-value="id"
                label="Categoria"
                clearable
                @update:model-value="onCategoriaChange"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="subcategoriaId"
                :items="filteredSubcategoryOptions"
                item-title="nome"
                item-value="id"
                label="Subcategoria"
                clearable
                :disabled="!categoriaId"
                @update:model-value="onSubcategoriaChange"
              />
            </v-col>
            <v-col cols="12" md="4">
              <v-select
                v-model="itemId"
                :items="filteredItemOptions"
                item-title="nome"
                item-value="id"
                label="Item"
                required
                :disabled="!subcategoriaId"
              />
            </v-col>
          </v-row>

          <v-row dense class="mb-2">
            <v-col cols="12" md="6">
              <v-select
                v-model="grupoSolucaoId"
                :items="solutionGroupOptions"
                item-title="nome"
                item-value="id"
                label="Grupo de Solução"
                clearable
                @update:model-value="onGrupoSolucaoChange"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="responsavelId"
                :items="filteredResponsavelOptions"
                item-title="name"
                item-value="id"
                label="Responsável"
                clearable
                :disabled="!grupoSolucaoId"
                :hint="!grupoSolucaoId ? 'Selecione um grupo de solução primeiro' : ''"
                persistent-hint
              />
            </v-col>
          </v-row>

          <v-textarea v-model="descricao" label="Descrição" required rows="4" class="mb-2" />

          <div class="d-flex align-center ga-2 flex-wrap">
            <v-btn variant="tonal" color="primary" prepend-icon="mdi-paperclip" @click="openAnexosPicker">
              Anexar arquivos
            </v-btn>
            <span class="text-caption text-medium-emphasis">
              Opcional. PDF, Word, Excel, CSV, JPG ou PNG, até 10 MB cada.
            </span>
          </div>

          <input
            ref="anexosInput"
            type="file"
            multiple
            class="d-none"
            :accept="ATTACHMENT_ACCEPT"
            @change="onAnexosSelected"
          />

          <div v-if="anexosPendentes.length" class="d-flex flex-wrap ga-2 mt-2">
            <v-chip
              v-for="(file, index) in anexosPendentes"
              :key="`${file.name}-${file.size}`"
              closable
              size="small"
              prepend-icon="mdi-file-outline"
              @click:close="removeAnexoPendente(index)"
            >
              {{ file.name }} ({{ formatFileSize(file.size) }})
            </v-chip>
          </div>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="close">Cancelar</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="loading || loadFailed" @click="onSubmit">
          Salvar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
