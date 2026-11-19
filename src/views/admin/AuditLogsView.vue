<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import auditLogService from '@/services/auditLogService'
import customerService from '@/services/customerService'
import userService from '@/services/userService'
import { extractErrorMessage } from '@/utils/errors'
import { formatDateTime } from '@/utils/format'
import ResponsiveDataTable from '@/components/ResponsiveDataTable.vue'
import AuditLogDetails from '@/components/admin/AuditLogDetails.vue'

const { t } = useI18n()

// Nada é consultado ao abrir a tela: só as opções dos selects. Os logs vêm
// apenas quando o usuário clica em "Consultar" (a API também recusa
// consulta sem período).

const headers = computed(() => [
  { title: t('admin.auditLogs.dateTime'), key: 'created_at', sortable: false, width: 170 },
  { title: t('admin.auditLogs.author'), key: 'ator', sortable: false },
  { title: t('admin.auditLogs.action'), key: 'acao', sortable: false },
  { title: t('admin.auditLogs.record'), key: 'entidade', sortable: false },
  { title: t('admin.auditLogs.ip'), key: 'ip_address', sortable: false },
  { title: '', key: 'data-table-expand', sortable: false, align: 'end' },
])

const CORES_ACAO = {
  criado: 'success',
  atualizado: 'info',
  excluido: 'error',
  login_falhou: 'warning',
  exportado: 'secondary',
  download: 'secondary',
}

function hojeIso(offsetDias = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDias)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function filtrosIniciais() {
  return {
    data_inicio: hojeIso(-6),
    data_fim: hojeIso(),
    ator: null,
    acao: [],
    entidade_type: null,
    entidade_id: null,
    ip_address: '',
    busca: '',
  }
}

const filtros = ref(filtrosIniciais())
const opcoes = ref({ acoes: [], entidades: [], max_dias: 93, retencao_meses: 6 })
const autoresBase = ref({ users: [], customers: [] })
const autores = computed(() => [
  { type: 'subheader', title: t('admin.auditLogs.appUsers') },
  ...autoresBase.value.users.map((u) => ({ title: u.name, value: `user:${u.id}` })),
  { type: 'subheader', title: t('admin.auditLogs.customerUsers') },
  ...autoresBase.value.customers.map((c) => ({ title: c.name, value: `customer:${c.id}` })),
])
const carregandoOpcoes = ref(false)

const logs = ref([])
const expandidos = ref([])
const pagina = ref(1)
const temMais = ref(false)
const consultou = ref(false)
const carregando = ref(false)
const erro = ref('')

const periodoValido = computed(() => {
  const { data_inicio: inicio, data_fim: fim } = filtros.value
  return Boolean(inicio && fim && inicio <= fim)
})

async function carregarOpcoes() {
  carregandoOpcoes.value = true
  try {
    const [ops, users, customers] = await Promise.all([
      auditLogService.options(),
      userService.lookup(),
      customerService.lookup(),
    ])
    opcoes.value = ops
    autoresBase.value = { users: users.data, customers: customers.data }
  } catch (error) {
    erro.value = extractErrorMessage(error, t('admin.common.loadFilterOptionsError'))
  } finally {
    carregandoOpcoes.value = false
  }
}

function montarParametros(page) {
  const f = filtros.value
  const params = { data_inicio: f.data_inicio, data_fim: f.data_fim, page }

  if (f.ator) {
    const [tipo, id] = f.ator.split(':')
    params[tipo === 'customer' ? 'customer_id' : 'user_id'] = id
  }
  if (f.acao.length) params.acao = f.acao
  if (f.entidade_type) params.entidade_type = f.entidade_type
  if (f.entidade_id) params.entidade_id = f.entidade_id
  if (f.ip_address?.trim()) params.ip_address = f.ip_address.trim()
  if (f.busca?.trim()) params.busca = f.busca.trim()

  return params
}

async function consultar(page = 1) {
  if (!periodoValido.value) return

  carregando.value = true
  erro.value = ''

  try {
    const { data, meta } = await auditLogService.search(montarParametros(page))
    logs.value = page === 1 ? data : [...logs.value, ...data]
    pagina.value = meta.current_page
    temMais.value = meta.has_more
    consultou.value = true
    if (page === 1) expandidos.value = []
  } catch (error) {
    erro.value = extractErrorMessage(error, t('admin.auditLogs.queryError'))
  } finally {
    carregando.value = false
  }
}

function limpar() {
  filtros.value = filtrosIniciais()
  logs.value = []
  consultou.value = false
  temMais.value = false
  erro.value = ''
}

function formatarDataHora(iso) {
  return iso ? formatDateTime(iso) : '—'
}

function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : t('admin.auditLogs.none')
  if (typeof valor === 'boolean') return valor ? t('admin.common.yes') : t('admin.common.no')
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

// `alteracoes` tem três formatos: {campo: {de, para}} (CRUD), {campos: [...]}
// (chamado — detalhes no feed) e {parametros: {...}} (exportação).
function detalhes(log) {
  const alt = log.alteracoes
  if (!alt) return { tipo: 'vazio' }
  if (Array.isArray(alt.campos)) return { tipo: 'campos', campos: alt.campos }
  if (alt.parametros) {
    return { tipo: 'parametros', linhas: Object.entries(alt.parametros).map(([k, v]) => ({ campo: k, valor: formatarValor(v) })) }
  }
  return {
    tipo: 'diff',
    linhas: Object.entries(alt).map(([campo, v]) => ({ campo, de: formatarValor(v?.de), para: formatarValor(v?.para) })),
  }
}

