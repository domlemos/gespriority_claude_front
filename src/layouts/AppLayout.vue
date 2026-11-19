<script setup>
import { computed, ref, useSlots, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { initials } from '@/utils/text'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'

defineProps({
  fluid: { type: Boolean, default: false },
})

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const slots = useSlots()
const { smAndDown } = useDisplay()
const loggingOut = ref(false)

// Abas principais do staff. No celular/tablet em pé elas saem do app-bar e
// vão pro drawer (junto com o menu da administração, quando houver).
const mainNav = computed(() => {
  if (auth.isCustomer) return []
  return [
    auth.hasPermission('tickets.view') && { title: t('nav.incidents'), icon: 'mdi-ticket-outline', to: { name: 'dashboard' } },
    auth.hasPermission('relatorios.view') && { title: t('nav.reports'), icon: 'mdi-chart-box-outline', to: { name: 'reports' } },
    auth.roles.includes('admin') && { title: t('nav.admin'), icon: 'mdi-shield-account', to: { name: 'admin' } },
  ].filter(Boolean)
})

const hasDrawerSlot = computed(() => !!slots.drawer)
const showNavToggle = computed(() => smAndDown.value && (mainNav.value.length > 0 || hasDrawerSlot.value))
const drawerOpen = ref(false)

// Fecha o drawer temporário ao navegar.
watch(() => route.fullPath, () => {
  if (smAndDown.value) drawerOpen.value = false
})

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
    <v-app-bar-nav-icon v-if="showNavToggle" :aria-label="t('common.openMenu')" @click="drawerOpen = !drawerOpen" />

    <div class="d-flex align-center" :class="showNavToggle ? 'ml-1' : 'ml-2'">
      <v-icon icon="mdi-shield-check" color="primary" class="mr-2" />
      <span class="font-weight-bold">upITSM</span>
      <v-chip v-if="auth.isCustomer" size="small" class="ml-3 d-none d-sm-flex" color="secondary" variant="tonal">
        {{ t('nav.customerPortal') }}
      </v-chip>
    </div>

    <v-tabs v-if="!smAndDown && mainNav.length" color="primary" class="ml-6">
      <v-tab v-for="item in mainNav" :key="item.title" class="text-none" :to="item.to">
        {{ item.title }}
      </v-tab>
    </v-tabs>

    <v-spacer />

    <LocaleSwitcher class="mr-1" />

    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" variant="text" class="text-none mr-1 mr-sm-2 px-2">
          <v-avatar color="primary" size="32" class="mr-sm-2">
            <span class="text-caption font-weight-bold">{{ initials(auth.user?.name) }}</span>
          </v-avatar>
          <span class="d-none d-md-inline">{{ auth.user?.name }}</span>
          <v-icon icon="mdi-chevron-down" class="ml-1 d-none d-sm-inline-flex" />
        </v-btn>
      </template>

      <v-list density="compact" min-width="240">
        <v-list-item :title="auth.user?.name" :subtitle="auth.user?.email" />
        <v-divider class="my-1" />
        <v-list-item
          v-if="auth.roles.includes('admin')"
          prepend-icon="mdi-shield-account"
          :title="t('nav.admin')"
          :to="{ name: 'admin' }"
        />
        <v-divider v-if="auth.roles.includes('admin')" class="my-1" />
        <v-list-item
          prepend-icon="mdi-logout"
          :title="t('nav.logout')"
          :disabled="loggingOut"
          @click="handleLogout(false)"
        />
        <v-list-item
          prepend-icon="mdi-logout-variant"
          :title="t('nav.logoutAll')"
          :disabled="loggingOut"
          @click="handleLogout(true)"
        />
      </v-list>
    </v-menu>
  </v-app-bar>

  <v-navigation-drawer v-if="smAndDown && showNavToggle" v-model="drawerOpen" temporary>
    <v-list v-if="mainNav.length" nav density="compact">
      <v-list-item
        v-for="item in mainNav"
        :key="item.title"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="item.title"
        :exact="item.to.name !== 'admin'"
      />
    </v-list>
    <template v-if="hasDrawerSlot">
      <v-divider v-if="mainNav.length" />
      <slot name="drawer" />
    </template>
  </v-navigation-drawer>

  <v-navigation-drawer v-else-if="hasDrawerSlot" permanent>
    <slot name="drawer" />
  </v-navigation-drawer>

  <v-main>
    <v-container class="py-4 py-md-8 px-3 px-sm-4" :fluid="fluid" :style="fluid ? undefined : 'max-width: 1100px'">
      <slot />
    </v-container>
  </v-main>
</template>
