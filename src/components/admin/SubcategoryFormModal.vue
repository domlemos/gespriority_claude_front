<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import subcategoryService from '@/services/subcategoryService'
import categoryService from '@/services/categoryService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  subcategory: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { t } = useI18n()

const nome = ref('')
const ativo = ref(true)
const categoriaId = ref(null)
const categoryOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

async function loadCategories() {
  const { data } = await categoryService.list({ per_page: 200 })
  categoryOptions.value = data
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    nome.value = props.subcategory?.nome ?? ''
    ativo.value = props.subcategory?.ativo ?? true
    categoriaId.value = props.subcategory?.categoria_id ?? props.subcategory?.categoria?.id ?? null
    categoryOptions.value = []

    try {
      await loadCategories()
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, t('admin.subcategories.loadCategoriesError'))
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
    categoria_id: categoriaId.value,
  }

  try {
    if (props.subcategory) {
      await subcategoryService.update(props.subcategory.id, payload)
    } else {
      await subcategoryService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('admin.subcategories.saveError'))
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
        {{ subcategory ? $t('admin.subcategories.edit') : $t('admin.subcategories.new') }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="nome" :label="$t('admin.common.name')" required autofocus class="mb-2" />

          <v-select
            v-model="categoriaId"
            :items="categoryOptions"
            item-title="nome"
            item-value="id"
            :label="$t('admin.common.category')"
            required
            class="mb-2"
          />

          <v-checkbox v-model="ativo" :label="$t('admin.common.active')" density="compact" hide-details />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="loading" @click="onSubmit">{{ $t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
