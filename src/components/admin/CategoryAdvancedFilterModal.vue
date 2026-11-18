<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue', 'apply'])

const { t } = useI18n()

const ativoOptions = computed(() => [
  { value: true, title: t('admin.common.yes') },
  { value: false, title: t('admin.common.no') },
])

const nome = ref(null)
const ativo = ref(null)

function resetDraft() {
  nome.value = props.filters.nome ?? null
  ativo.value = props.filters.ativo ?? null
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetDraft()
  },
)

function clearDraft() {
  nome.value = null
  ativo.value = null
}

function close() {
  emit('update:modelValue', false)
}

function applyFilters() {
  emit('apply', {
    nome: nome.value,
    ativo: ativo.value,
  })
  close()
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">{{ $t('admin.common.advancedFilter') }}</v-card-title>

      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-text-field v-model="nome" :label="$t('admin.common.name')" clearable density="compact" />
          </v-col>

          <v-col cols="12">
            <v-select v-model="ativo" :items="ativoOptions" :label="$t('admin.common.active')" clearable density="compact" />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-btn variant="text" @click="clearDraft">{{ $t('admin.common.clear') }}</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ $t('common.cancel') }}</v-btn>
        <v-btn color="primary" @click="applyFilters">{{ $t('admin.common.filter') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
