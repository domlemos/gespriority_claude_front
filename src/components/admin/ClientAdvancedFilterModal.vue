<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:modelValue', 'apply'])

const name = ref(null)

function resetDraft() {
  name.value = props.filters.name ?? null
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetDraft()
  },
)

function clearDraft() {
  name.value = null
}

function close() {
  emit('update:modelValue', false)
}

function applyFilters() {
  emit('apply', {
    name: name.value,
  })
  close()
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">{{ $t('admin.common.advancedFilter') }}</v-card-title>

      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-text-field v-model="name" :label="$t('admin.common.name')" clearable density="compact" />
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
