<script setup>
import { ref, watch } from 'vue'
import slaService from '@/services/slaService'
import clientService from '@/services/clientService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  sla: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const PRIORIDADES = [
  { title: 'Baixa', value: 'baixa' },
  { title: 'Média', value: 'media' },
  { title: 'Alta', value: 'alta' },
  { title: 'Urgente', value: 'urgente' },
]

const GLOBAL_CLIENT_OPTION = { name: 'Global (todos os clientes)', id: null }

const nome = ref('')
const prioridade = ref(null)
const tempoRespostaMinutos = ref(null)
const tempoResolucaoMinutos = ref(null)
const apenasHorasUteis = ref(false)
const ativo = ref(true)
const clientId = ref(null)
const clientOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

async function loadClients() {
  const { data } = await clientService.list({ per_page: 200 })
  clientOptions.value = [GLOBAL_CLIENT_OPTION, ...data]
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    nome.value = props.sla?.nome ?? ''
    prioridade.value = props.sla?.prioridade ?? null
    tempoRespostaMinutos.value = props.sla?.tempo_resposta_minutos ?? null
    tempoResolucaoMinutos.value = props.sla?.tempo_resolucao_minutos ?? null
    apenasHorasUteis.value = props.sla?.apenas_horas_uteis ?? false
    ativo.value = props.sla?.ativo ?? true
    clientId.value = props.sla?.client_id ?? null

    await loadClients()
  },
)

function close() {
  emit('update:modelValue', false)
}

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  const payload = {
    nome: nome.value,
    prioridade: prioridade.value,
    tempo_resposta_minutos: tempoRespostaMinutos.value,
    tempo_resolucao_minutos: tempoResolucaoMinutos.value,
    apenas_horas_uteis: apenasHorasUteis.value,
    ativo: ativo.value,
    client_id: clientId.value,
  }

  try {
    if (props.sla) {
      await slaService.update(props.sla.id, payload)
    } else {
      await slaService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar a política de SLA.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">
        {{ sla ? 'Editar política de SLA' : 'Nova política de SLA' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="nome" label="Nome" required autofocus class="mb-2" />

          <v-select
            v-model="prioridade"
            :items="PRIORIDADES"
            label="Prioridade"
            required
            class="mb-2"
          />

          <v-text-field
            v-model.number="tempoRespostaMinutos"
            label="Tempo de resposta (minutos)"
            type="number"
            min="1"
            required
            class="mb-2"
          />

          <v-text-field
            v-model.number="tempoResolucaoMinutos"
            label="Tempo de resolução (minutos)"
            type="number"
            min="1"
            required
            class="mb-2"
          />

          <v-select
            v-model="clientId"
            :items="clientOptions"
            item-title="name"
            item-value="id"
            label="Cliente"
            hint="Deixe em Global para aplicar a todos os clientes sem política específica"
            persistent-hint
            class="mb-4"
          />

          <v-checkbox v-model="apenasHorasUteis" label="Contar apenas em horário útil" density="compact" hide-details class="mb-2" />
          <v-checkbox v-model="ativo" label="Ativo" density="compact" hide-details />
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancelar</v-btn>
        <v-btn color="primary" :loading="loading" @click="onSubmit">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
