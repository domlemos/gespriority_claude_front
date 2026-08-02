<script setup>
import AppLayout from '@/layouts/AppLayout.vue'

const menuGroups = [
  {
    title: 'Cadastros',
    items: [
      { title: 'Clientes', icon: 'mdi-domain', to: { name: 'admin-clients' } },
      { title: 'Usuários da Aplicação', icon: 'mdi-account-cog', to: { name: 'admin-users' } },
      { title: 'Usuários de Clientes', icon: 'mdi-account-group', to: { name: 'admin-customers' } },
    ],
  },
  {
    title: 'Políticas',
    items: [
      { title: 'Políticas de SLA', icon: 'mdi-timer-alert-outline', to: { name: 'admin-slas' } },
      { title: 'Grupos de Solução', icon: 'mdi-account-multiple-outline', to: { name: 'admin-solution-groups' } },
    ],
  },
  {
    title: 'Categorias',
    items: [
      { title: 'Categorias', icon: 'mdi-shape-outline', to: { name: 'admin-categories' } },
      { title: 'Subcategorias', icon: 'mdi-shape-plus-outline', to: { name: 'admin-subcategories' } },
      { title: 'Itens', icon: 'mdi-tag-outline', to: { name: 'admin-items' } },
    ],
  },
]
</script>

<template>
  <AppLayout>
    <template #drawer>
      <v-list nav density="compact">
        <template v-for="group in menuGroups" :key="group.title">
          <v-list-subheader>{{ group.title }}</v-list-subheader>
          <v-list-item
            v-for="item in group.items"
            :key="item.title"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
          />
        </template>
      </v-list>
    </template>

    <router-view />
  </AppLayout>
</template>
