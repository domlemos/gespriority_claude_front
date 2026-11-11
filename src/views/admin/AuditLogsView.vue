<script setup>
import { computed, onMounted, ref } from 'vue'
import auditLogService from '@/services/auditLogService'
import customerService from '@/services/customerService'
import userService from '@/services/userService'
import { extractErrorMessage } from '@/utils/errors'

// Nada é consultado ao abrir a tela: só as opções dos selects. Os logs vêm
// apenas quando o usuário clica em "Consultar" (a API também recusa
// consulta sem período).

const headers = [
  { title: 'Data/hora', key: 'created_at', sortable: false, width: 170 },
  { title: 'Autor', key: 'ator', sortable: false },
  { title: 'Ação', key: 'acao', sortable: false },
  { title: 'Registro', key: 'entidade', sortable: false },
  { title: 'IP', key: 'ip_address', sortable: false },
  { title: '', key: 'data-table-expand', sortable: false, align: 'end' },
]

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
const autores = ref([])
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
    autores.value = [
      { type: 'subheader', title: 'Usuários da aplicação' },
      ...users.data.map((u) => ({ title: u.name, value: `user:${u.id}` })),
      { type: 'subheader', title: 'Usuários de clientes' },
      ...customers.data.map((c) => ({ title: c.name, value: `customer:${c.id}` })),
    ]
  } catch (error) {
    erro.value = extractErrorMessage(error, 'Não foi possível carregar as opções de filtro.')
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
    erro.value = extractErrorMessage(error, 'Não foi possível consultar os logs.')
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
  return iso ? new Date(iso).toLocaleString('pt-BR') : '—'
}

function formatarValor(valor) {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : '(nenhum)'
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
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
    <h1 class="text-h5 font-weight-bold">Logs de ações</h1>
    <p class="text-body-2 text-medium-emphasis mt-1">
      Registros dos últimos {{ opcoes.retencao_meses }} meses. Defina os filtros e clique em
      <strong>Consultar</strong> — período máximo de {{ opcoes.max_dias }} dias por consulta.
    </p>
  </div>

  <v-alert v-if="erro" type="error" variant="tonal" density="comfortable" class="mb-4">{{ erro }}</v-alert>

  <v-card variant="outlined" class="mb-4">
    <v-card-text>
      <v-form @submit.prevent="consultar(1)">
        <v-row dense>
          <v-col cols="12" sm="6" md="3">
            <v-text-field v-model="filtros.data_inicio" type="date" label="De" density="compact" hide-details="auto" />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="filtros.data_fim"
              type="date"
              label="Até"
              density="compact"
              hide-details="auto"
              :error-messages="periodoValido ? [] : ['Período inválido']"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-autocomplete
              v-model="filtros.ator"
              :items="autores"
              :loading="carregandoOpcoes"
              label="Autor"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="filtros.acao"
              :items="opcoes.acoes"
              label="Ações"
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
              label="Tipo de registro"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="4" md="2">
            <v-text-field v-model="filtros.entidade_id" type="number" min="1" label="ID do registro" density="compact" hide-details />
          </v-col>
          <v-col cols="12" md="8">
            <v-text-field
              v-model="filtros.busca"
              label="Buscar por nome do autor ou do registro"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              clearable
              hide-details
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="filtros.ip_address" label="IP" density="compact" clearable hide-details />
          </v-col>
        </v-row>

        <div class="d-flex justify-end ga-2 mt-4">
          <v-btn variant="text" prepend-icon="mdi-filter-off" @click="limpar">Limpar</v-btn>
          <v-btn type="submit" color="primary" prepend-icon="mdi-magnify" :loading="carregando && pagina === 1" :disabled="!periodoValido">
            Consultar
          </v-btn>
        </div>
      </v-form>
    </v-card-text>
  </v-card>

  <v-sheet v-if="!consultou" border rounded class="pa-10 text-center text-medium-emphasis">
    <v-icon icon="mdi-text-box-search-outline" size="48" class="mb-2" />
    <div>Nenhuma consulta feita ainda. Use os filtros acima e clique em <strong>Consultar</strong>.</div>
  </v-sheet>

  <template v-else>
    <v-data-table
      v-model:expanded="expandidos"
      :headers="headers"
      :items="logs"
      :loading="carregando"
      item-value="id"
      show-expand
      :items-per-page="-1"
      hide-default-footer
      no-data-text="Nenhum registro encontrado para esses filtros."
      density="comfortable"
    >
      <template #item.created_at="{ item }">{{ formatarDataHora(item.created_at) }}</template>

      <template #item.ator="{ item }">
        <template v-if="item.ator">
          <div>{{ item.ator.nome ?? '—' }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ item.ator.type === 'customer' ? 'Usuário de cliente' : 'Usuário da aplicação' }}
          </div>
        </template>
        <span v-else class="text-medium-emphasis">Sistema</span>
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
            <template v-if="detalhes(item).tipo === 'diff'">
              <v-table density="compact" class="bg-transparent">
                <thead>
                  <tr><th>Campo</th><th>De</th><th>Para</th></tr>
                </thead>
                <tbody>
                  <tr v-for="linha in detalhes(item).linhas" :key="linha.campo">
                    <td class="font-weight-medium">{{ linha.campo }}</td>
                    <td class="text-medium-emphasis">{{ linha.de }}</td>
                    <td>{{ linha.para }}</td>
                  </tr>
                </tbody>
              </v-table>
            </template>
            <div v-else-if="detalhes(item).tipo === 'campos'" class="text-body-2">
              Campos alterados: <strong>{{ detalhes(item).campos.join(', ') }}</strong>
              <span class="text-medium-emphasis">— valores anteriores e novos ficam no histórico do chamado.</span>
            </div>
            <v-table v-else-if="detalhes(item).tipo === 'parametros'" density="compact" class="bg-transparent">
              <thead>
                <tr><th>Parâmetro</th><th>Valor</th></tr>
              </thead>
              <tbody>
                <tr v-for="linha in detalhes(item).linhas" :key="linha.campo">
                  <td class="font-weight-medium">{{ linha.campo }}</td>
                  <td>{{ linha.valor }}</td>
                </tr>
              </tbody>
            </v-table>
            <div v-else class="text-body-2 text-medium-emphasis">Sem detalhes adicionais.</div>

            <div v-if="item.user_agent" class="text-caption text-medium-emphasis mt-2">Navegador: {{ item.user_agent }}</div>
          </td>
        </tr>
      </template>
    </v-data-table>

    <div v-if="temMais" class="d-flex justify-center mt-4">
      <v-btn variant="outlined" :loading="carregando && pagina >= 1" @click="consultar(pagina + 1)">Carregar mais</v-btn>
    </div>
  </template>
</template>
