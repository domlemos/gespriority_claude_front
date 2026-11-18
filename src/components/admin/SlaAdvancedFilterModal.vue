<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { prioridadeOptions as prioridadeOptionsFn } from '@/utils/incidentLabels'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
  clientOptions: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'apply'])

const { t } = useI18n()

const priorityOptions = computed(() => prioridadeOptionsFn())

const boolOptions = computed(() => [
  { title: t('admin.common.yes'), value: true },
  { title: t('admin.common.no'), value: false },
])

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

const clientSelectOptions = computed(() => [
  { name: t('admin.slas.globalNoClient'), id: GLOBAL_SENTINEL },
  ...props.clientOptions,
])

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
      <v-card-title class="text-subtitle-1 font-weight-bold">{{ $t('admin.common.advancedFilter') }}</v-card-title>

      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field v-model="nome" :label="$t('admin.common.name')" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select v-model="prioridade" :items="priorityOptions" :label="$t('admin.common.priority')" clearable density="compact" />
          </v-col>

          <v-col cols="12">
            <v-select
              v-model="clientId"
              :items="clientSelectOptions"
              item-title="name"
              item-value="id"
              :label="$t('admin.common.client')"
              :no-data-text="$t('admin.slas.noClient')"
              clearable
              density="compact"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select
              v-model="apenasHorasUteis"
              :items="boolOptions"
              :label="$t('admin.slas.businessHours')"
              clearable
              density="compact"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select v-model="ativo" :items="boolOptions" :label="$t('admin.common.active')" clearable density="compact" />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-btn variant="text" @click="clearDraft">{{ $t('admin.common.clear') }}</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" @click="applyFilters">{{ $t('admin.common.filter') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
