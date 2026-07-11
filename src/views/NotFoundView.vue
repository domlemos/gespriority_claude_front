<script setup>
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <v-main class="d-flex align-center justify-center" style="min-height: 100vh">
    <div class="text-center">
      <div class="text-h2 font-weight-bold text-primary mb-2">404</div>
      <p class="text-body-1 text-medium-emphasis mb-6">Página não encontrada.</p>
      <v-btn
        color="primary"
        :to="auth.isAuthenticated ? (auth.isCustomer ? { name: 'portal' } : { name: 'dashboard' }) : { name: 'staff-login' }"
      >
        Voltar
      </v-btn>
    </div>
  </v-main>
</template>
