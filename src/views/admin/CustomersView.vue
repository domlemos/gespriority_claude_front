<script setup>
import { computed, ref } from 'vue'
import CustomerFormModal from '@/components/admin/CustomerFormModal.vue'
import CustomerAdvancedFilterModal from '@/components/admin/CustomerAdvancedFilterModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import customerService from '@/services/customerService'
import clientService from '@/services/clientService'
import { extractErrorMessage } from '@/utils/errors'

const headers = [
  { title: 'Nome', key: 'name', sortable: false },
  { title: 'E-mail', key: 'email', sortable: false },
  { title: 'Cliente', key: 'client.name', sortable: false },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
]

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)

const formOpen = ref(false)
const editingCustomer = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const customerToDelete = ref(null)

const filterModalOpen = ref(false)
const appliedFilters = ref({})
const clientOptions = ref([])

const hasActiveFilters = computed(() =>
  Object.values(appliedFilters.value).some((value) => value !== null && value !== undefined),
)

function clearFilters() {
  appliedFilters.value = {}
  page.value = 1
  loadCustomers()
}

function applyFilters(filters) {
  appliedFilters.value = filters
  page.value = 1
  loadCustomers()
}

async function loadFilterOptions() {
  try {
    const { data } = await clientService.list({ per_page: 200 })
    clientOptions.value = data
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

async function loadCustomers() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await customerService.list({
      page: page.value,
      per_page: itemsPerPage.value,
      ...buildFilterParams(),
    })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os usuários de clientes.')
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadCustomers()
}

function openCreate() {
  editingCustomer.value = null
  formOpen.value = true
}

function openEdit(customer) {
  editingCustomer.value = customer
  formOpen.value = true
}

function askDelete(customer) {
  customerToDelete.value = customer
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await customerService.remove(customerToDelete.value.id)
    deleteOpen.value = false
    await loadCustomers()

    if (items.value.length === 0 && page.value > 1) {
      page.value -= 1
      await loadCustomers()
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o usuário do cliente.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}

loadFilterOptions()
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Usuários de Clientes</h1>
    <div class="d-flex align-center ga-2">
      <v-btn v-if="hasActiveFilters" variant="text" size="small" prepend-icon="mdi-filter-off" @click="clearFilters">
        Limpar filtros
      </v-btn>
      <v-btn variant="outlined" prepend-icon="mdi-filter-variant" @click="filterModalOpen = true">
        Filtro Avançado
      </v-btn>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Novo usuário de cliente</v-btn>
    </div>
  </div>

  <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
    {{ errorMessage }}
  </v-alert>

  <CustomerAdvancedFilterModal
    v-model="filterModalOpen"
    :filters="appliedFilters"
    :client-options="clientOptions"
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
    <template #item.actions="{ item }">
      <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(item)" />
      <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
    </template>
  </v-data-table-server>

  <CustomerFormModal v-model="formOpen" :customer="editingCustomer" @saved="loadCustomers" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message='`Excluir o usuário "${customerToDelete?.name}"? Essa ação não pode ser desfeita.`'
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
