<script setup>
import { ref } from 'vue'
import IncidentFeed from '@/components/IncidentFeed.vue'
import IncidentAttachments from '@/components/IncidentAttachments.vue'

defineProps({
  incidentId: { type: [String, Number], required: true },
})

const activeTab = ref('feed')
const feedRef = ref(null)

defineExpose({ reload: () => feedRef.value?.reload() })
</script>

<template>
  <v-card variant="outlined" class="d-flex flex-column bg-surface" style="height: 500px">
    <v-tabs v-model="activeTab" color="primary" class="flex-shrink-0">
      <v-tab value="feed" class="text-none" @click="($event) => $event.currentTarget.blur()">
        Feed do incidente
      </v-tab>
      <v-tab value="anexos" class="text-none" @click="($event) => $event.currentTarget.blur()">
        Anexos
      </v-tab>
    </v-tabs>

    <v-divider class="flex-shrink-0" />

    <div class="flex-grow-1 d-flex flex-column" style="min-height: 0">
      <div v-show="activeTab === 'feed'" class="flex-grow-1 d-flex flex-column" style="min-height: 0">
        <IncidentFeed ref="feedRef" :incident-id="incidentId" />
      </div>

      <div v-show="activeTab === 'anexos'" class="flex-grow-1 d-flex flex-column" style="min-height: 0">
        <IncidentAttachments :incident-id="incidentId" />
      </div>
    </div>
  </v-card>
</template>

<style scoped>
/*
 * O conteúdo de cada aba troca instantaneamente (v-show). Sem isso, o rótulo
 * da aba e a barrinha deslizante do Vuetify levam alguns frames pra animar
 * até o novo estado "selecionado", criando um instante em que a aba
 * destacada não bate com o conteúdo exibido.
 */
:deep(.v-tab) {
  transition: none !important;
}

:deep(.v-tabs-slider),
:deep(.v-tab-slider) {
  transition: none !important;
}
</style>
