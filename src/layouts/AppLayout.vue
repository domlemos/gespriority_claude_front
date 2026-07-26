<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const loggingOut = ref(false)

function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

async function handleLogout(all = false) {
  loggingOut.value = true
  const targetLogin = auth.isCustomer ? 'customer-login' : 'staff-login'

  try {
    await (all ? auth.logoutAll() : auth.logout())
  } finally {
    loggingOut.value = false
    router.replace({ name: targetLogin })
  }
}
</script>

<template>
  <v-app-bar color="surface" elevation="1">
    <v-app-bar-title class="d-flex align-center">
      <v-icon icon="mdi-shield-check" color="primary" class="mr-2" />
      <span class="font-weight-bold">ITSM</span>
      <v-chip v-if="auth.isCustomer" size="small" class="ml-3" color="secondary" variant="tonal">
        Portal do Cliente
      </v-chip>
    </v-app-bar-title>

    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" variant="text" class="text-none mr-2">
          <v-avatar color="primary" size="32" class="mr-2">
            <span class="text-caption font-weight-bold">{{ initials(auth.user?.name) }}</span>
          </v-avatar>
          <span class="d-none d-sm-inline">{{ auth.user?.name }}</span>
          <v-icon icon="mdi-chevron-down" class="ml-1" />
        </v-btn>
      </template>

      <v-list density="compact" min-width="240">
        <v-list-item :title="auth.user?.name" :subtitle="auth.user?.email" />
        <v-divider class="my-1" />
        <v-list-item
          v-if="auth.roles.includes('admin')"
          prepend-icon="mdi-shield-account"
          title="Administração"
          :to="{ name: 'admin' }"
        />
        <v-divider v-if="auth.roles.includes('admin')" class="my-1" />
        <v-list-item
          prepend-icon="mdi-logout"
          title="Sair"
          :disabled="loggingOut"
          @click="handleLogout(false)"
        />
        <v-list-item
          prepend-icon="mdi-logout-variant"
          title="Sair de todos os dispositivos"
          :disabled="loggingOut"
          @click="handleLogout(true)"
        />
      </v-list>
    </v-menu>
  </v-app-bar>

  <v-navigation-drawer v-if="$slots.drawer" permanent>
    <slot name="drawer" />
  </v-navigation-drawer>

  <v-main>
    <v-container class="py-8" style="max-width: 1100px">
      <slot />
    </v-container>
  </v-main>
</template>
