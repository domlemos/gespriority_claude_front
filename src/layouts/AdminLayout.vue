<script setup>
import AppLayout from '@/layouts/AppLayout.vue'

const items = [
  { title: 'Clientes', icon: 'mdi-domain', to: { name: 'admin-clients' } },
  { title: 'Usuários da Aplicação', icon: 'mdi-account-cog', to: { name: 'admin-users' } },
  { title: 'Usuários de Clientes', icon: 'mdi-account-group', to: { name: 'admin-customers' } },
]
</script>

<template>
  <AppLayout>
    <template #drawer>
      <v-list nav density="compact">
        <v-list-item
          v-for="item in items"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
        />
      </v-list>
    </template>

    <router-view />
  </AppLayout>
</template>
