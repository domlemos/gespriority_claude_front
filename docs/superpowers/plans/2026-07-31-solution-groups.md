# Grupos de Solução Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Grupos de Solução" admin CRUD section to the frontend, matching the existing SLA Policies pattern, and wire it into the User form as a required picker.

**Architecture:** Vue 3 (`<script setup>`) + Vue Router + Pinia + Vuetify SPA. A new `solutionGroupService.js` wraps the already-existing backend endpoint `/grupos-solucao`. A new view + form modal pair follows the exact structure of `SlasView.vue`/`SlaFormModal.vue`. `UserFormModal.vue` and `UsersView.vue` get small additive changes to surface the (now mandatory) `grupo_solucao_id` relationship.

**Tech Stack:** Vue 3, Vue Router, Vuetify (`v-data-table-server`, `v-dialog`), Axios (via `src/services/api.js`).

## Global Constraints

- No test framework is configured in this project (`package.json` only has `dev`/`build`/`preview`). Verification is `npm run build` (catches syntax/import errors) plus manual testing via `npm run dev` — do not attempt to add a test runner as part of this plan.
- API payload/response field names stay in Portuguese snake_case exactly as the backend defines them (`nome`, `ativo`, `grupo_solucao_id`) — no translation/camelCase mapping in payloads.
- All UI copy (labels, titles, messages) is in Portuguese, matching the tone of existing admin screens.
- Follow the existing file/component naming convention: `src/services/<entity>Service.js`, `src/views/admin/<Entity>sView.vue`, `src/components/admin/<Entity>FormModal.vue`.
- Do not add sorting/filtering/search to the table — explicitly out of scope (see spec `docs/superpowers/specs/2026-07-31-solution-groups-design.md`).

---

## File Structure

Create:
- `src/services/solutionGroupService.js` — thin Axios wrapper for `/grupos-solucao` (list/create/update/remove)
- `src/components/admin/SolutionGroupFormModal.vue` — create/edit modal (nome + ativo)
- `src/views/admin/SolutionGroupsView.vue` — paginated table + CRUD actions

Modify:
- `src/router/index.js` — add child route `admin-solution-groups`
- `src/layouts/AdminLayout.vue` — add menu item
- `src/components/admin/UserFormModal.vue` — add required Grupo de Solução select
- `src/views/admin/UsersView.vue` — add Grupo de Solução column

---

### Task 1: `solutionGroupService.js`

**Files:**
- Create: `src/services/solutionGroupService.js`

**Interfaces:**
- Consumes: `api` default export from `src/services/api.js` (already configured Axios instance with base URL + auth interceptor).
- Produces: default export `{ list(params), create(payload), update(id, payload), remove(id) }` — used by Task 2 and Task 3.

- [ ] **Step 1: Create the service file**

