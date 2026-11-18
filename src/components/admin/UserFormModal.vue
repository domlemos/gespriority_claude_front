<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import userService from '@/services/userService'
import roleService from '@/services/roleService'
import solutionGroupService from '@/services/solutionGroupService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  user: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { t } = useI18n()

const createdUserId = ref(null)
const targetUserId = computed(() => props.user?.id ?? createdUserId.value)
// Se o convite falhar logo após a criação (modal permanece aberto), o registro já existe
// (createdUserId setado) mesmo sem a prop `user` ter sido passada pelo pai — o formulário
// passa a se comportar como edição (Salvar vira update, não um create duplicado).
const isEditing = computed(() => targetUserId.value !== null)

const name = ref('')
const email = ref('')
const password = ref('')
const sendInviteOnCreate = ref(true)
const roleIds = ref([])
const roleOptions = ref([])
const solutionGroupId = ref(null)
const solutionGroupOptions = ref([])
const loading = ref(false)
const invitingLoading = ref(false)
const errorMessage = ref('')
const inviteMessage = ref('')
const passwordRequired = computed(() => !isEditing.value && !sendInviteOnCreate.value)

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
    sendInviteOnCreate.value = true
    createdUserId.value = null
    name.value = props.user?.name ?? ''
    email.value = props.user?.email ?? ''
    solutionGroupId.value = props.user?.grupo_solucao_id ?? null
    roleIds.value = []
    solutionGroupOptions.value = []

    try {
      await Promise.all([loadRoles(), loadSolutionGroups()])
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, t('admin.users.formOptionsError'))
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

  const creating = !isEditing.value

  if (creating && !password.value && !sendInviteOnCreate.value) {
    errorMessage.value = t('admin.users.passwordRequired')
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
    if (creating) {
      const created = await userService.create(payload)
      createdUserId.value = created.data.id
    } else {
      await userService.update(targetUserId.value, payload)
    }

    emit('saved')

    if (creating && sendInviteOnCreate.value) {
      try {
        await userService.sendInvite(createdUserId.value)
      } catch (inviteError) {
        errorMessage.value = extractErrorMessage(
          inviteError,
          t('admin.users.inviteFailedAfterCreate'),
        )
        return
      }
    }

    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('admin.users.saveError'))
  } finally {
    loading.value = false
  }
}

async function onSendInvite() {
  errorMessage.value = ''
  inviteMessage.value = ''
  invitingLoading.value = true

  try {
    await userService.sendInvite(targetUserId.value)
    inviteMessage.value = t('admin.common.inviteSent')
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('admin.common.sendInviteError'))
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
        {{ isEditing ? $t('admin.users.edit') : $t('admin.users.new') }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-alert v-if="inviteMessage" type="success" variant="tonal" density="comfortable" class="mb-4">
            {{ inviteMessage }}
          </v-alert>

          <v-text-field v-model="name" :label="$t('admin.common.name')" required autofocus class="mb-2" />
          <v-text-field v-model="email" :label="$t('admin.common.email')" type="email" required class="mb-2" />
          <v-text-field
            v-model="password"
            :label="isEditing ? $t('admin.common.newPasswordOptional') : $t('admin.common.password')"
            type="password"
            :required="passwordRequired"
            class="mb-1"
          />
          <v-checkbox
            v-if="!isEditing"
            v-model="sendInviteOnCreate"
            :label="$t('admin.users.sendInviteOnCreate')"
            density="compact"
            hide-details
            class="mb-2"
          />
          <v-select
            v-model="roleIds"
            :items="roleOptions"
            item-title="name"
            item-value="id"
            :label="$t('admin.users.roles')"
            multiple
            chips
            class="mb-2"
          />
          <v-select
            v-model="solutionGroupId"
            :items="solutionGroupOptions"
            item-title="nome"
            item-value="id"
            :label="$t('admin.users.solutionGroup')"
            required
          />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-btn
          v-if="isEditing"
          variant="tonal"
          color="secondary"
          :loading="invitingLoading"
          :disabled="!name || !email"
          @click="onSendInvite"
        >
          {{ $t('admin.common.resendInvite') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="loading" @click="onSubmit">{{ $t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
