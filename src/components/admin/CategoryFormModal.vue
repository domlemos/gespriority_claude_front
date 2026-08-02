<script setup>
import { ref, watch } from 'vue'
import categoryService from '@/services/categoryService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  category: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const nome = ref('')
const ativo = ref(true)
const loading = ref(false)
const errorMessage = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return

    errorMessage.value = ''
    nome.value = props.category?.nome ?? ''
    ativo.value = props.category?.ativo ?? true
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
  }

  try {
    if (props.category) {
      await categoryService.update(props.category.id, payload)
    } else {
      await categoryService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar a categoria.')
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
        {{ category ? 'Editar categoria' : 'Nova categoria' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="nome" label="Nome" required autofocus class="mb-2" />

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
