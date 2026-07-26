<script setup>
import { ref, watch } from 'vue'
import customerService from '@/services/customerService'
import clientService from '@/services/clientService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  customer: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const name = ref('')
const email = ref('')
const password = ref('')
const clientId = ref(null)
const clientOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

async function loadClients() {
  const { data } = await clientService.list({ per_page: 200 })
  clientOptions.value = data
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    password.value = ''
    name.value = props.customer?.name ?? ''
    email.value = props.customer?.email ?? ''
    clientId.value = props.customer?.client?.id ?? null

    await loadClients()
  },
)

function close() {
  emit('update:modelValue', false)
}

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  const payload = {
    name: name.value,
    email: email.value,
    client_id: clientId.value,
    ...(password.value ? { password: password.value } : {}),
  }

  try {
    if (props.customer) {
      await customerService.update(props.customer.id, payload)
    } else {
      await customerService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o usuário do cliente.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">
        {{ customer ? 'Editar usuário de cliente' : 'Novo usuário de cliente' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="name" label="Nome" required autofocus class="mb-2" />
          <v-text-field v-model="email" label="E-mail" type="email" required class="mb-2" />
          <v-text-field
            v-model="password"
            :label="customer ? 'Nova senha (opcional)' : 'Senha'"
            type="password"
            :required="!customer"
            class="mb-2"
          />
          <v-select
            v-model="clientId"
            :items="clientOptions"
            item-title="name"
            item-value="id"
            label="Cliente (empresa)"
            required
          />
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
