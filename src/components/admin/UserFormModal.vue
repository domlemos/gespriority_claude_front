<script setup>
import { ref, watch } from 'vue'
import userService from '@/services/userService'
import roleService from '@/services/roleService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  user: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const name = ref('')
const email = ref('')
const password = ref('')
const roleIds = ref([])
const roleOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

async function loadRoles() {
  const { data } = await roleService.list()
  roleOptions.value = data
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    password.value = ''
    name.value = props.user?.name ?? ''
    email.value = props.user?.email ?? ''

    await loadRoles()

    roleIds.value = props.user
      ? roleOptions.value
          .filter((role) => props.user.roles?.includes(role.slug))
          .map((role) => role.id)
      : []
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
    role_ids: roleIds.value,
    ...(password.value ? { password: password.value } : {}),
  }

  try {
    if (props.user) {
      await userService.update(props.user.id, payload)
    } else {
      await userService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o usuário.')
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
        {{ user ? 'Editar usuário' : 'Novo usuário' }}
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
            :label="user ? 'Nova senha (opcional)' : 'Senha'"
            type="password"
            :required="!user"
            class="mb-2"
          />
          <v-select
            v-model="roleIds"
            :items="roleOptions"
            item-title="name"
            item-value="id"
            label="Papéis"
            multiple
            chips
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