```js
import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/grupos-solucao', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/grupos-solucao', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/grupos-solucao/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/grupos-solucao/${id}`)
  },
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds (no import errors). This file has no consumers yet, so it only needs to parse cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/services/solutionGroupService.js
git commit -m "feat: add solution group API service"
```

---

### Task 2: `SolutionGroupFormModal.vue`

**Files:**
- Create: `src/components/admin/SolutionGroupFormModal.vue`
- Test: manual, via Task 3's view (this component has no standalone entry point)

**Interfaces:**
- Consumes: `solutionGroupService` (Task 1) — `create(payload)`, `update(id, payload)`; `extractErrorMessage` from `src/utils/errors.js` (existing, unchanged).
- Produces: component with props `{ modelValue: Boolean, solutionGroup: Object|null }`, emits `update:modelValue`, `saved` — used by Task 3 as `<SolutionGroupFormModal v-model="formOpen" :solution-group="editingSolutionGroup" @saved="..." />`.

- [ ] **Step 1: Create the modal component**

```vue
<script setup>
import { ref, watch } from 'vue'
import solutionGroupService from '@/services/solutionGroupService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  solutionGroup: { type: Object, default: null },
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
    nome.value = props.solutionGroup?.nome ?? ''
    ativo.value = props.solutionGroup?.ativo ?? true
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
    if (props.solutionGroup) {
      await solutionGroupService.update(props.solutionGroup.id, payload)
    } else {
      await solutionGroupService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o grupo de solução.')
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
        {{ solutionGroup ? 'Editar grupo de solução' : 'Novo grupo de solução' }}
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

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/SolutionGroupFormModal.vue
git commit -m "feat: add solution group form modal"
```

---

### Task 3: `SolutionGroupsView.vue`

**Files:**
- Create: `src/views/admin/SolutionGroupsView.vue`

**Interfaces:**
- Consumes: `solutionGroupService` (Task 1); `SolutionGroupFormModal` (Task 2, props `modelValue`/`solutionGroup`, emits `saved`); `ConfirmDeleteDialog` from `src/components/admin/ConfirmDeleteDialog.vue` (existing, props `modelValue`/`message`/`loading`, emits `confirm`); `extractErrorMessage`.
- Produces: default-exported view component, routed as `admin-solution-groups` in Task 4.

- [ ] **Step 1: Create the view component**

```vue
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
```

Note: there is no explicit initial `loadSolutionGroups()` call — `v-data-table-server` fires `@update:options` on mount, which triggers the first load. Adding an explicit call here would double-fetch (this exact mistake was fixed for the other admin views in commit `10d461a`).

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/views/admin/SolutionGroupsView.vue
git commit -m "feat: add solution groups admin view"
```

---

### Task 4: Route and menu item

**Files:**
- Modify: `src/router/index.js:91-95` (inside the `/admin` route's `children` array, right after the `slas` child)
- Modify: `src/layouts/AdminLayout.vue:4-9` (the `items` array)

**Interfaces:**
- Consumes: `SolutionGroupsView.vue` (Task 3), route name `admin-solution-groups`.
- Produces: navigable route `/admin/solution-groups` reachable from the admin sidebar.

- [ ] **Step 1: Add the child route**

In `src/router/index.js`, the `/admin` route's `children` array currently ends with:

```js
      {
        path: 'slas',
        name: 'admin-slas',
        component: () => import('@/views/admin/SlasView.vue'),
      },
    ],
```

Change it to:

```js
      {
        path: 'slas',
        name: 'admin-slas',
        component: () => import('@/views/admin/SlasView.vue'),
      },
      {
        path: 'solution-groups',
        name: 'admin-solution-groups',
        component: () => import('@/views/admin/SolutionGroupsView.vue'),
      },
    ],
```

- [ ] **Step 2: Add the menu item**

In `src/layouts/AdminLayout.vue`, the `items` array currently is:

```js
const items = [
  { title: 'Clientes', icon: 'mdi-domain', to: { name: 'admin-clients' } },
  { title: 'Usuários da Aplicação', icon: 'mdi-account-cog', to: { name: 'admin-users' } },
  { title: 'Usuários de Clientes', icon: 'mdi-account-group', to: { name: 'admin-customers' } },
  { title: 'Políticas de SLA', icon: 'mdi-timer-alert-outline', to: { name: 'admin-slas' } },
]
```

Change it to:

```js
const items = [
  { title: 'Clientes', icon: 'mdi-domain', to: { name: 'admin-clients' } },
  { title: 'Usuários da Aplicação', icon: 'mdi-account-cog', to: { name: 'admin-users' } },
  { title: 'Usuários de Clientes', icon: 'mdi-account-group', to: { name: 'admin-customers' } },
  { title: 'Políticas de SLA', icon: 'mdi-timer-alert-outline', to: { name: 'admin-slas' } },
  { title: 'Grupos de Solução', icon: 'mdi-account-multiple-outline', to: { name: 'admin-solution-groups' } },
]
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, log in as an `admin` user, open `/admin`. Confirm "Grupos de Solução" appears in the sidebar and clicking it navigates to `/admin/solution-groups`, rendering the (currently empty-state) table from Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/router/index.js src/layouts/AdminLayout.vue
git commit -m "feat: wire solution groups route and menu item"
```

---

### Task 5: `UserFormModal.vue` — required Grupo de Solução picker

**Files:**
- Modify: `src/components/admin/UserFormModal.vue`

**Interfaces:**
- Consumes: `solutionGroupService.list(params)` (Task 1), which resolves to `{ data: [{id, nome, ativo, ...}], meta }`.
- Produces: `UserFormModal`'s submit payload now always includes `grupo_solucao_id` (matches the backend's `NOT NULL` requirement on `users.grupo_solucao_id`).

- [ ] **Step 1: Add the import and new refs**

In `src/components/admin/UserFormModal.vue`, replace:

```js
import { ref, watch } from 'vue'
import userService from '@/services/userService'
import roleService from '@/services/roleService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  user: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const name = ref('')
const email = ref('')
const password = ref('')
const roleIds = ref([])
const roleOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

async function loadRoles() {
  const { data } = await roleService.list()
  roleOptions.value = data
}
```

with:

```js
import { ref, watch } from 'vue'
import userService from '@/services/userService'
import roleService from '@/services/roleService'
import solutionGroupService from '@/services/solutionGroupService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  user: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const name = ref('')
const email = ref('')
const password = ref('')
const roleIds = ref([])
const roleOptions = ref([])
const solutionGroupId = ref(null)
const solutionGroupOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

async function loadRoles() {
  const { data } = await roleService.list()
  roleOptions.value = data
}

async function loadSolutionGroups() {
  const { data } = await solutionGroupService.list({ per_page: 200 })
  solutionGroupOptions.value = data
}
```

- [ ] **Step 2: Load and initialize the selected group on open**

Replace:

```js
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    password.value = ''
    name.value = props.user?.name ?? ''
    email.value = props.user?.email ?? ''

    await loadRoles()

    roleIds.value = props.user
      ? roleOptions.value
          .filter((role) => props.user.roles?.includes(role.slug))
          .map((role) => role.id)
      : []
  },
)
```

with:

```js
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    password.value = ''
    name.value = props.user?.name ?? ''
    email.value = props.user?.email ?? ''
    solutionGroupId.value = props.user?.grupo_solucao_id ?? null

    await Promise.all([loadRoles(), loadSolutionGroups()])

    roleIds.value = props.user
      ? roleOptions.value
          .filter((role) => props.user.roles?.includes(role.slug))
          .map((role) => role.id)
      : []
  },
)
```

- [ ] **Step 3: Include the field in the submit payload**

Replace:

```js
  const payload = {
    name: name.value,
    email: email.value,
    role_ids: roleIds.value,
    ...(password.value ? { password: password.value } : {}),
  }
```

with:

```js
  const payload = {
    name: name.value,
    email: email.value,
    role_ids: roleIds.value,
    grupo_solucao_id: solutionGroupId.value,
    ...(password.value ? { password: password.value } : {}),
  }
```

- [ ] **Step 4: Add the select to the template**

Replace:

```html
          <v-select
            v-model="roleIds"
            :items="roleOptions"
            item-title="name"
            item-value="id"
            label="Papéis"
            multiple
            chips
          />
        </v-form>
```

with:

```html
          <v-select
            v-model="roleIds"
            :items="roleOptions"
            item-title="name"
            item-value="id"
            label="Papéis"
            multiple
            chips
            class="mb-2"
          />
          <v-select
            v-model="solutionGroupId"
            :items="solutionGroupOptions"
            item-title="nome"
            item-value="id"
            label="Grupo de Solução"
            required
          />
        </v-form>
```

- [ ] **Step 5: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual check**

Run: `npm run dev`. Open `/admin/users`, click "Novo usuário" — confirm the "Grupo de Solução" select appears and lists the groups created via `/admin/solution-groups`. Create a user selecting a group, then edit that same user and confirm the select shows the previously chosen group pre-filled (not empty).

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/UserFormModal.vue
git commit -m "feat: require solution group selection in user form"
```

---

### Task 6: `UsersView.vue` — show the assigned group

**Files:**
- Modify: `src/views/admin/UsersView.vue`

**Interfaces:**
- Consumes: `item.grupo_solucao` from the list response (`UserResource` already returns `grupo_solucao: {id, nome} | null`, per the backend spec referenced in `docs/superpowers/specs/2026-07-31-solution-groups-design.md`).

- [ ] **Step 1: Add the column header**

Replace:

```js
const headers = [
  { title: 'Nome', key: 'name', sortable: false },
  { title: 'E-mail', key: 'email', sortable: false },
  { title: 'Papéis', key: 'roles', sortable: false },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
]
```

with:

```js
const headers = [
  { title: 'Nome', key: 'name', sortable: false },
  { title: 'E-mail', key: 'email', sortable: false },
  { title: 'Papéis', key: 'roles', sortable: false },
  { title: 'Grupo de Solução', key: 'grupo_solucao', sortable: false },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
]
```

- [ ] **Step 2: Render the column**

Replace:

```html
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
```

with:

```html
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
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `/admin/users`, confirm the "Grupo de Solução" column shows the correct group name for existing users (or "—" if somehow null).

- [ ] **Step 5: Commit**

```bash
git add src/views/admin/UsersView.vue
git commit -m "feat: show assigned solution group in users table"
```

---

### Task 7: End-to-end manual verification

**Files:** none (verification only)

**Interfaces:** none — this task exercises the full feature built in Tasks 1-6 against the live backend.

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: succeeds with no errors across all changed/created files.

- [ ] **Step 2: Solution Groups CRUD**

Run: `npm run dev`, log in as `admin`, go to `/admin/solution-groups`:
- Create a group ("Suporte N1", ativo checked). Confirm it appears in the table with an "Ativo" chip.
- Edit it (rename, uncheck ativo). Confirm the table updates and the chip switches to "Inativo".
- Create a second group to be used in the next step.
- Delete the second group (no users assigned yet) — confirm it disappears from the table.

- [ ] **Step 3: User ↔ Solution Group linkage**

At `/admin/users`:
- Create a new user, selecting the "Suporte N1" group from Step 2. Confirm the table's "Grupo de Solução" column shows "Suporte N1".
- Edit that user and confirm the select is pre-filled with "Suporte N1" (not blank).
- Change it to a different group and save; confirm the table reflects the change.

- [ ] **Step 4: Delete-with-dependents guard**

At `/admin/solution-groups`, attempt to delete "Suporte N1" (which now has the user from Step 3 assigned to it). Confirm the request fails and an error message is shown via the existing `extractErrorMessage` alert (backend returns `409`) — the group must NOT disappear from the table.

- [ ] **Step 5: Access guard**

Log in as a non-admin user (or check `auth.roles`) and confirm `/admin/solution-groups` is not reachable — same redirect behavior already in place for the other `/admin/*` routes (no separate work needed here, this just confirms nothing broke).

No commit for this task — it's verification only. If any step fails, fix the relevant task's code, re-run `npm run build`, and re-verify before moving on.
