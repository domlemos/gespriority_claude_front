<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CategoryFormModal from '@/components/admin/CategoryFormModal.vue'
import CategoryAdvancedFilterModal from '@/components/admin/CategoryAdvancedFilterModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import categoryService from '@/services/categoryService'
import { extractErrorMessage } from '@/utils/errors'
import ResponsiveDataTable from '@/components/ResponsiveDataTable.vue'

const { t } = useI18n()

const headers = computed(() => [
  { title: t('admin.common.name'), key: 'nome', sortable: false },
  { title: t('admin.common.active'), key: 'ativo', sortable: false },
  { title: t('common.actions'), key: 'actions', sortable: false, align: 'end' },
])

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)

const formOpen = ref(false)
const editingCategory = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const categoryToDelete = ref(null)

const filterModalOpen = ref(false)
const appliedFilters = ref({})

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
  loadCategories()
}

function applyFilters(filters) {
  appliedFilters.value = filters
  page.value = 1
  loadCategories()
}

async function loadCategories() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await categoryService.list({
      page: page.value,
      per_page: itemsPerPage.value,
      ...buildFilterParams(),
    })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('admin.categories.loadError'))
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadCategories()
}

function openCreate() {
  editingCategory.value = null
  formOpen.value = true
}

function openEdit(category) {
  editingCategory.value = category
  formOpen.value = true
}

function askDelete(category) {
  categoryToDelete.value = category
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await categoryService.remove(categoryToDelete.value.id)
    deleteOpen.value = false
    await loadCategories()

    if (items.value.length === 0 && page.value > 1) {
      page.value -= 1
      await loadCategories()
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t('admin.categories.deleteError'))
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
    <h1 class="text-h5 font-weight-bold">{{ $t('admin.categories.title') }}</h1>
    <div class="d-flex flex-wrap align-center ga-2">
      <v-btn v-if="hasActiveFilters" variant="text" size="small" prepend-icon="mdi-filter-off" @click="clearFilters">
        {{ $t('admin.common.clearFilters') }}
      </v-btn>
      <v-btn variant="outlined" prepend-icon="mdi-filter-variant" @click="filterModalOpen = true">
        {{ $t('admin.common.advancedFilter') }}
      </v-btn>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">{{ $t('admin.categories.new') }}</v-btn>
    </div>
  </div>

  <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
    {{ errorMessage }}
  </v-alert>

  <CategoryAdvancedFilterModal
    v-model="filterModalOpen"
    :filters="appliedFilters"
    @apply="applyFilters"
  />

  <ResponsiveDataTable
    :headers="headers"
    :items="items"
    :items-length="totalItems"
    :items-per-page="itemsPerPage"
    :loading="loading"
    @update:options="onOptionsUpdate"
  >
    <template #item.ativo="{ item }">
      <v-chip size="small" :color="item.ativo ? 'success' : 'default'" variant="tonal">
        {{ item.ativo ? $t('admin.common.active') : $t('admin.common.inactive') }}
      </v-chip>
    </template>

    <template #item.actions="{ item }">
      <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(item)" />
      <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
    </template>
  </ResponsiveDataTable>

  <CategoryFormModal v-model="formOpen" :category="editingCategory" @saved="loadCategories" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message="$t('admin.categories.deleteMessage', { name: categoryToDelete?.nome })"
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
