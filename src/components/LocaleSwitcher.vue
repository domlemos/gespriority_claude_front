<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALE_OPTIONS, setLocale } from '@/plugins/i18n'
import { useAuthStore } from '@/stores/auth'

const { t, locale } = useI18n()
const auth = useAuthStore()

function choose(code) {
  setLocale(code)
  auth.saveLocale(code)
}

const shortName = computed(() => LOCALE_OPTIONS.find((o) => o.code === locale.value)?.short ?? '')
const options = computed(() => LOCALE_OPTIONS.map((o) => ({ code: o.code, title: t(o.nameKey) })))
</script>

<template>
  <div class="locale-switcher d-inline-flex">
    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" variant="text" class="text-none" :aria-label="t('locale.label')" :title="t('locale.label')">
          <v-icon icon="mdi-translate" class="mr-1" />
          {{ shortName }}
          <v-icon icon="mdi-chevron-down" size="small" class="ml-1" />
        </v-btn>
      </template>

      <v-list density="compact" min-width="160">
        <v-list-item
          v-for="option in options"
          :key="option.code"
          :title="option.title"
          :active="option.code === locale"
          @click="choose(option.code)"
        />
      </v-list>
    </v-menu>
  </div>
</template>
