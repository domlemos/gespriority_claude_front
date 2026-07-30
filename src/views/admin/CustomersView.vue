<script setup>
import { ref } from 'vue'
import CustomerFormModal from '@/components/admin/CustomerFormModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import customerService from '@/services/customerService'
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

async function loadCustomers() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await customerService.list({ page: page.value, per_page: itemsPerPage.value })
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
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Usuários de Clientes</h1>
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Novo usuário de cliente</v-btn>
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
