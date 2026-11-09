<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import portalIncidentService from '@/services/portalIncidentService'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/errors'

const auth = useAuthStore()
const router = useRouter()

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

// Sessões salvas antes do `/me` passar a trazer a empresa não têm
// `user.client` — atualiza ao abrir a tela.
onMounted(() => {
  auth.fetchMe().catch(() => {})
})

async function onSubmit() {
  saving.value = true
  errorMessage.value = ''

  try {
    const created = await portalIncidentService.create({
      titulo: titulo.value,
      descricao: descricao.value,
    })
    router.push({ name: 'portal', state: { criado: created.id } })
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível abrir o incidente.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" density="comfortable" class="mr-2" :to="{ name: 'portal' }" />
      <h1 class="text-h5 font-weight-bold ma-0">Abrir incidente</h1>
    </div>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <v-card variant="outlined" class="pa-2" max-width="720">
      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field :model-value="solicitante" label="Solicitante" readonly variant="filled" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field :model-value="empresa" label="Empresa" readonly variant="filled" />
            </v-col>
          </v-row>

          <v-text-field v-model="titulo" label="Título" counter="255" maxlength="255" required class="mb-2" />

          <v-textarea
            v-model="descricao"
            label="Descrição"
            hint="Conte o que aconteceu, desde quando e o que você já tentou."
            persistent-hint
            rows="6"
            required
            class="mb-4"
          />

          <div class="d-flex justify-end ga-2">
            <v-btn variant="text" :to="{ name: 'portal' }">Cancelar</v-btn>
            <v-btn
              color="primary"
              type="submit"
              :loading="saving"
              :disabled="!titulo.trim() || !descricao.trim()"
            >
              Abrir incidente
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </AppLayout>
</template>
