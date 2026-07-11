<script setup>
import { computed } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const expiresAtLabel = computed(() => {
  if (!auth.expiresAt) return '—'
  return new Date(auth.expiresAt).toLocaleString('pt-BR')
})
</script>

<template>
  <AppLayout>
    <h1 class="text-h5 font-weight-bold mb-1">Olá, {{ auth.user?.name }} 👋</h1>
    <p class="text-body-2 text-medium-emphasis mb-8">
      Bem-vindo ao portal do cliente.
    </p>

    <v-row>
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-2">
          <v-card-title class="text-subtitle-1 font-weight-bold">Sua conta</v-card-title>
          <v-card-text>
            <div class="mb-3">
              <div class="text-caption text-medium-emphasis">E-mail</div>
              <div>{{ auth.user?.email }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Sessão expira em</div>
              <div>{{ expiresAtLabel }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-2">
          <v-card-title class="text-subtitle-1 font-weight-bold">Seus chamados</v-card-title>
          <v-card-text class="text-body-2 text-medium-emphasis">
            O módulo de abertura e acompanhamento de chamados ainda não foi
            implementado no backend — esta tela existe só para validar o fluxo
            de login do portal do cliente.
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </AppLayout>
</template>
