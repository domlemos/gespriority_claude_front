<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filters: { type: Object, default: () => ({}) },
  clientOptions: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'apply'])

const name = ref(null)
const email = ref(null)
const clientId = ref(null)

function resetDraft() {
  name.value = props.filters.name ?? null
  email.value = props.filters.email ?? null
  clientId.value = props.filters.client_id ?? null
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
  clientId.value = null
}

function close() {
  emit('update:modelValue', false)
}

function applyFilters() {
  emit('apply', {
    name: name.value,
    email: email.value,
    client_id: clientId.value,
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
      <v-card-title class="text-subtitle-1 font-weight-bold">Filtro Avançado</v-card-title>

      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field v-model="name" label="Nome" clearable density="compact" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-text-field v-model="email" label="E-mail" clearable density="compact" />
          </v-col>

          <v-col cols="12">
            <v-select
              v-model="clientId"
              :items="clientOptions"
              item-title="name"
              item-value="id"
              label="Cliente"
              clearable
              density="compact"
            />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-btn variant="text" @click="clearDraft">Limpar</v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancelar</v-btn>
        <v-btn color="primary" @click="applyFilters">Filtrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
