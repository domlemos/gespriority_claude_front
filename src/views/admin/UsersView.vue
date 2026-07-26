<script setup>
import { ref, onMounted } from 'vue'
import UserFormModal from '@/components/admin/UserFormModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import userService from '@/services/userService'
import { extractErrorMessage } from '@/utils/errors'

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'E-mail', key: 'email' },
  { title: 'Papéis', key: 'roles', sortable: false },
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

async function loadUsers() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await userService.list({ page: page.value, per_page: itemsPerPage.value })
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

onMounted(loadUsers)
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Usuários da Aplicação</h1>
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Novo usuário</v-btn>
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
