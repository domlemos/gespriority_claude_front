<script setup>
import { computed, ref, watch } from 'vue'
import customerService from '@/services/customerService'
import clientService from '@/services/clientService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  customer: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const createdCustomerId = ref(null)
const targetCustomerId = computed(() => props.customer?.id ?? createdCustomerId.value)
// Depois de "Enviar convite" a partir de um formulário em branco, o registro já existe
// (createdCustomerId setado) mesmo sem a prop `customer` ter sido passada pelo pai — o
// formulário passa a se comportar como edição (Salvar vira update, não um create duplicado).
const isEditing = computed(() => targetCustomerId.value !== null)

const name = ref('')
const email = ref('')
const password = ref('')
const clientId = ref(null)
const clientOptions = ref([])
const loading = ref(false)
const invitingLoading = ref(false)
const errorMessage = ref('')
const inviteMessage = ref('')

async function loadClients() {
  const { data } = await clientService.list({ per_page: 200 })
  clientOptions.value = data
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    inviteMessage.value = ''
    password.value = ''
    createdCustomerId.value = null
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

  if (!isEditing.value && !password.value) {
    errorMessage.value = 'Informe uma senha ou use o botão "Enviar convite".'
    return
  }

  loading.value = true

  const payload = {
    name: name.value,
    email: email.value,
    client_id: clientId.value,
    ...(password.value ? { password: password.value } : {}),
  }

  try {
    if (targetCustomerId.value) {
      await customerService.update(targetCustomerId.value, payload)
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

async function onSendInvite() {
  errorMessage.value = ''
  inviteMessage.value = ''
  invitingLoading.value = true

  try {
    if (!targetCustomerId.value) {
      const created = await customerService.create({
        name: name.value,
        email: email.value,
        client_id: clientId.value,
      })
      createdCustomerId.value = created.data.id
      emit('saved')
    }

    await customerService.sendInvite(targetCustomerId.value)
    inviteMessage.value = 'Convite enviado por e-mail.'
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível enviar o convite.')
  } finally {
    invitingLoading.value = false
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
        {{ isEditing ? 'Editar usuário de cliente' : 'Novo usuário de cliente' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-alert v-if="inviteMessage" type="success" variant="tonal" density="comfortable" class="mb-4">
            {{ inviteMessage }}
          </v-alert>

          <v-text-field v-model="name" label="Nome" required autofocus class="mb-2" />
          <v-text-field v-model="email" label="E-mail" type="email" required class="mb-2" />
          <v-text-field
            v-model="password"
            :label="isEditing ? 'Nova senha (opcional)' : 'Senha'"
            type="password"
            :required="!isEditing"
            class="mb-1"
          />
          <div v-if="!isEditing" class="text-caption text-medium-emphasis mb-2">
            Ou deixe em branco e clique em "Enviar convite" abaixo.
          </div>
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
        <v-btn
          variant="tonal"
          color="secondary"
          :loading="invitingLoading"
          :disabled="!name || !email"
          @click="onSendInvite"
        >
          {{ isEditing ? 'Reenviar convite' : 'Enviar convite' }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancelar</v-btn>
        <v-btn color="primary" :loading="loading" @click="onSubmit">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
