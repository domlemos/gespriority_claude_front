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

function minutesToDhm(totalMinutes) {
  const abs = Math.max(0, Math.trunc(totalMinutes ?? 0))
  return {
    dias: Math.floor(abs / 1440),
    horas: Math.floor((abs % 1440) / 60),
    minutos: abs % 60,
  }
}

function dhmToMinutes(dias, horas, minutos) {
  return (Number(dias) || 0) * 1440 + (Number(horas) || 0) * 60 + (Number(minutos) || 0)
}

const nome = ref('')
const prioridade = ref(null)
const respostaDias = ref(0)
const respostaHoras = ref(0)
const respostaMinutos = ref(0)
const resolucaoDias = ref(0)
const resolucaoHoras = ref(0)
const resolucaoMinutos = ref(0)
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

    const resposta = minutesToDhm(props.sla?.tempo_resposta_minutos)
    respostaDias.value = resposta.dias
    respostaHoras.value = resposta.horas
    respostaMinutos.value = resposta.minutos

    const resolucao = minutesToDhm(props.sla?.tempo_resolucao_minutos)
    resolucaoDias.value = resolucao.dias
    resolucaoHoras.value = resolucao.horas
    resolucaoMinutos.value = resolucao.minutos

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
    tempo_resposta_minutos: dhmToMinutes(respostaDias.value, respostaHoras.value, respostaMinutos.value),
    tempo_resolucao_minutos: dhmToMinutes(resolucaoDias.value, resolucaoHoras.value, resolucaoMinutos.value),
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

          <div class="text-caption text-medium-emphasis mb-1">Tempo de resposta</div>
          <v-row dense class="mb-2">
            <v-col cols="4">
              <v-text-field v-model.number="respostaDias" label="Dias" type="number" min="0" />
            </v-col>
            <v-col cols="4">
              <v-text-field v-model.number="respostaHoras" label="Horas" type="number" min="0" />
            </v-col>
            <v-col cols="4">
              <v-text-field v-model.number="respostaMinutos" label="Minutos" type="number" min="0" />
            </v-col>
          </v-row>

          <div class="text-caption text-medium-emphasis mb-1">Tempo de resolução</div>
          <v-row dense class="mb-2">
            <v-col cols="4">
              <v-text-field v-model.number="resolucaoDias" label="Dias" type="number" min="0" />
            </v-col>
            <v-col cols="4">
              <v-text-field v-model.number="resolucaoHoras" label="Horas" type="number" min="0" />
            </v-col>
            <v-col cols="4">
              <v-text-field v-model.number="resolucaoMinutos" label="Minutos" type="number" min="0" />
            </v-col>
          </v-row>

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
