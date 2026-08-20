<script setup>
import { computed, ref } from 'vue'
import UserFormModal from '@/components/admin/UserFormModal.vue'
import UserAdvancedFilterModal from '@/components/admin/UserAdvancedFilterModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import userService from '@/services/userService'
import roleService from '@/services/roleService'
import solutionGroupService from '@/services/solutionGroupService'
import { extractErrorMessage } from '@/utils/errors'

const headers = [
  { title: 'Nome', key: 'name', sortable: false },
  { title: 'E-mail', key: 'email', sortable: false },
  { title: 'Papéis', key: 'roles', sortable: false },
  { title: 'Grupo de Solução', key: 'grupo_solucao', sortable: false },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
]

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)

const formOpen = ref(false)
const editingUser = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const userToDelete = ref(null)

const filterModalOpen = ref(false)
const appliedFilters = ref({})
const roleOptions = ref([])
const solutionGroupOptions = ref([])

const hasActiveFilters = computed(() =>
  Object.values(appliedFilters.value).some((value) => value !== null && value !== undefined),
)

function clearFilters() {
  appliedFilters.value = {}
  page.value = 1
  loadUsers()
}

function applyFilters(filters) {
  appliedFilters.value = filters
  page.value = 1
  loadUsers()
}

async function loadFilterOptions() {
  try {
    const [roles, groups] = await Promise.all([
      roleService.list(),
      solutionGroupService.list({ per_page: 200 }),
    ])
    roleOptions.value = roles.data
    solutionGroupOptions.value = groups.data
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as opções de filtro.')
  }
}

function buildFilterParams() {
  const params = {}
  for (const [key, value] of Object.entries(appliedFilters.value)) {
    if (value !== null && value !== undefined) params[key] = value
  }
  return params
}

async function loadUsers() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await userService.list({
      page: page.value,
      per_page: itemsPerPage.value,
      ...buildFilterParams(),
    })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os usuários.')
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadUsers()
}

function openCreate() {
  editingUser.value = null
  formOpen.value = true
}

function openEdit(user) {
  editingUser.value = user
  formOpen.value = true
}

function askDelete(user) {
  userToDelete.value = user
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await userService.remove(userToDelete.value.id)
    deleteOpen.value = false
    await loadUsers()

    if (items.value.length === 0 && page.value > 1) {
      page.value -= 1
      await loadUsers()
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o usuário.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}

loadFilterOptions()
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Usuários da Aplicação</h1>
    <div class="d-flex align-center ga-2">
      <v-btn v-if="hasActiveFilters" variant="text" size="small" prepend-icon="mdi-filter-off" @click="clearFilters">
        Limpar filtros
      </v-btn>
      <v-btn variant="outlined" prepend-icon="mdi-filter-variant" @click="filterModalOpen = true">
        Filtro Avançado
      </v-btn>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Novo usuário</v-btn>
    </div>
  </div>

  <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
    {{ errorMessage }}
  </v-alert>

  <UserAdvancedFilterModal
    v-model="filterModalOpen"
    :filters="appliedFilters"
    :role-options="roleOptions"
    :solution-group-options="solutionGroupOptions"
    @apply="applyFilters"
  />

  <v-data-table-server
    :headers="headers"
    :items="items"
    :items-length="totalItems"
    :items-per-page="itemsPerPage"
    :loading="loading"
    @update:options="onOptionsUpdate"
  >
    <template #item.roles="{ item }">
      <v-chip
        v-for="role in item.roles"
        :key="role"
        size="small"
        color="secondary"
        variant="tonal"
        class="mr-1"
      >
        {{ role }}
      </v-chip>
    </template>

    <template #item.grupo_solucao="{ item }">
      {{ item.grupo_solucao?.nome ?? '—' }}
    </template>

    <template #item.actions="{ item }">
      <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(item)" />
      <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
    </template>
  </v-data-table-server>

  <UserFormModal v-model="formOpen" :user="editingUser" @saved="loadUsers" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message='`Excluir o usuário "${userToDelete?.name}"? Essa ação não pode ser desfeita.`'
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
