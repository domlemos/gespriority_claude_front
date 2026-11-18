<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/layouts/AppLayout.vue'

const { t } = useI18n()

const menuGroups = computed(() => [
  {
    title: t('nav.groupRegisters'),
    items: [
      { title: t('nav.clients'), icon: 'mdi-domain', to: { name: 'admin-clients' } },
      { title: t('nav.appUsers'), icon: 'mdi-account-cog', to: { name: 'admin-users' } },
      { title: t('nav.customerUsers'), icon: 'mdi-account-group', to: { name: 'admin-customers' } },
    ],
  },
  {
    title: t('nav.groupPolicies'),
    items: [
      { title: t('nav.slaPolicies'), icon: 'mdi-timer-alert-outline', to: { name: 'admin-slas' } },
      { title: t('nav.solutionGroups'), icon: 'mdi-account-multiple-outline', to: { name: 'admin-solution-groups' } },
    ],
  },
  {
    title: t('nav.groupCategories'),
    items: [
      { title: t('nav.categories'), icon: 'mdi-shape-outline', to: { name: 'admin-categories' } },
      { title: t('nav.subcategories'), icon: 'mdi-shape-plus-outline', to: { name: 'admin-subcategories' } },
      { title: t('nav.items'), icon: 'mdi-tag-outline', to: { name: 'admin-items' } },
    ],
  },
  {
    title: t('nav.groupAudit'),
    items: [
      { title: t('nav.auditLogs'), icon: 'mdi-history', to: { name: 'admin-audit-logs' } },
    ],
  },
])
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
