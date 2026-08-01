<script setup>
import { ref } from 'vue'
import SolutionGroupFormModal from '@/components/admin/SolutionGroupFormModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import solutionGroupService from '@/services/solutionGroupService'
import { extractErrorMessage } from '@/utils/errors'

const headers = [
  { title: 'Nome', key: 'nome', sortable: false },
  { title: 'Ativo', key: 'ativo', sortable: false },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
]

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)

const formOpen = ref(false)
const editingSolutionGroup = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const solutionGroupToDelete = ref(null)

async function loadSolutionGroups() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await solutionGroupService.list({ page: page.value, per_page: itemsPerPage.value })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os grupos de solução.')
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadSolutionGroups()
}

function openCreate() {
  editingSolutionGroup.value = null
  formOpen.value = true
}

function openEdit(solutionGroup) {
  editingSolutionGroup.value = solutionGroup
  formOpen.value = true
}

function askDelete(solutionGroup) {
  solutionGroupToDelete.value = solutionGroup
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await solutionGroupService.remove(solutionGroupToDelete.value.id)
    deleteOpen.value = false
    await loadSolutionGroups()

    if (items.value.length === 0 && page.value > 1) {
      page.value -= 1
      await loadSolutionGroups()
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o grupo de solução.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Grupos de Solução</h1>
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Novo grupo</v-btn>
  </div>

  <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
    {{ errorMessage }}
  </v-alert>

  <v-data-table-server
    :headers="headers"
    :items="items"
    :items-length="totalItems"
    :items-per-page="itemsPerPage"
    :loading="loading"
    @update:options="onOptionsUpdate"
  >
    <template #item.ativo="{ item }">
      <v-chip size="small" :color="item.ativo ? 'success' : 'default'" variant="tonal">
        {{ item.ativo ? 'Ativo' : 'Inativo' }}
      </v-chip>
    </template>

    <template #item.actions="{ item }">
      <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(item)" />
      <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
    </template>
  </v-data-table-server>

  <SolutionGroupFormModal v-model="formOpen" :solution-group="editingSolutionGroup" @saved="loadSolutionGroups" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message='`Excluir o grupo de solução "${solutionGroupToDelete?.nome}"? Essa ação não pode ser desfeita.`'
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
