<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import clientService from '@/services/clientService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  client: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { t } = useI18n()

const name = ref('')
const loading = ref(false)
const errorMessage = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = props.client?.name ?? ''
    errorMessage.value = ''
  },
)

function close() {
  emit('update:modelValue', false)
}

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    if (props.client) {
      await clientService.update(props.client.id, { name: name.value })
    } else {
      await clientService.create({ name: name.value })
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('admin.clients.saveError'))
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
        {{ client ? $t('admin.clients.edit') : $t('admin.clients.new') }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="name" :label="$t('admin.common.name')" required autofocus />
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
