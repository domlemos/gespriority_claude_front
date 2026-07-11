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
      Este é o painel interno do ITSM.
    </p>

    <v-row>
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-2">
          <v-card-title class="text-subtitle-1 font-weight-bold">Seu perfil</v-card-title>
          <v-card-text>
            <div class="mb-3">
              <div class="text-caption text-medium-emphasis">E-mail</div>
              <div>{{ auth.user?.email }}</div>
            </div>

            <div class="mb-3">
              <div class="text-caption text-medium-emphasis mb-1">Papéis (roles)</div>
              <v-chip
                v-for="role in auth.roles"
                :key="role"
                size="small"
                color="secondary"
                variant="tonal"
                class="mr-1 mb-1"
              >
                {{ role }}
              </v-chip>
              <span v-if="!auth.roles.length" class="text-caption text-medium-emphasis">
                Nenhum papel atribuído.
              </span>
            </div>

            <div>
              <div class="text-caption text-medium-emphasis mb-1">Permissões</div>
              <v-chip
                v-for="permission in auth.permissions"
                :key="permission"
                size="small"
                color="primary"
                variant="tonal"
                class="mr-1 mb-1"
              >
                {{ permission }}
              </v-chip>
              <span v-if="!auth.permissions.length" class="text-caption text-medium-emphasis">
                Nenhuma permissão atribuída.
              </span>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-2">
          <v-card-title class="text-subtitle-1 font-weight-bold">Sessão</v-card-title>
          <v-card-text>
            <div class="mb-3">
              <div class="text-caption text-medium-emphasis">Guard</div>
              <div>{{ auth.guard }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Token expira em</div>
              <div>{{ expiresAtLabel }}</div>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="pa-2 mt-4">
          <v-card-title class="text-subtitle-1 font-weight-bold">Próximos passos</v-card-title>
          <v-card-text class="text-body-2 text-medium-emphasis">
            O módulo de chamados (Tickets) ainda não foi implementado no backend —
            esta tela existe só para validar o fluxo de login/autorização.
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </AppLayout>
</template>
