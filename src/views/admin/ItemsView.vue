<script setup>
import { computed, ref } from 'vue'
import ItemFormModal from '@/components/admin/ItemFormModal.vue'
import ItemAdvancedFilterModal from '@/components/admin/ItemAdvancedFilterModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import itemService from '@/services/itemService'
import categoryService from '@/services/categoryService'
import subcategoryService from '@/services/subcategoryService'
import { extractErrorMessage } from '@/utils/errors'

const headers = [
  { title: 'Nome', key: 'nome', sortable: false },
  { title: 'Subcategoria', key: 'subcategoria', sortable: false },
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
const editingItem = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const itemToDelete = ref(null)

const filterModalOpen = ref(false)
const appliedFilters = ref({})
const categoryOptions = ref([])
const subcategoryOptions = ref([])

const hasActiveFilters = computed(() =>
  Object.values(appliedFilters.value).some((value) => value !== null && value !== undefined),
)

function buildFilterParams() {
  const params = {}
  for (const [key, value] of Object.entries(appliedFilters.value)) {
    if (value !== null && value !== undefined) params[key] = value
  }
  return params
}

function clearFilters() {
  appliedFilters.value = {}
  page.value = 1
  loadItems()
}

function applyFilters(filters) {
  appliedFilters.value = filters
  page.value = 1
  loadItems()
}

async function loadFilterOptions() {
  try {
    const [categories, subcategories] = await Promise.all([
      categoryService.list({ per_page: 200 }),
      subcategoryService.list({ per_page: 200 }),
    ])
    categoryOptions.value = categories.data
    subcategoryOptions.value = subcategories.data
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as opções de filtro.')
  }
}

async function loadItems() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await itemService.list({
      page: page.value,
      per_page: itemsPerPage.value,
      ...buildFilterParams(),
    })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os itens.')
  } finally {
    loading.value = false
  }
}

loadFilterOptions()

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadItems()
}

function openCreate() {
  editingItem.value = null
  formOpen.value = true
}

function openEdit(item) {
  editingItem.value = item
  formOpen.value = true
}

function askDelete(item) {
  itemToDelete.value = item
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await itemService.remove(itemToDelete.value.id)
    deleteOpen.value = false
    await loadItems()

    if (items.value.length === 0 && page.value > 1) {
      page.value -= 1
      await loadItems()
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o item.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Itens</h1>
    <div class="d-flex align-center ga-2">
      <v-btn v-if="hasActiveFilters" variant="text" size="small" prepend-icon="mdi-filter-off" @click="clearFilters">
        Limpar filtros
      </v-btn>
      <v-btn variant="outlined" prepend-icon="mdi-filter-variant" @click="filterModalOpen = true">
        Filtro Avançado
      </v-btn>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Novo item</v-btn>
    </div>
  </div>

  <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
    {{ errorMessage }}
  </v-alert>

  <ItemAdvancedFilterModal
    v-model="filterModalOpen"
    :filters="appliedFilters"
    :category-options="categoryOptions"
    :subcategory-options="subcategoryOptions"
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
    <template #item.subcategoria="{ item }">
      {{ item.subcategoria?.nome ?? '—' }}
    </template>

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

  <ItemFormModal v-model="formOpen" :item="editingItem" @saved="loadItems" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message='`Excluir o item "${itemToDelete?.nome}"? Essa ação não pode ser desfeita.`'
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
