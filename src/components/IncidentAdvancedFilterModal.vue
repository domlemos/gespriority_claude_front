<script setup>
import { ref, computed, watch } from 'vue'
import {
  prioridadeOptions as prioridadeOptionsFn,
  statusOptions as statusOptionsFn,
  origemOptions as origemOptionsFn,
  tipoOptions as tipoOptionsFn,
} from '@/utils/incidentLabels'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
  customerOptions: { type: Array, default: () => [] },
  categoryOptions: { type: Array, default: () => [] },
  subcategoryOptions: { type: Array, default: () => [] },
  itemOptions: { type: Array, default: () => [] },
  solutionGroupOptions: { type: Array, default: () => [] },
  userOptions: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'apply', 'save', 'show-all'])

const statusOptions = computed(() => statusOptionsFn())
const priorityOptions = computed(() => prioridadeOptionsFn())
const originOptions = computed(() => origemOptionsFn())
const tipoOptions = computed(() => tipoOptionsFn())

const numero = ref(null)
const status = ref(null)
const prioridade = ref(null)
const origem = ref(null)
const tipo = ref(null)
const semClassificacao = ref(false)
const customerId = ref(null)
const categoriaId = ref(null)
const subcategoriaId = ref(null)
const itemId = ref(null)
const grupoSolucaoId = ref(null)
const responsavelId = ref(null)

function customerLabel(customer) {
  if (!customer || typeof customer !== 'object') return ''
  return `${customer.client?.name ?? '—'} — ${customer.name} (${customer.email})`
}

const filteredSubcategoryOptions = computed(() =>
  categoriaId.value
    ? props.subcategoryOptions.filter((sub) => sub.categoria_id === categoriaId.value)
    : [],
)

const filteredItemOptions = computed(() =>
  subcategoriaId.value
    ? props.itemOptions.filter((item) => item.subcategoria_id === subcategoriaId.value)
    : [],
)

function onCategoriaChange() {
  subcategoriaId.value = null
  itemId.value = null
}

function onSubcategoriaChange() {
  itemId.value = null
}

function resetDraft() {
  numero.value = props.filters.numero ?? null
  status.value = props.filters.status ?? null
  prioridade.value = props.filters.prioridade ?? null
  origem.value = props.filters.origem ?? null
  tipo.value = props.filters.tipo ?? null
  semClassificacao.value = Boolean(props.filters.sem_classificacao)
  customerId.value = props.filters.customer_id ?? null
  grupoSolucaoId.value = props.filters.grupo_solucao_id ?? null
  responsavelId.value = props.filters.responsavel_id ?? null

  itemId.value = props.filters.item_id ?? null
  const item = props.itemOptions.find((i) => i.id === itemId.value)
  subcategoriaId.value = item?.subcategoria_id ?? null
  const subcategoria = props.subcategoryOptions.find((s) => s.id === subcategoriaId.value)
  categoriaId.value = subcategoria?.categoria_id ?? null
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetDraft()
  },
)

function clearDraft() {
  numero.value = null
  status.value = null
  prioridade.value = null
  origem.value = null
  tipo.value = null
  semClassificacao.value = false
  customerId.value = null
  categoriaId.value = null
  subcategoriaId.value = null
  itemId.value = null
  grupoSolucaoId.value = null
  responsavelId.value = null
}

function close() {
  emit('update:modelValue', false)
}

function draftFilters() {
  return {
    numero: numero.value,
    status: status.value,
    prioridade: prioridade.value,
    origem: origem.value,
    tipo: tipo.value,
    // Só envia quando marcado — `null` some no compactFilters(). `1`, não
    // `true`: na query string vira "true", que a regra `boolean` do Laravel recusa.
    sem_classificacao: semClassificacao.value ? 1 : null,
    customer_id: customerId.value,
    item_id: itemId.value,
    grupo_solucao_id: grupoSolucaoId.value,
    responsavel_id: responsavelId.value,
  }
}

function applyFilters() {
  emit('apply', draftFilters())
  close()
}

function saveFilters() {
  emit('save', draftFilters())
  close()
}

function showAll() {
  emit('show-all')
  close()
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">{{ $t('incidents.filters.title') }}</v-card-title>

      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field v-model.number="numero" :label="$t('incidents.filters.numero')" type="number" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select v-model="status" :items="statusOptions" :label="$t('incidents.filters.status')" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select v-model="prioridade" :items="priorityOptions" :label="$t('incidents.filters.prioridade')" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select v-model="origem" :items="originOptions" :label="$t('incidents.filters.origem')" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select v-model="tipo" :items="tipoOptions" :label="$t('incidents.filters.tipo')" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-checkbox
              v-model="semClassificacao"
              :label="$t('incidents.filters.semClassificacao')"
              density="compact"
              hide-details
            />
          </v-col>

          <v-col cols="12">
            <v-autocomplete
              v-model="customerId"
              :items="customerOptions"
              :item-title="customerLabel"
              item-value="id"
              :label="$t('incidents.filters.cliente')"
              :no-data-text="$t('incidents.filters.noCustomer')"
              clearable
              density="compact"
            />
          </v-col>

          <v-col cols="12" sm="4">
            <v-select
              v-model="categoriaId"
              :items="categoryOptions"
              item-title="nome"
              item-value="id"
              :label="$t('incidents.filters.categoria')"
              clearable
              density="compact"
              @update:model-value="onCategoriaChange"
            />
          </v-col>

          <v-col cols="12" sm="4">
            <v-select
              v-model="subcategoriaId"
              :items="filteredSubcategoryOptions"
              item-title="nome"
              item-value="id"
              :label="$t('incidents.filters.subcategoria')"
              clearable
              density="compact"
              :disabled="!categoriaId"
              @update:model-value="onSubcategoriaChange"
            />
          </v-col>

          <v-col cols="12" sm="4">
            <v-select
              v-model="itemId"
              :items="filteredItemOptions"
              item-title="nome"
              item-value="id"
              :label="$t('incidents.filters.item')"
              clearable
              density="compact"
              :disabled="!subcategoriaId"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select
              v-model="grupoSolucaoId"
              :items="solutionGroupOptions"
              item-title="nome"
              item-value="id"
              :label="$t('incidents.filters.grupoSolucao')"
              clearable
              density="compact"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select
              v-model="responsavelId"
              :items="userOptions"
              item-title="name"
              item-value="id"
              :label="$t('incidents.filters.responsavel')"
              clearable
              density="compact"
            />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions class="flex-wrap ga-1">
        <v-btn variant="text" @click="clearDraft">{{ $t('incidents.filters.clear') }}</v-btn>
        <v-spacer />
        <v-btn variant="text" prepend-icon="mdi-format-list-bulleted" @click="showAll">
          {{ $t('incidents.filters.showAll') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-content-save" @click="saveFilters">
          {{ $t('common.save') }}
          <v-tooltip activator="parent" location="top">
            {{ $t('incidents.filters.saveTooltip') }}
          </v-tooltip>
        </v-btn>
        <v-btn color="primary" @click="applyFilters">{{ $t('incidents.filters.filter') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
