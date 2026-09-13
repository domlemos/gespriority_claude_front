<script setup>
import { computed, ref, watch } from 'vue'
import userService from '@/services/userService'
import solutionGroupService from '@/services/solutionGroupService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  user: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const ownGroupId = ref(null)
const ownGroupName = ref('')
const selectedIds = ref([])
const groupOptions = ref([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

// O grupo próprio já é implícito em toda visibilidade do usuário — não faz
// sentido oferecê-lo de novo como "extra" na lista de seleção.
const availableOptions = computed(() =>
  groupOptions.value.filter((group) => group.id !== ownGroupId.value),
)

watch(
  () => props.modelValue,
  async (open) => {
    if (!open || !props.user) return

    errorMessage.value = ''
    loading.value = true
    selectedIds.value = []

    try {
      const [{ data: visibility }, { data: allGroups }] = await Promise.all([
        userService.getVisibleGroups(props.user.id),
        solutionGroupService.list({ per_page: 200 }),
      ])
      ownGroupId.value = visibility.grupo_solucao_id
      ownGroupName.value = visibility.grupo_solucao?.nome ?? ''
      selectedIds.value = visibility.grupos_extra.map((group) => group.id)
      groupOptions.value = allGroups
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar a visibilidade do usuário.')
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

  try {
    await userService.updateVisibleGroups(props.user.id, { grupo_solucao_ids: selectedIds.value })
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar a visibilidade do usuário.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">
        Visibilidade de "{{ user?.name }}"
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
            Por padrão, {{ user?.name }} só enxerga incidentes do próprio grupo
            (<strong>{{ ownGroupName }}</strong>). Selecione abaixo grupos extras que ele também deve
            enxergar.
          </p>

          <v-select
            v-model="selectedIds"
            :items="availableOptions"
            item-title="nome"
            item-value="id"
            label="Grupos com visibilidade extra"
            multiple
            chips
            closable-chips
          />
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
