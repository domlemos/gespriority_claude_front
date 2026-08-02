<script setup>
import { ref, watch } from 'vue'
import itemService from '@/services/itemService'
import subcategoryService from '@/services/subcategoryService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  item: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const nome = ref('')
const ativo = ref(true)
const subcategoriaId = ref(null)
const subcategoryOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

function subcategoryLabel(subcategory) {
  if (!subcategory || typeof subcategory !== 'object') return ''
  return `${subcategory.categoria?.nome ?? '—'} / ${subcategory.nome}`
}

async function loadSubcategories() {
  const { data } = await subcategoryService.list({ per_page: 200 })
  subcategoryOptions.value = data
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    nome.value = props.item?.nome ?? ''
    ativo.value = props.item?.ativo ?? true
    subcategoriaId.value = props.item?.subcategoria_id ?? props.item?.subcategoria?.id ?? null
    subcategoryOptions.value = []

    try {
      await loadSubcategories()
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as subcategorias.')
    }
  },
)

function close() {
  emit('update:modelValue', false)
}

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  const payload = {
    nome: nome.value,
    ativo: ativo.value,
    subcategoria_id: subcategoriaId.value,
  }

  try {
    if (props.item) {
      await itemService.update(props.item.id, payload)
    } else {
      await itemService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o item.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">
        {{ item ? 'Editar item' : 'Novo item' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="nome" label="Nome" required autofocus class="mb-2" />

          <v-select
            v-model="subcategoriaId"
            :items="subcategoryOptions"
            :item-title="subcategoryLabel"
            item-value="id"
            label="Subcategoria"
            required
            class="mb-2"
          />

          <v-checkbox v-model="ativo" label="Ativo" density="compact" hide-details />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancelar</v-btn>
        <v-btn color="primary" :loading="loading" @click="onSubmit">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
