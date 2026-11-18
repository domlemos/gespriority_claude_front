<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import portalIncidentService from '@/services/portalIncidentService'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

// `created` leva o número do incidente aberto — a lista recarrega e avisa.
const emit = defineEmits(['update:modelValue', 'created'])

const { t } = useI18n()
const auth = useAuthStore()

const titulo = ref('')
const descricao = ref('')
const saving = ref(false)
const errorMessage = ref('')

// Por auditoria o cliente só abre chamado em nome próprio — Solicitante e
// Empresa são só exibidos; o backend usa sempre o cliente do token.
const solicitante = computed(() =>
  auth.user ? `${auth.user.name} (${auth.user.email})` : '',
)
const empresa = computed(() => auth.user?.client?.name ?? '—')

function close() {
  if (!saving.value) emit('update:modelValue', false)
}

async function onSubmit() {
  saving.value = true
  errorMessage.value = ''

  try {
    const created = await portalIncidentService.create({
      titulo: titulo.value,
      descricao: descricao.value,
    })
    emit('update:modelValue', false)
    emit('created', created.id)
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('portal.create.error'))
  } finally {
    saving.value = false
  }
}

// Formulário limpo a cada abertura. Sessões salvas antes do `/me` passar a
// trazer a empresa não têm `user.client` — atualiza ao abrir.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    titulo.value = ''
    descricao.value = ''
    errorMessage.value = ''
    auth.fetchMe().catch(() => {})
  },
  { immediate: true },
)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    scrollable
    :persistent="saving"
    @update:model-value="(value) => !value && close()"
  >
    <v-card>
      <v-card-title class="d-flex align-center text-subtitle-1 font-weight-bold">
        {{ $t('portal.create.title') }}
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" density="comfortable" :disabled="saving" @click="close" />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <v-form @submit.prevent="onSubmit">
          <v-text-field v-model="titulo" :label="$t('incidents.form.titulo')" counter="255" maxlength="255" required class="mb-2" />

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field :model-value="solicitante" :label="$t('incidents.form.solicitante')" readonly variant="filled" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field :model-value="empresa" :label="$t('incidents.form.empresa')" readonly variant="filled" />
            </v-col>
          </v-row>

          <v-textarea
            v-model="descricao"
            :label="$t('incidents.form.descricao')"
            :hint="$t('portal.create.descriptionHint')"
            persistent-hint
            rows="6"
            required
          />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!titulo.trim() || !descricao.trim()"
          @click="onSubmit"
        >
          {{ $t('portal.create.title') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
