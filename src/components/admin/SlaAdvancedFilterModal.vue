<script setup>
import { ref, watch } from 'vue'
import { PRIORIDADE_LABELS } from '@/utils/incidentLabels'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
  clientOptions: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'apply'])

const priorityOptions = Object.entries(PRIORIDADE_LABELS).map(([value, title]) => ({ value, title }))

const boolOptions = [
  { title: 'Sim', value: true },
  { title: 'Não', value: false },
]

// Sentinel distinto de `null` (que aqui significa "campo não tocado / sem
// filtro de cliente") — necessário pra representar "filtrar só as políticas
// Global" sem colidir com "sem filtro nenhum". Convertido pro sentinel de
// API `'global'` só na hora de montar o payload em applyFilters().
const GLOBAL_SENTINEL = '__global__'

const nome = ref(null)
const prioridade = ref(null)
const clientId = ref(null)
const apenasHorasUteis = ref(null)
const ativo = ref(null)

const clientSelectOptions = ref([])

watch(
  () => props.clientOptions,
  (options) => {
    clientSelectOptions.value = [{ name: 'Global (sem cliente)', id: GLOBAL_SENTINEL }, ...options]
  },
  { immediate: true },
)

function resetDraft() {
  nome.value = props.filters.nome ?? null
  prioridade.value = props.filters.prioridade ?? null
  clientId.value = props.filters.client_id === 'global' ? GLOBAL_SENTINEL : (props.filters.client_id ?? null)
  apenasHorasUteis.value = props.filters.apenas_horas_uteis ?? null
  ativo.value = props.filters.ativo ?? null
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetDraft()
  },
)

function clearDraft() {
  nome.value = null
  prioridade.value = null
  clientId.value = null
  apenasHorasUteis.value = null
  ativo.value = null
}

function close() {
  emit('update:modelValue', false)
}

function applyFilters() {
  const payload = {
    nome: nome.value,
    prioridade: prioridade.value,
    apenas_horas_uteis: apenasHorasUteis.value,
    ativo: ativo.value,
  }

  if (clientId.value !== null) {
    payload.client_id = clientId.value === GLOBAL_SENTINEL ? 'global' : clientId.value
  }

  emit('apply', payload)
  close()
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">Filtro Avançado</v-card-title>

      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field v-model="nome" label="Nome" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select v-model="prioridade" :items="priorityOptions" label="Prioridade" clearable density="compact" />
          </v-col>

          <v-col cols="12">
            <v-select
              v-model="clientId"
              :items="clientSelectOptions"
              item-title="name"
              item-value="id"
              label="Cliente"
              no-data-text="Nenhum cliente encontrado"
              clearable
              density="compact"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select
              v-model="apenasHorasUteis"
              :items="boolOptions"
              label="Horário útil"
              clearable
              density="compact"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select v-model="ativo" :items="boolOptions" label="Ativo" clearable density="compact" />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-btn variant="text" @click="clearDraft">Limpar</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancelar</v-btn>
        <v-btn color="primary" @click="applyFilters">Filtrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
