<script setup>
import { ref } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import AdvancedReportPanel from '@/components/reports/AdvancedReportPanel.vue'
import FluxosPanel from '@/components/reports/FluxosPanel.vue'
import IndicadoresPanel from '@/components/reports/IndicadoresPanel.vue'

const aba = ref('indicadores')
</script>

<template>
  <AppLayout fluid>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5 font-weight-bold ma-0">Relatórios</h1>
    </div>

    <v-tabs v-model="aba" color="primary" class="mb-4">
      <v-tab value="indicadores">Indicadores por grupo</v-tab>
      <v-tab value="fluxos">Mapa de fluxos</v-tab>
      <v-tab value="avancado">Avançado</v-tab>
    </v-tabs>

    <!-- v-show (e não v-if/v-window): as abas ficam montadas, então trocar
         de aba preserva filtros e resultado de cada uma. -->
    <IndicadoresPanel v-show="aba === 'indicadores'" />
    <FluxosPanel v-show="aba === 'fluxos'" />
    <AdvancedReportPanel v-show="aba === 'avancado'" />
  </AppLayout>
</template>
