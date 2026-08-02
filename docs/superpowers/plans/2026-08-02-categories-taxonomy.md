# Categorias / Subcategorias / Itens + Menu Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 new admin CRUD sections (Categorias, Subcategorias, Itens) mirroring the existing admin pattern, and regroup the admin sidebar menu into 3 titled sections (Cadastros / Políticas / Categorias).

**Architecture:** Each of the 3 new resources gets a thin Axios service, a create/edit `v-dialog` form modal, and a `v-data-table-server` list view — the exact same 3-file shape already used for Grupos de Solução. Subcategoria and Item each add a required `v-select` picker for their parent (Categoria, Subcategoria respectively), the same shape as the Cliente picker in `CustomerFormModal.vue`. The admin sidebar (`AdminLayout.vue`) is restructured from one flat list into 3 titled groups (`v-list-subheader`), with the 5 existing items redistributed unchanged plus the 3 new ones.

**Tech Stack:** Vue 3 `<script setup>` Composition API, Vue Router, Vuetify 4, Axios. No test framework configured (`package.json` scripts: `dev`/`build`/`preview` only).

## Global Constraints

- API field names are Portuguese snake_case exactly as the backend returns them: `nome`, `ativo`, `categoria_id`, `subcategoria_id`. Never translate or camelCase these in payloads.
- `CategoriaResource`: `{id, nome, ativo, created_at, updated_at}`. `SubcategoriaResource`: `{id, categoria_id, nome, ativo, categoria: {id, nome} | null, created_at, updated_at}`. `ItemResource`: `{id, subcategoria_id, nome, ativo, subcategoria: {id, nome} | null, created_at, updated_at}`.
- Endpoints: `/categorias`, `/subcategorias`, `/itens` — same paginated `{data, links, meta}` shape as every other admin list endpoint.
- Delete guards (backend-enforced, frontend just surfaces the error): deleting a Categoria with linked Subcategorias returns `409`; deleting a Subcategoria with linked Itens returns `409`; deleting an Item has no guard, always `204`.
- All 3 new routes are children of the existing `/admin` route and inherit its `meta: { requiresAuth: true, guard: 'web', requiresAdmin: true }` — no per-route guard needed, same as every existing admin child route.
- `npm run build` requires Node ≥20. The repo's default `node` on PATH is v18.20.8, which fails with `SyntaxError: node:util does not provide an export named 'styleText'`. Node v22.14.0 is available via nvm. Every build verification in this plan must run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`.
- `v-data-table-server`'s `@update:options` fires automatically on mount. Never add a redundant explicit initial load call in a new view — this exact bug was fixed once already in commit `10d461a` for the earlier admin views.
- No automated test framework exists in this repo. Verification is `npm run build` plus manual browser testing — do not write or expect `.test.js` files.
- Error messages use the existing `extractErrorMessage(error, fallback)` from `src/utils/errors.js`, same pattern in every admin view/modal.
- Form field `required` attributes in this codebase are cosmetic only (no `v-form` ref, no `:rules`, no `validate()` call anywhere in `src/`) — this is an established, already-reviewed pattern, not something to "fix" in these new files.

---

## File Structure

- `src/services/categoryService.js` (new) — Axios wrapper for `/categorias`.
- `src/components/admin/CategoryFormModal.vue` (new) — create/edit dialog for Categoria (`nome`, `ativo`).
- `src/views/admin/CategoriesView.vue` (new) — paginated table + CRUD actions for Categoria.
- `src/services/subcategoryService.js` (new) — Axios wrapper for `/subcategorias`.
- `src/components/admin/SubcategoryFormModal.vue` (new) — create/edit dialog for Subcategoria (`nome`, `ativo`, `categoria_id` picker).
- `src/views/admin/SubcategoriesView.vue` (new) — paginated table + CRUD actions for Subcategoria, with a "Categoria" column.
- `src/services/itemService.js` (new) — Axios wrapper for `/itens`.
- `src/components/admin/ItemFormModal.vue` (new) — create/edit dialog for Item (`nome`, `ativo`, `subcategoria_id` picker).
- `src/views/admin/ItemsView.vue` (new) — paginated table + CRUD actions for Item, with a "Subcategoria" column.
- `src/router/index.js` (modify) — add 3 child routes under `/admin`.
- `src/layouts/AdminLayout.vue` (modify) — restructure the flat menu `items` array into 3 titled `menuGroups`.

