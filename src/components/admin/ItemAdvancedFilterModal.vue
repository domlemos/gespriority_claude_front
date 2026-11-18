<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
  categoryOptions: { type: Array, default: () => [] },
  subcategoryOptions: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'apply'])

const { t } = useI18n()

const ativoOptions = computed(() => [
  { value: true, title: t('admin.common.yes') },
  { value: false, title: t('admin.common.no') },
])

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
      <v-card-title class="text-subtitle-1 font-weight-bold">{{ $t('admin.common.advancedFilter') }}</v-card-title>

      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-text-field v-model="nome" :label="$t('admin.common.name')" clearable density="compact" />
          </v-col>

          <v-col cols="12">
            <v-select
              v-model="categoriaId"
              :items="categoryOptions"
              item-title="nome"
              item-value="id"
              :label="$t('admin.common.category')"
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
              :label="$t('admin.common.subcategory')"
              clearable
              density="compact"
              :disabled="!categoriaId"
            />
          </v-col>

          <v-col cols="12">
            <v-select v-model="ativo" :items="ativoOptions" :label="$t('admin.common.active')" clearable density="compact" />
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
