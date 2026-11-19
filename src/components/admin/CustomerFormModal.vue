<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import customerService from '@/services/customerService'
import clientService from '@/services/clientService'
import { LOCALE_OPTIONS, toBackendLocale } from '@/plugins/i18n'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  customer: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { t } = useI18n()

const createdCustomerId = ref(null)
const targetCustomerId = computed(() => props.customer?.id ?? createdCustomerId.value)
// Depois de "Enviar convite" a partir de um formulário em branco, o registro já existe
// (createdCustomerId setado) mesmo sem a prop `customer` ter sido passada pelo pai — o
// formulário passa a se comportar como edição (Salvar vira update, não um create duplicado).
const isEditing = computed(() => targetCustomerId.value !== null)

const name = ref('')
const email = ref('')
const password = ref('')
const locale = ref('pt_BR')
const localeItems = computed(() =>
  LOCALE_OPTIONS.map((o) => ({ title: t(o.nameKey), value: toBackendLocale(o.code) })),
)
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
    locale.value = props.customer?.locale ?? 'pt_BR'

    await loadClients()
  },
)

function close() {
  emit('update:modelValue', false)
}

async function onSubmit() {
  errorMessage.value = ''

  if (!isEditing.value && !password.value) {
    errorMessage.value = t('admin.customers.passwordRequired')
    return
  }

  loading.value = true

  const payload = {
    name: name.value,
    email: email.value,
    client_id: clientId.value,
    locale: locale.value,
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
    errorMessage.value = extractErrorMessage(error, t('admin.customers.saveError'))
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
        locale: locale.value,
      })
      createdCustomerId.value = created.data.id
      emit('saved')
    }

    await customerService.sendInvite(targetCustomerId.value)
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
        {{ isEditing ? $t('admin.customers.edit') : $t('admin.customers.new') }}
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
            :required="!isEditing"
            class="mb-1"
          />
          <div v-if="!isEditing" class="text-caption text-medium-emphasis mb-2">
            {{ $t('admin.customers.passwordHint') }}
          </div>
          <v-select
            v-model="locale"
            :items="localeItems"
            :label="$t('admin.common.language')"
            class="mb-2"
          />
          <v-select
            v-model="clientId"
            :items="clientOptions"
            item-title="name"
            item-value="id"
            :label="$t('admin.customers.clientCompany')"
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
          {{ isEditing ? $t('admin.common.resendInvite') : $t('admin.customers.sendInvite') }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="loading" @click="onSubmit">{{ $t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