---

### Task 1: Categoria service + form modal

**Files:**
- Create: `src/services/categoryService.js`
- Create: `src/components/admin/CategoryFormModal.vue`

**Interfaces:**
- Produces: `categoryService.list(params)`, `.create(payload)`, `.update(id, payload)`, `.remove(id)` — same signatures as `solutionGroupService.js`.
- Produces: `<CategoryFormModal v-model="formOpen" :category="editingCategory" @saved="..." />` — `category` prop is the record being edited (or `null` for create), `@saved` fires after a successful create/update.
- Consumes (Task 2): nothing from later tasks.

- [ ] **Step 1: Create the service**

Create `src/services/categoryService.js`:

```js
import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/categorias', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/categorias', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/categorias/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/categorias/${id}`)
  },
}
```

- [ ] **Step 2: Create the form modal**

Create `src/components/admin/CategoryFormModal.vue`:

```vue
<script setup>
import { ref, watch } from 'vue'
import categoryService from '@/services/categoryService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  category: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const nome = ref('')
const ativo = ref(true)
const loading = ref(false)
const errorMessage = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return

    errorMessage.value = ''
    nome.value = props.category?.nome ?? ''
    ativo.value = props.category?.ativo ?? true
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
    ativo: ativo.value,
  }

  try {
    if (props.category) {
      await categoryService.update(props.category.id, payload)
    } else {
      await categoryService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar a categoria.')
  } finally {
    loading.value = false
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
        {{ category ? 'Editar categoria' : 'Nova categoria' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="nome" label="Nome" required autofocus class="mb-2" />

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
```

- [ ] **Step 3: Verify it builds**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/categoryService.js src/components/admin/CategoryFormModal.vue
git commit -m "feat: add category API service and form modal"
```

---

### Task 2: Categorias admin view

**Files:**
- Create: `src/views/admin/CategoriesView.vue`

**Interfaces:**
- Consumes: `categoryService` (Task 1), `CategoryFormModal.vue` (Task 1), `ConfirmDeleteDialog.vue` (existing, `src/components/admin/ConfirmDeleteDialog.vue`).
- Produces: nothing consumed by later tasks (this resource is a leaf for routing purposes — wired up in Task 7).

- [ ] **Step 1: Create the view**

Create `src/views/admin/CategoriesView.vue`:

```vue
<script setup>
import { ref } from 'vue'
import CategoryFormModal from '@/components/admin/CategoryFormModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import categoryService from '@/services/categoryService'
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
const editingCategory = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const categoryToDelete = ref(null)

async function loadCategories() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await categoryService.list({ page: page.value, per_page: itemsPerPage.value })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as categorias.')
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
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir a categoria.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Categorias</h1>
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Nova categoria</v-btn>
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

  <CategoryFormModal v-model="formOpen" :category="editingCategory" @saved="loadCategories" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message='`Excluir a categoria "${categoryToDelete?.nome}"? Essa ação não pode ser desfeita.`'
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
```

- [ ] **Step 2: Verify it builds**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/views/admin/CategoriesView.vue
git commit -m "feat: add categories admin view"
```

---

### Task 3: Subcategoria service + form modal

**Files:**
- Create: `src/services/subcategoryService.js`
- Create: `src/components/admin/SubcategoryFormModal.vue`

**Interfaces:**
- Consumes: `categoryService.list(params)` (Task 1), which resolves to `{ data: [{id, nome, ativo, ...}], meta }`.
- Produces: `subcategoryService.list/create/update/remove` — same signatures as `categoryService`.
- Produces: `<SubcategoryFormModal v-model="formOpen" :subcategory="editingSubcategory" @saved="..." />`.

- [ ] **Step 1: Create the service**

Create `src/services/subcategoryService.js`:

```js
import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/subcategorias', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/subcategorias', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/subcategorias/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/subcategorias/${id}`)
  },
}
```

- [ ] **Step 2: Create the form modal**

Create `src/components/admin/SubcategoryFormModal.vue`:

```vue
<script setup>
import { ref, watch } from 'vue'
import subcategoryService from '@/services/subcategoryService'
import categoryService from '@/services/categoryService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  subcategory: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const nome = ref('')
const ativo = ref(true)
const categoriaId = ref(null)
const categoryOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

async function loadCategories() {
  const { data } = await categoryService.list({ per_page: 200 })
  categoryOptions.value = data
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    nome.value = props.subcategory?.nome ?? ''
    ativo.value = props.subcategory?.ativo ?? true
    categoriaId.value = props.subcategory?.categoria_id ?? props.subcategory?.categoria?.id ?? null
    categoryOptions.value = []

    try {
      await loadCategories()
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as categorias.')
    }
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
    ativo: ativo.value,
    categoria_id: categoriaId.value,
  }

  try {
    if (props.subcategory) {
      await subcategoryService.update(props.subcategory.id, payload)
    } else {
      await subcategoryService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar a subcategoria.')
  } finally {
    loading.value = false
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
        {{ subcategory ? 'Editar subcategoria' : 'Nova subcategoria' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="nome" label="Nome" required autofocus class="mb-2" />

          <v-select
            v-model="categoriaId"
            :items="categoryOptions"
            item-title="nome"
            item-value="id"
            label="Categoria"
            required
            class="mb-2"
          />

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
```

Note: `categoriaId.value` is read from `props.subcategory?.categoria_id` first, falling back to `props.subcategory?.categoria?.id` — the flat FK field is always present per `SubcategoriaResource`, but the fallback protects against relying on a single field path (this exact single-point-of-failure shape was flagged in the Grupos de Solução final review for a different field, in `UserFormModal.vue`).

The `loadCategories()` call is wrapped in try/catch because `categoryOptions.value` and `categoriaId.value` are both reset/set before the `await`, and a load failure must not leave the previous subcategory's stale `categoryOptions` visible — same defensive shape as the fix applied to `UserFormModal.vue` in the Grupos de Solução branch.

- [ ] **Step 3: Verify it builds**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/subcategoryService.js src/components/admin/SubcategoryFormModal.vue
git commit -m "feat: add subcategory API service and form modal"
```

---

### Task 4: Subcategorias admin view

**Files:**
- Create: `src/views/admin/SubcategoriesView.vue`

**Interfaces:**
- Consumes: `subcategoryService` (Task 3), `SubcategoryFormModal.vue` (Task 3), `ConfirmDeleteDialog.vue` (existing).
- Reads `item.categoria?.nome` from each list row (present per `SubcategoriaResource`).

- [ ] **Step 1: Create the view**

Create `src/views/admin/SubcategoriesView.vue`:

```vue
<script setup>
import { ref } from 'vue'
import SubcategoryFormModal from '@/components/admin/SubcategoryFormModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import subcategoryService from '@/services/subcategoryService'
import { extractErrorMessage } from '@/utils/errors'

const headers = [
  { title: 'Nome', key: 'nome', sortable: false },
  { title: 'Categoria', key: 'categoria', sortable: false },
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
const editingSubcategory = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const subcategoryToDelete = ref(null)

async function loadSubcategories() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await subcategoryService.list({ page: page.value, per_page: itemsPerPage.value })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as subcategorias.')
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadSubcategories()
}

function openCreate() {
  editingSubcategory.value = null
  formOpen.value = true
}

function openEdit(subcategory) {
  editingSubcategory.value = subcategory
  formOpen.value = true
}

function askDelete(subcategory) {
  subcategoryToDelete.value = subcategory
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await subcategoryService.remove(subcategoryToDelete.value.id)
    deleteOpen.value = false
    await loadSubcategories()

    if (items.value.length === 0 && page.value > 1) {
      page.value -= 1
      await loadSubcategories()
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir a subcategoria.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Subcategorias</h1>
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Nova subcategoria</v-btn>
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
    <template #item.categoria="{ item }">
      {{ item.categoria?.nome ?? '—' }}
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

  <SubcategoryFormModal v-model="formOpen" :subcategory="editingSubcategory" @saved="loadSubcategories" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message='`Excluir a subcategoria "${subcategoryToDelete?.nome}"? Essa ação não pode ser desfeita.`'
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
```

- [ ] **Step 2: Verify it builds**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/views/admin/SubcategoriesView.vue
git commit -m "feat: add subcategories admin view"
```

---

### Task 5: Item service + form modal

**Files:**
- Create: `src/services/itemService.js`
- Create: `src/components/admin/ItemFormModal.vue`

**Interfaces:**
- Consumes: `subcategoryService.list(params)` (Task 3), which resolves to `{ data: [{id, nome, ativo, categoria_id, categoria: {id, nome} | null, ...}], meta }`.
- Produces: `itemService.list/create/update/remove` — same signatures as `categoryService`.
- Produces: `<ItemFormModal v-model="formOpen" :item="editingItem" @saved="..." />`.

- [ ] **Step 1: Create the service**

Create `src/services/itemService.js`:

```js
import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/itens', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/itens', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/itens/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/itens/${id}`)
  },
}
```

- [ ] **Step 2: Create the form modal**

Create `src/components/admin/ItemFormModal.vue`:

```vue
<script setup>
import { ref, watch } from 'vue'
import itemService from '@/services/itemService'
import subcategoryService from '@/services/subcategoryService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  item: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const nome = ref('')
const ativo = ref(true)
const subcategoriaId = ref(null)
const subcategoryOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

function subcategoryLabel(subcategory) {
  return `${subcategory.categoria?.nome ?? '—'} / ${subcategory.nome}`
}

async function loadSubcategories() {
  const { data } = await subcategoryService.list({ per_page: 200 })
  subcategoryOptions.value = data
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    nome.value = props.item?.nome ?? ''
    ativo.value = props.item?.ativo ?? true
    subcategoriaId.value = props.item?.subcategoria_id ?? props.item?.subcategoria?.id ?? null
    subcategoryOptions.value = []

    try {
      await loadSubcategories()
    } catch (error) {
      errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar as subcategorias.')
    }
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
    ativo: ativo.value,
    subcategoria_id: subcategoriaId.value,
  }

  try {
    if (props.item) {
      await itemService.update(props.item.id, payload)
    } else {
      await itemService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o item.')
  } finally {
    loading.value = false
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
        {{ item ? 'Editar item' : 'Novo item' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="nome" label="Nome" required autofocus class="mb-2" />

          <v-select
            v-model="subcategoriaId"
            :items="subcategoryOptions"
            :item-title="subcategoryLabel"
            item-value="id"
            label="Subcategoria"
            required
            class="mb-2"
          />

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
```

Note: the Subcategoria picker's `item-title` is the function `subcategoryLabel`, rendering `"Categoria / Subcategoria"` (e.g. `"Hardware / Rede"`) instead of just the subcategoria name. Subcategoria names are only unique per-`categoria_id` (`unique(categoria_id, nome)` in the DB), so two different categorias can have subcategorias with the same name — a plain `item-title="nome"` would show duplicate, indistinguishable options in this picker. `subcategoryService.list()` already returns `categoria` eager-loaded on every row, so no extra request is needed.

- [ ] **Step 3: Verify it builds**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/itemService.js src/components/admin/ItemFormModal.vue
git commit -m "feat: add item API service and form modal"
```

---

### Task 6: Itens admin view

**Files:**
- Create: `src/views/admin/ItemsView.vue`

**Interfaces:**
- Consumes: `itemService` (Task 5), `ItemFormModal.vue` (Task 5), `ConfirmDeleteDialog.vue` (existing).
- Reads `item.subcategoria?.nome` from each list row (present per `ItemResource`).

- [ ] **Step 1: Create the view**

Create `src/views/admin/ItemsView.vue`:

```vue
<script setup>
import { ref } from 'vue'
import ItemFormModal from '@/components/admin/ItemFormModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import itemService from '@/services/itemService'
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

async function loadItems() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await itemService.list({ page: page.value, per_page: itemsPerPage.value })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os itens.')
  } finally {
    loading.value = false
  }
}

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
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Novo item</v-btn>
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
```

- [ ] **Step 2: Verify it builds**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/views/admin/ItemsView.vue
git commit -m "feat: add items admin view"
```

---

### Task 7: Routes and 3-section menu regroup

**Files:**
- Modify: `src/router/index.js` (the `/admin` route's `children` array, right after the `solution-groups` child)
- Modify: `src/layouts/AdminLayout.vue` (full-file rewrite — the `items` array becomes `menuGroups`, and the template groups by section)

**Interfaces:**
- Consumes: `CategoriesView.vue` (Task 2), `SubcategoriesView.vue` (Task 4), `ItemsView.vue` (Task 6) — route names `admin-categories`, `admin-subcategories`, `admin-items`.
- Produces: navigable routes `/admin/categories`, `/admin/subcategories`, `/admin/items`, reachable from the admin sidebar under a "Categorias" section title.

- [ ] **Step 1: Add the 3 child routes**

In `src/router/index.js`, the `/admin` route's `children` array currently ends with:

```js
      {
        path: 'solution-groups',
        name: 'admin-solution-groups',
        component: () => import('@/views/admin/SolutionGroupsView.vue'),
      },
    ],
```

Change it to:

```js
      {
        path: 'solution-groups',
        name: 'admin-solution-groups',
        component: () => import('@/views/admin/SolutionGroupsView.vue'),
      },
      {
        path: 'categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/CategoriesView.vue'),
      },
      {
        path: 'subcategories',
        name: 'admin-subcategories',
        component: () => import('@/views/admin/SubcategoriesView.vue'),
      },
      {
        path: 'items',
        name: 'admin-items',
        component: () => import('@/views/admin/ItemsView.vue'),
      },
    ],
```

- [ ] **Step 2: Regroup the sidebar menu into 3 titled sections**

Replace the entire contents of `src/layouts/AdminLayout.vue` with:

```vue
<script setup>
import AppLayout from '@/layouts/AppLayout.vue'

const menuGroups = [
  {
    title: 'Cadastros',
    items: [
      { title: 'Clientes', icon: 'mdi-domain', to: { name: 'admin-clients' } },
      { title: 'Usuários da Aplicação', icon: 'mdi-account-cog', to: { name: 'admin-users' } },
      { title: 'Usuários de Clientes', icon: 'mdi-account-group', to: { name: 'admin-customers' } },
    ],
  },
  {
    title: 'Políticas',
    items: [
      { title: 'Políticas de SLA', icon: 'mdi-timer-alert-outline', to: { name: 'admin-slas' } },
      { title: 'Grupos de Solução', icon: 'mdi-account-multiple-outline', to: { name: 'admin-solution-groups' } },
    ],
  },
  {
    title: 'Categorias',
    items: [
      { title: 'Categorias', icon: 'mdi-shape-outline', to: { name: 'admin-categories' } },
      { title: 'Subcategorias', icon: 'mdi-shape-plus-outline', to: { name: 'admin-subcategories' } },
      { title: 'Itens', icon: 'mdi-tag-outline', to: { name: 'admin-items' } },
    ],
  },
]
</script>

<template>
  <AppLayout>
    <template #drawer>
      <v-list nav density="compact">
        <template v-for="group in menuGroups" :key="group.title">
          <v-list-subheader>{{ group.title }}</v-list-subheader>
          <v-list-item
            v-for="item in group.items"
            :key="item.title"
            :to="item.to"
            :prepend-icon="item.icon"
            :title="item.title"
          />
        </template>
      </v-list>
    </template>

    <router-view />
  </AppLayout>
</template>
```

Every existing menu item (`title`, `icon`, `to`) is unchanged — only regrouped under a section title and nested one level under `menuGroups[].items` instead of a flat top-level array.

- [ ] **Step 3: Verify it builds**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, log in as an `admin` user, open `/admin`. Confirm the sidebar shows 3 section titles — "Cadastros", "Políticas", "Categorias" — with all 8 items visible (3 + 2 + 3) and none missing or duplicated. Click "Categorias", "Subcategorias", and "Itens" and confirm each navigates to its route and renders the (currently empty-state) table from Tasks 2/4/6.

- [ ] **Step 5: Commit**

```bash
git add src/router/index.js src/layouts/AdminLayout.vue
git commit -m "feat: wire categories/subcategories/items routes and regroup admin menu"
```

---

### Task 8: End-to-end manual verification

**Files:** none (verification only)

**Interfaces:** none — this task exercises the full feature built in Tasks 1-7 against the live backend.

- [ ] **Step 1: Full build check**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: succeeds with no errors across all changed/created files.

- [ ] **Step 2: Categorias CRUD**

Run: `npm run dev`, log in as `admin`, go to `/admin/categories`:
- Create a category ("Hardware", ativo checked). Confirm it appears in the table with an "Ativo" chip.
- Edit it (rename, uncheck ativo, re-check ativo). Confirm the table updates.
- Create a second category ("Software") to be used in Step 3.

- [ ] **Step 3: Subcategorias CRUD and Categoria picker**

At `/admin/subcategories`:
- Create a subcategory ("Rede", categoria "Hardware"). Confirm the table's "Categoria" column shows "Hardware".
- Edit it and confirm the Categoria select is pre-filled with "Hardware" (not blank), then change it to "Software" and save; confirm the table reflects the change.
- Create a second subcategory ("Instalação", categoria "Software") to be used in Step 4.

- [ ] **Step 4: Itens CRUD and Subcategoria picker**

At `/admin/items`:
- Open "Novo item" and confirm the Subcategoria picker shows options in the "Categoria / Subcategoria" format (e.g. "Software / Instalação"), not just the bare subcategory name.
- Create an item ("Impressora", subcategoria "Software / Instalação"). Confirm the table's "Subcategoria" column shows "Instalação".
- Edit it and confirm the picker is pre-filled correctly, then save without changes; confirm no error.

- [ ] **Step 5: Delete-with-dependents guards**

At `/admin/subcategories`, attempt to delete "Instalação" (which now has the item from Step 4). Confirm the request fails, an error message is shown via the `extractErrorMessage` alert (backend `409`), and the subcategory does NOT disappear from the table.

At `/admin/categories`, attempt to delete "Software" (which now has the subcategory "Instalação"). Confirm the same `409` behavior — the category must NOT disappear.

At `/admin/items`, delete "Impressora" (no dependents). Confirm it deletes successfully (`204`) and disappears from the table.

Then delete "Instalação" (its only item is now gone) — confirm it succeeds. Then delete "Software" (its only subcategory is now gone) — confirm it succeeds.

- [ ] **Step 6: Menu and navigation**

Confirm the sidebar shows exactly 3 section titles ("Cadastros", "Políticas", "Categorias") with all 8 items, and that every item still navigates correctly — including the 5 pre-existing ones (Clientes, Usuários da Aplicação, Usuários de Clientes, Políticas de SLA, Grupos de Solução), to confirm the menu regroup in Task 7 didn't break any existing route.

- [ ] **Step 7: Access guard**

Confirm `/admin/categories`, `/admin/subcategories`, and `/admin/items` are unreachable for a non-admin user — same redirect behavior already in place for the other `/admin/*` routes (no separate frontend work needed here; this just confirms the shared `requiresAdmin` guard on the parent `/admin` route still covers the new children).

No commit for this task — it's verification only. If any step fails, fix the relevant task's code, re-run the build, and re-verify before moving on.
