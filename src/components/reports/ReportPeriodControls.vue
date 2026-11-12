<script setup>
import { PERIODO_OPTIONS, QUEBRA_OPTIONS } from '@/utils/reportPeriod'

// Controles de quebra e período (atalhos + personalizado) dos relatórios.
defineProps({
  periodoLabel: { type: String, default: 'Período' },
  // Período obrigatório: o atalho não pode ser desmarcado e não há "todo o histórico".
  obrigatorio: { type: Boolean, default: false },
})

const quebra = defineModel('quebra', { type: String, required: true })
const periodo = defineModel('periodo', { type: String, default: null })
const dataInicio = defineModel('dataInicio', { type: String, default: null })
const dataFim = defineModel('dataFim', { type: String, default: null })
</script>

<template>
  <div class="text-caption text-medium-emphasis mb-1">Quebrar por período</div>
  <v-btn-toggle
    v-model="quebra"
    mandatory
    color="primary"
    density="comfortable"
    class="mb-3"
  >
    <v-btn v-for="o in QUEBRA_OPTIONS" :key="o.value" :value="o.value" size="small">{{ o.title }}</v-btn>
  </v-btn-toggle>

  <div class="text-caption text-medium-emphasis mb-1">{{ periodoLabel }}</div>
  <v-btn-toggle
    v-model="periodo"
    :mandatory="obrigatorio"
    color="primary"
    density="comfortable"
    class="mb-2 flex-wrap"
    style="height: auto"
  >
    <v-btn v-for="o in PERIODO_OPTIONS" :key="o.value" :value="o.value" size="small">{{ o.title }}</v-btn>
  </v-btn-toggle>
  <v-row v-if="periodo === 'personalizado'" dense class="mb-2">
    <v-col cols="6">
      <v-text-field v-model="dataInicio" type="date" label="Data início" density="compact" clearable />
    </v-col>
    <v-col cols="6">
      <v-text-field v-model="dataFim" type="date" label="Data fim" density="compact" clearable />
    </v-col>
  </v-row>
  <div v-else-if="!periodo && !obrigatorio" class="text-caption text-medium-emphasis mb-2">Sem período: todo o histórico.</div>
</template>