onMounted(carregarOpcoes)
</script>

<template>
  <div class="mb-4">
    <h1 class="text-h5 font-weight-bold">{{ $t('admin.auditLogs.title') }}</h1>
    <p class="text-body-2 text-medium-emphasis mt-1">
      <i18n-t keypath="admin.auditLogs.intro" scope="global">
        <template #months>{{ opcoes.retencao_meses }}</template>
        <template #consult><strong>{{ $t('admin.auditLogs.consult') }}</strong></template>
        <template #days>{{ opcoes.max_dias }}</template>
      </i18n-t>
    </p>
  </div>

  <v-alert v-if="erro" type="error" variant="tonal" density="comfortable" class="mb-4">{{ erro }}</v-alert>

  <v-card variant="outlined" class="mb-4">
    <v-card-text>
      <v-form @submit.prevent="consultar(1)">
        <v-row dense>
          <v-col cols="12" sm="6" md="3">
            <v-text-field v-model="filtros.data_inicio" type="date" :label="$t('admin.auditLogs.from')" density="compact" hide-details="auto" />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="filtros.data_fim"
              type="date"
              :label="$t('admin.auditLogs.until')"
              density="compact"
              hide-details="auto"
              :error-messages="periodoValido ? [] : [$t('admin.auditLogs.invalidPeriod')]"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-autocomplete
              v-model="filtros.ator"
              :items="autores"
              :loading="carregandoOpcoes"
              :label="$t('admin.auditLogs.author')"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="filtros.acao"
              :items="opcoes.acoes"
              :label="$t('common.actions')"
              density="compact"
              multiple
              chips
              closable-chips
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="8" md="4">
            <v-select
              v-model="filtros.entidade_type"
              :items="opcoes.entidades"
              :label="$t('admin.auditLogs.recordType')"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="4" md="2">
            <v-text-field v-model="filtros.entidade_id" type="number" min="1" :label="$t('admin.auditLogs.recordId')" density="compact" hide-details />
          </v-col>
          <v-col cols="12" md="8">
            <v-text-field
              v-model="filtros.busca"
              :label="$t('admin.auditLogs.search')"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="filtros.ip_address" :label="$t('admin.auditLogs.ip')" density="compact" clearable hide-details />
          </v-col>
        </v-row>

        <div class="d-flex justify-end ga-2 mt-4">
          <v-btn variant="text" prepend-icon="mdi-filter-off" @click="limpar">{{ $t('admin.common.clear') }}</v-btn>
          <v-btn type="submit" color="primary" prepend-icon="mdi-magnify" :loading="carregando && pagina === 1" :disabled="!periodoValido">
            {{ $t('admin.auditLogs.consult') }}
          </v-btn>
        </div>
      </v-form>
    </v-card-text>
  </v-card>

  <v-sheet v-if="!consultou" border rounded class="pa-10 text-center text-medium-emphasis">
    <v-icon icon="mdi-text-box-search-outline" size="48" class="mb-2" />
    <div>
      <i18n-t keypath="admin.auditLogs.notQueried" scope="global">
        <template #consult><strong>{{ $t('admin.auditLogs.consult') }}</strong></template>
      </i18n-t>
    </div>
  </v-sheet>

  <template v-else>
    <ResponsiveDataTable
      :server="false"
      v-model:expanded="expandidos"
      :headers="headers"
      :items="logs"
      :loading="carregando"
      item-value="id"
      show-expand
      :items-per-page="-1"
      hide-default-footer
      :no-data-text="$t('admin.auditLogs.noRecords')"
      density="comfortable"
    >
      <template #item.created_at="{ item }">{{ formatarDataHora(item.created_at) }}</template>

      <template #item.ator="{ item }">
        <template v-if="item.ator">
          <div>{{ item.ator.nome ?? '—' }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ item.ator.type === 'customer' ? $t('admin.auditLogs.actorCustomer') : $t('admin.auditLogs.actorUser') }}
          </div>
        </template>
        <span v-else class="text-medium-emphasis">{{ $t('admin.auditLogs.system') }}</span>
      </template>

      <template #item.acao="{ item }">
        <v-chip size="small" variant="tonal" :color="CORES_ACAO[item.acao] ?? 'default'">{{ item.acao_rotulo }}</v-chip>
      </template>

      <template #item.entidade="{ item }">
        <template v-if="item.entidade">
          <div>{{ item.entidade.label ?? '—' }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ item.entidade.type_rotulo }}<span v-if="item.entidade.id"> · #{{ item.entidade.id }}</span>
          </div>
        </template>
        <span v-else class="text-medium-emphasis">—</span>
      </template>

      <template #item.ip_address="{ item }">{{ item.ip_address ?? '—' }}</template>

      <template #expanded-row="{ columns, item }">
        <tr>
          <td :colspan="columns.length" class="bg-grey-lighten-5 py-3">
            <AuditLogDetails :item="item" :details="detalhes(item)" />
          </td>
        </tr>
      </template>

      <template #card-details="{ item }">
        <AuditLogDetails :item="item" :details="detalhes(item)" />
      </template>
    </ResponsiveDataTable>

    <div v-if="temMais" class="d-flex justify-center mt-4">
      <v-btn variant="outlined" :loading="carregando && pagina >= 1" @click="consultar(pagina + 1)">{{ $t('admin.auditLogs.loadMore') }}</v-btn>
    </div>
  </template>
</template>
