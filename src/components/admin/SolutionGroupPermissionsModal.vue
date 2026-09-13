<script setup>
import { computed, ref, watch } from 'vue'
import solutionGroupService from '@/services/solutionGroupService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  solutionGroup: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const AREA_LABELS = {
  tickets: 'Chamados',
  users: 'Usuários',
  roles: 'Papéis',
  clients: 'Clientes',
  customers: 'Usuários de Clientes',
  slas: 'SLA',
  categorias: 'Categorias',
  grupos_solucao: 'Grupos de Solução',
  relatorios: 'Relatórios',
}

const ESTADOS = [
  { value: 'padrao', label: 'Padrão' },
  { value: 'liberada', label: 'Liberada' },
  { value: 'bloqueada', label: 'Bloqueada' },
]

const permissions = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

// Agrupa pelo prefixo do slug (ex.: "tickets.view" -> "tickets") — mesma
// área usada nas telas de admin (Chamados, Usuários, etc.), só pra
// organizar a lista, sem nenhum significado pro backend.
const groups = computed(() => {
  const byArea = new Map()
  for (const permission of permissions.value) {
    const area = permission.slug.split('.')[0]
    if (!byArea.has(area)) byArea.set(area, [])
    byArea.get(area).push(permission)
  }
  return Array.from(byArea.entries()).map(([area, items]) => ({
    area,
    label: AREA_LABELS[area] ?? area,
    items,
  }))
})

watch(
  () => props.modelValue,
  async (open) => {
    if (!open || !props.solutionGroup) return

    errorMessage.value = ''
    loading.value = true
    permissions.value = []

    try {
      const { data } = await solutionGroupService.getPermissions(props.solutionGroup.id)
      permissions.value = data
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as permissões do grupo.')
    } finally {
      loading.value = false
    }
  },
)

function close() {
  emit('update:modelValue', false)
}

async function onSubmit() {
  errorMessage.value = ''
  saving.value = true

  const liberadas = permissions.value.filter((p) => p.estado === 'liberada').map((p) => p.id)
  const bloqueadas = permissions.value.filter((p) => p.estado === 'bloqueada').map((p) => p.id)

  try {
    await solutionGroupService.updatePermissions(props.solutionGroup.id, { liberadas, bloqueadas })
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar as permissões do grupo.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">
        Acessos de "{{ solutionGroup?.nome }}"
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <div v-if="loading" class="d-flex justify-center py-6">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <template v-else>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Por padrão, cada permissão segue o papel do usuário. Use "Liberada" para conceder uma
            permissão extra só a este grupo, ou "Bloqueada" para retirá-la mesmo que o papel a conceda.
          </p>

          <div v-for="group in groups" :key="group.area" class="mb-4">
            <div class="text-subtitle-2 font-weight-bold mb-2">{{ group.label }}</div>

            <div
              v-for="permission in group.items"
              :key="permission.id"
              class="d-flex align-center justify-space-between mb-2"
            >
              <span class="text-body-2">{{ permission.name }}</span>
              <v-btn-toggle v-model="permission.estado" density="compact" mandatory divided>
                <v-btn v-for="estado in ESTADOS" :key="estado.value" :value="estado.value" size="small">
                  {{ estado.label }}
                </v-btn>
              </v-btn-toggle>
            </div>
          </div>
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancelar</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="loading" @click="onSubmit">Salvar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
