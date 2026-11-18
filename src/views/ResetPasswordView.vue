<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { extractErrorMessage } from '@/utils/errors'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()

const guard = computed(() => route.meta.guard ?? 'web')
const loginRoute = computed(() =>
  guard.value === 'customer' ? { name: 'customer-login' } : { name: 'staff-login' },
)

const email = ref(route.query.email ?? '')
const token = ref(route.query.token ?? '')
const password = ref('')
const passwordConfirmation = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const done = ref(false)

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    await auth.resetPassword(guard.value, {
      token: token.value,
      email: email.value,
      password: password.value,
      password_confirmation: passwordConfirmation.value,
    })
    done.value = true
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('auth.reset.failed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout :title="t('auth.reset.title')" :subtitle="t('auth.reset.subtitle')">
    <v-alert v-if="done" type="success" variant="tonal" density="comfortable" class="mb-4">
      {{ $t('auth.reset.done') }}
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
        :label="$t('auth.email')"
        type="email"
        autocomplete="username"
        prepend-inner-icon="mdi-email-outline"
        required
        class="mb-2"
      />

      <v-text-field
        v-model="password"
        :label="$t('auth.reset.newPassword')"
        :type="showPassword ? 'text' : 'password'"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-outline"
        :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        required
        class="mb-2"
        @click:append-inner="showPassword = !showPassword"
      />

      <v-text-field
        v-model="passwordConfirmation"
        :label="$t('auth.reset.confirmPassword')"
        :type="showPassword ? 'text' : 'password'"
        autocomplete="new-password"
        prepend-inner-icon="mdi-lock-check-outline"
        required
        class="mb-6"
      />

      <v-btn type="submit" color="primary" block size="large" :loading="loading">
        {{ $t('auth.reset.submit') }}
      </v-btn>
    </v-form>

    <div class="text-center text-caption mt-8">
      <RouterLink class="text-primary text-decoration-none font-weight-medium" :to="loginRoute">
        <v-icon icon="mdi-arrow-left" size="14" class="mr-1" />
        {{ $t('auth.backToLogin') }}
      </RouterLink>
    </div>
  </AuthLayout>
</template>
