<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/errors'

const auth = useAuthStore()
const route = useRoute()

const guard = computed(() => route.meta.guard ?? 'web')
const loginRoute = computed(() =>
  guard.value === 'customer' ? { name: 'customer-login' } : { name: 'staff-login' },
)

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const sent = ref(false)

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    await auth.forgotPassword(guard.value, email.value)
    sent.value = true
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout
    title="Esqueci minha senha"
    subtitle="Informe seu e-mail e enviaremos um link para redefinir sua senha."
  >
    <v-alert v-if="sent" type="success" variant="tonal" density="comfortable" class="mb-4">
      Se esse e-mail existir na nossa base, você vai receber um link de recuperação em instantes.
    </v-alert>

    <v-form v-else @submit.prevent="onSubmit">
      <v-alert
        v-if="errorMessage"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-4"
        closable
        @click:close="errorMessage = ''"
      >
        {{ errorMessage }}
      </v-alert>

      <v-text-field
        v-model="email"
        label="E-mail"
        type="email"
        autocomplete="username"
        prepend-inner-icon="mdi-email-outline"
        required
        class="mb-6"
      />

      <v-btn type="submit" color="primary" block size="large" :loading="loading">
        Enviar link de recuperação
      </v-btn>
    </v-form>

    <div class="text-center text-caption mt-8">
      <RouterLink class="text-primary text-decoration-none font-weight-medium" :to="loginRoute">
        <v-icon icon="mdi-arrow-left" size="14" class="mr-1" />
        Voltar para o login
      </RouterLink>
    </div>
  </AuthLayout>
</template>
