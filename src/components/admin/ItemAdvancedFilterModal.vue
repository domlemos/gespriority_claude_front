<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
  categoryOptions: { type: Array, default: () => [] },
  subcategoryOptions: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'apply'])

const ativoOptions = [
  { value: true, title: 'Sim' },
  { value: false, title: 'Não' },
]

const nome = ref(null)
const categoriaId = ref(null)
const subcategoriaId = ref(null)
const ativo = ref(null)

// Categoria é só pra estreitar as opções de Subcategoria na UI — nunca é
// enviada como filtro pro backend, só `subcategoria_id` (o único FK que o
// Item de fato tem).
const filteredSubcategoryOptions = computed(() =>
  categoriaId.value
    ? props.subcategoryOptions.filter((sub) => sub.categoria_id === categoriaId.value)
    : [],
)

function onCategoriaChange() {
  subcategoriaId.value = null
}

function resetDraft() {
  nome.value = props.filters.nome ?? null
  ativo.value = props.filters.ativo ?? null

  subcategoriaId.value = props.filters.subcategoria_id ?? null
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
  nome.value = null
  categoriaId.value = null
  subcategoriaId.value = null
  ativo.value = null
}

function close() {
  emit('update:modelValue', false)
}

function applyFilters() {
  emit('apply', {
    nome: nome.value,
    subcategoria_id: subcategoriaId.value,
    ativo: ativo.value,
  })
  close()
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">Filtro Avançado</v-card-title>

      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-text-field v-model="nome" label="Nome" clearable density="compact" />
          </v-col>

          <v-col cols="12">
            <v-select
              v-model="categoriaId"
              :items="categoryOptions"
              item-title="nome"
              item-value="id"
              label="Categoria"
              clearable
              density="compact"
              @update:model-value="onCategoriaChange"
            />
          </v-col>

          <v-col cols="12">
            <v-select
              v-model="subcategoriaId"
              :items="filteredSubcategoryOptions"
              item-title="nome"
              item-value="id"
              label="Subcategoria"
              clearable
              density="compact"
              :disabled="!categoriaId"
            />
          </v-col>

          <v-col cols="12">
            <v-select v-model="ativo" :items="ativoOptions" label="Ativo" clearable density="compact" />
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
