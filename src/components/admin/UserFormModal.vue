<script setup>
import { computed, ref, watch } from 'vue'
import userService from '@/services/userService'
import roleService from '@/services/roleService'
import solutionGroupService from '@/services/solutionGroupService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  user: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const createdUserId = ref(null)
const targetUserId = computed(() => props.user?.id ?? createdUserId.value)
// Depois de "Enviar convite" a partir de um formulário em branco, o registro já existe
// (createdUserId setado) mesmo sem a prop `user` ter sido passada pelo pai — o formulário
// passa a se comportar como edição (Salvar vira update, não um create duplicado).
const isEditing = computed(() => targetUserId.value !== null)

const name = ref('')
const email = ref('')
const password = ref('')
const roleIds = ref([])
const roleOptions = ref([])
const solutionGroupId = ref(null)
const solutionGroupOptions = ref([])
const loading = ref(false)
const invitingLoading = ref(false)
const errorMessage = ref('')
const inviteMessage = ref('')

async function loadRoles() {
  const { data } = await roleService.list()
  roleOptions.value = data
}

async function loadSolutionGroups() {
  const { data } = await solutionGroupService.list({ per_page: 200 })
  solutionGroupOptions.value = data
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    inviteMessage.value = ''
    password.value = ''
    createdUserId.value = null
    name.value = props.user?.name ?? ''
    email.value = props.user?.email ?? ''
    solutionGroupId.value = props.user?.grupo_solucao_id ?? null
    roleIds.value = []
    solutionGroupOptions.value = []

    try {
      await Promise.all([loadRoles(), loadSolutionGroups()])
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as opções do formulário.')
      return
    }

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

  if (!isEditing.value && !password.value) {
    errorMessage.value = 'Informe uma senha ou use o botão "Enviar convite".'
    return
  }

  loading.value = true

  const payload = {
    name: name.value,
    email: email.value,
    role_ids: roleIds.value,
    grupo_solucao_id: solutionGroupId.value,
    ...(password.value ? { password: password.value } : {}),
  }

  try {
    if (targetUserId.value) {
      await userService.update(targetUserId.value, payload)
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

async function onSendInvite() {
  errorMessage.value = ''
  inviteMessage.value = ''
  invitingLoading.value = true

  try {
    if (!targetUserId.value) {
      const created = await userService.create({
        name: name.value,
        email: email.value,
        role_ids: roleIds.value,
        grupo_solucao_id: solutionGroupId.value,
      })
      createdUserId.value = created.data.id
      emit('saved')
    }

    await userService.sendInvite(targetUserId.value)
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
        {{ isEditing ? 'Editar usuário' : 'Novo usuário' }}
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
            v-model="roleIds"
            :items="roleOptions"
            item-title="name"
            item-value="id"
            label="Papéis"
            multiple
            chips
            class="mb-2"
          />
          <v-select
            v-model="solutionGroupId"
            :items="solutionGroupOptions"
            item-title="nome"
            item-value="id"
            label="Grupo de Solução"
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
