<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
  roleOptions: { type: Array, default: () => [] },
  solutionGroupOptions: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'apply'])

const name = ref(null)
const email = ref(null)
const roleId = ref(null)
const grupoSolucaoId = ref(null)

function resetDraft() {
  name.value = props.filters.name ?? null
  email.value = props.filters.email ?? null
  roleId.value = props.filters.role_id ?? null
  grupoSolucaoId.value = props.filters.grupo_solucao_id ?? null
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetDraft()
  },
)

function clearDraft() {
  name.value = null
  email.value = null
  roleId.value = null
  grupoSolucaoId.value = null
}

function close() {
  emit('update:modelValue', false)
}

function applyFilters() {
  emit('apply', {
    name: name.value,
    email: email.value,
    role_id: roleId.value,
    grupo_solucao_id: grupoSolucaoId.value,
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
          <v-col cols="12" sm="6">
            <v-text-field v-model="name" :label="$t('admin.common.name')" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-text-field v-model="email" :label="$t('admin.common.email')" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select
              v-model="roleId"
              :items="roleOptions"
              item-title="name"
              item-value="id"
              :label="$t('admin.users.role')"
              clearable
              density="compact"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select
              v-model="grupoSolucaoId"
              :items="solutionGroupOptions"
              item-title="nome"
              item-value="id"
              :label="$t('admin.users.solutionGroup')"
              clearable
              density="compact"
            />
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
