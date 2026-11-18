<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { extractErrorMessage } from '@/utils/errors'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    await auth.login('customer', { email: email.value, password: password.value })
    router.replace(route.query.redirect || { name: 'portal' })
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('auth.staffLogin.loginFailed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout :title="t('auth.customerLogin.title')" :subtitle="t('auth.customerLogin.subtitle')">
    <v-form @submit.prevent="onSubmit">
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
        :label="$t('auth.email')"
        type="email"
        autocomplete="username"
        prepend-inner-icon="mdi-email-outline"
        required
        class="mb-2"
      />

      <v-text-field
        v-model="password"
        :label="$t('auth.password')"
        :type="showPassword ? 'text' : 'password'"
        autocomplete="current-password"
        prepend-inner-icon="mdi-lock-outline"
        :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        required
        class="mb-2"
        @click:append-inner="showPassword = !showPassword"
      />

      <div class="d-flex justify-end mb-6">
        <RouterLink class="text-caption text-primary text-decoration-none" :to="{ name: 'customer-forgot-password' }">
          {{ $t('auth.forgotLink') }}
        </RouterLink>
      </div>

      <v-btn
        type="submit"
        color="primary"
        block
        size="large"
        :loading="loading"
      >
        {{ $t('auth.signIn') }}
      </v-btn>

      <div class="text-center text-caption text-medium-emphasis mt-8">
        {{ $t('auth.customerLogin.staffPrompt') }}
        <RouterLink class="text-primary text-decoration-none font-weight-medium" :to="{ name: 'staff-login' }">
          {{ $t('auth.customerLogin.staffLink') }}
        </RouterLink>
      </div>
    </v-form>
  </AuthLayout>
</template>
