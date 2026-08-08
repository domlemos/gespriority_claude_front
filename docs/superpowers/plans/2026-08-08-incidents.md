# Interface de Incidentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a interface completa de incidentes (chamados) no admin SPA: dashboard pós-login com listagem clicável, e telas de criação/edição em página cheia com layout 50/50 (dados cadastrais à esquerda, feed de descrições estilo SysAid à direita).

**Architecture:** Segue o padrão já estabelecido no projeto (`Service.js` fino sobre Axios + `View.vue`/`Component.vue` em Vuetify), mas introduz duas novidades: (1) o primeiro CRUD do projeto que usa página cheia em vez de modal para criar/editar, porque o layout 50/50 com feed não cabe num `v-dialog`; (2) um pequeno patch cirúrgico no backend Laravel (repo irmão) para expor um campo que faltava no recurso de dashboard.

**Tech Stack:** Vue 3 (`<script setup>`), Vue Router 5, Pinia, Vuetify 4, Axios — frontend. Laravel 12 (PHP 8.3) — backend, só o patch do Task 1.

## Global Constraints

- Node do PATH é v18 e falha o build (`node:util` sem `styleText`). Todo comando de build deve usar: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`.
- Sem framework de teste automatizado no frontend — verificação de cada task frontend é `npm run build` limpo + leitura de código pelo revisor (mesmo padrão das features anteriores).
- O backend vive num repositório git **separado**: `/home/daniel/Workspace/gespriority_claude`. O Task 1 modifica arquivos lá — usar `git -C /home/daniel/Workspace/gespriority_claude` para todo comando git desse task (não faz commit no repo do frontend). O workspace/ledger do SDD continua no repo do frontend.
- Testes do backend rodam com `php artisan test --filter=<Nome>` a partir de `/home/daniel/Workspace/gespriority_claude` — `phpunit.xml` já força SQLite em memória (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`), seguro rodar sem risco ao Postgres de dev.
- Todos os textos de interface em português (pt-BR), mesmo padrão de todas as telas existentes.
- Nomenclatura de campos da API é sempre `snake_case` (`customer_id`, `grupo_solucao_id`, etc.); variáveis Vue internas usam `camelCase` (`customerId`, `grupoSolucaoId`), convertido no payload de envio — mesmo padrão já usado em `SubcategoryFormModal.vue`/`ItemFormModal.vue`.
- Erros de rede sempre exibidos via `extractErrorMessage()` (`src/utils/errors.js`) num `v-alert type="error" variant="tonal" density="comfortable"` — nunca `alert()`/`console.error` como única sinalização.
- Pickers de listas-pai carregam com `per_page: 200` e resetam o array de opções para `[]` **antes** do `await`, dentro de um `try/catch` próprio — padrão consolidado desde a revisão final da feature de Grupos de Solução (evita estado cruzado entre registros num componente que fica permanentemente montado).
- Gating de permissão (`tickets.view`/`tickets.manage`) é sempre inline via `auth.hasPermission(slug)` — sem guard novo no `router/index.js`.

---

### Task 1: Backend — adicionar `titulo` ao `IncidenteDashboardResource`

**Files:**
- Modify: `/home/daniel/Workspace/gespriority_claude/app/Http/Resources/IncidenteDashboardResource.php`
- Modify: `/home/daniel/Workspace/gespriority_claude/tests/Feature/Dashboard/IncidentesDashboardTest.php`

**Interfaces:**
- Consumes: nada de outro task.
- Produces: o payload de `GET /dashboard/incidentes` passa a incluir a chave `titulo` (string, valor de `Incidente.titulo`) em cada item de `data[]`. O `DashboardView.vue` (Task 7) depende deste campo existir na resposta.

- [ ] **Step 1: Adicionar o campo ao resource**

Editar `/home/daniel/Workspace/gespriority_claude/app/Http/Resources/IncidenteDashboardResource.php` — inserir `'titulo' => $this->titulo,` logo após `'numero' => $this->id,`:

```php
        return [
            'numero' => $this->id,
            'titulo' => $this->titulo,
            'origem' => $this->origem,
            'status' => $this->status,
            'prioridade' => $this->prioridade,
            'cliente' => $this->customer?->client?->name,
            'email_cliente' => $this->customer?->email,
            'tempo_resposta_minutos' => $politica?->tempo_resposta_minutos,
            'tempo_resposta_horas' => $politica ? round($politica->tempo_resposta_minutos / 60, 2) : null,
            'tempo_resolucao_minutos' => $politica?->tempo_resolucao_minutos,
            'tempo_resolucao_horas' => $politica ? round($politica->tempo_resolucao_minutos / 60, 2) : null,
            'categoria' => $this->item?->subcategoria?->categoria?->nome,
            'subcategoria' => $this->item?->subcategoria?->nome,
            'item' => $this->item?->nome,
        ];
```

- [ ] **Step 2: Atualizar o teste que verifica o shape completo**

Em `/home/daniel/Workspace/gespriority_claude/tests/Feature/Dashboard/IncidentesDashboardTest.php`, o método `test_dashboard_returns_flattened_incidente_information` cria o incidente sem `titulo` explícito (usa o default da factory) e depois compara o JSON inteiro com `assertJsonPath('data.0', [...])`. Ajustar para fixar o `titulo` na criação e incluir a chave na asserção:

```php
        $incidente = Incidente::factory()->create([
            'customer_id' => $customer->id,
            'item_id' => $item->id,
            'titulo' => 'Impressora não liga',
            'prioridade' => 'alta',
            'origem' => 'portal',
            'status' => 'em_andamento',
        ]);
        $token = $this->staffToken(['tickets.view']);

        $response = $this->getJson('/api/dashboard/incidentes', $this->authHeader($token));

        $response->assertOk()->assertJsonPath('data.0', [
            'numero' => $incidente->id,
            'titulo' => 'Impressora não liga',
            'origem' => 'portal',
            'status' => 'em_andamento',
            'prioridade' => 'alta',
            'cliente' => 'Acme Corp',
            'email_cliente' => 'joao@acme.com',
            'tempo_resposta_minutos' => 90,
            'tempo_resposta_horas' => 1.5,
            'tempo_resolucao_minutos' => 300,
            'tempo_resolucao_horas' => 5,
            'categoria' => 'Hardware',
            'subcategoria' => 'Impressora',
            'item' => 'Sem toner',
        ]);
```

Os outros 5 métodos de teste do arquivo não citam `titulo` explicitamente (usam `assertJsonPath` em chaves específicas, não o objeto inteiro) — não precisam de mudança.

- [ ] **Step 3: Rodar a suíte do dashboard**

Run: `cd /home/daniel/Workspace/gespriority_claude && php artisan test --filter=IncidentesDashboardTest`
Expected: todos os 7 testes passam (`OK (7 tests, ...)`).

- [ ] **Step 4: Rodar a suíte completa de Incidentes para garantir que nada mais quebrou**

Run: `cd /home/daniel/Workspace/gespriority_claude && php artisan test --filter=Incidente`
Expected: `OK`, sem falhas (cobre `IncidenteCrudTest` e `IncidenteDescricaoCrudTest`, que não tocam o dashboard resource, mas confirmam que o `Incidente` model/factory não foi afetado).

- [ ] **Step 5: Commit no repositório do backend**

```bash
git -C /home/daniel/Workspace/gespriority_claude add app/Http/Resources/IncidenteDashboardResource.php tests/Feature/Dashboard/IncidentesDashboardTest.php
git -C /home/daniel/Workspace/gespriority_claude commit -m "feat: expose titulo in incident dashboard resource"
```

---

### Task 2: Frontend — utilitários compartilhados (`text.js`, `incidentLabels.js`)

**Files:**
- Create: `src/utils/text.js`
- Create: `src/utils/incidentLabels.js`
- Modify: `src/layouts/AppLayout.vue`

**Interfaces:**
- Produces: `initials(name: string | null | undefined): string` exportado de `src/utils/text.js`. `PRIORIDADE_LABELS`, `PRIORIDADE_COLORS`, `STATUS_LABELS`, `STATUS_COLORS`, `ORIGEM_LABELS` exportados de `src/utils/incidentLabels.js` (todos objetos simples `{ [chaveDoBackend]: string }`).
- Consumidores: `IncidentFeed.vue` (Task 4) usa `initials`; `DashboardView.vue` (Task 7) e `IncidentFormView.vue` (Task 5) usam os mapas de `incidentLabels.js`.

- [ ] **Step 1: Criar `src/utils/text.js`**

```js
export function initials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
```

- [ ] **Step 2: Extrair `initials` de `AppLayout.vue` para usar a versão compartilhada**

Ler `src/layouts/AppLayout.vue` antes de editar. Remover a função `initials` local (linhas 10-19 na versão atual) e importar a compartilhada:

```js
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { initials } from '@/utils/text'

const auth = useAuthStore()
const router = useRouter()
const loggingOut = ref(false)

async function handleLogout(all = false) {
```

(Restante do arquivo permanece idêntico — só a função `initials` sai daqui e o `import` é adicionado; o uso `{{ initials(auth.user?.name) }}` no template não muda.)

- [ ] **Step 3: Criar `src/utils/incidentLabels.js`**

```js
export const PRIORIDADE_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const PRIORIDADE_COLORS = {
  baixa: 'secondary',
  media: 'info',
  alta: 'warning',
  urgente: 'error',
}

export const STATUS_LABELS = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  pendente: 'Pendente',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
  cancelado: 'Cancelado',
}

export const STATUS_COLORS = {
  aberto: 'info',
  em_andamento: 'primary',
  pendente: 'warning',
  resolvido: 'success',
  fechado: 'default',
  cancelado: 'error',
}

export const ORIGEM_LABELS = {
  portal: 'Portal',
  email: 'E-mail',
  telefone: 'Telefone',
  chat: 'Chat',
  presencial: 'Presencial',
  monitoramento: 'Monitoramento',
}
```

- [ ] **Step 4: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: build completa sem erros.

- [ ] **Step 5: Verificação manual rápida**

Rodar `npm run dev` (com Node 22.14.0), logar como staff, abrir o menu do avatar no canto superior direito — as iniciais do usuário devem continuar aparecendo no avatar, exatamente como antes (confirma que a extração para `text.js` não quebrou o `AppLayout.vue`).

- [ ] **Step 6: Commit**

```bash
git add src/utils/text.js src/utils/incidentLabels.js src/layouts/AppLayout.vue
git commit -m "refactor: extract initials helper and add incident label/color maps"
```

---

### Task 3: Frontend — serviços de Incidente e Feed

**Files:**
- Create: `src/services/incidentService.js`
- Create: `src/services/incidentDescriptionService.js`

**Interfaces:**
- Consumes: `src/services/api.js` (`api` — instância Axios já configurada, existente).
- Produces:
  - `incidentService.list(params)` → `Promise<{data, links, meta}>` (`GET /incidentes`).
  - `incidentService.dashboard(params)` → `Promise<{data, links, meta}>` (`GET /dashboard/incidentes`).
  - `incidentService.get(id)` → `Promise<Incidente>` (objeto já desembrulhado, `GET /incidentes/{id}`).
  - `incidentService.create(payload)` → `Promise<Incidente>` (`POST /incidentes`).
  - `incidentService.update(id, payload)` → `Promise<Incidente>` (`PUT /incidentes/{id}`).
  - `incidentDescriptionService.list(incidentId, params)` → `Promise<{data, links, meta}>` (`GET /incidentes/{id}/descricoes`).
  - `incidentDescriptionService.create(incidentId, payload)` → `Promise<IncidenteDescricao>` (objeto desembrulhado, `POST .../descricoes`).
  - `incidentDescriptionService.update(incidentId, descriptionId, payload)` → `Promise<IncidenteDescricao>` (`PUT .../descricoes/{id}`).
  - `incidentDescriptionService.remove(incidentId, descriptionId)` → `Promise<void>` (`DELETE .../descricoes/{id}`).
  - Usados por: `IncidentFeed.vue` (Task 4), `IncidentFormView.vue` (Task 5), `DashboardView.vue` (Task 7).

- [ ] **Step 1: Criar `src/services/incidentService.js`**

```js
import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/incidentes', { params }).then((res) => res.data)
  },
  dashboard(params = {}) {
    return api.get('/dashboard/incidentes', { params }).then((res) => res.data)
  },
  get(id) {
    return api.get(`/incidentes/${id}`).then((res) => res.data.data)
  },
  create(payload) {
    return api.post('/incidentes', payload).then((res) => res.data.data)
  },
  update(id, payload) {
    return api.put(`/incidentes/${id}`, payload).then((res) => res.data.data)
  },
}
```

- [ ] **Step 2: Criar `src/services/incidentDescriptionService.js`**

```js
import api from '@/services/api'

export default {
  list(incidentId, params = {}) {
    return api
      .get(`/incidentes/${incidentId}/descricoes`, { params })
      .then((res) => res.data)
  },
  create(incidentId, payload) {
    return api
      .post(`/incidentes/${incidentId}/descricoes`, payload)
      .then((res) => res.data.data)
  },
  update(incidentId, descriptionId, payload) {
    return api
      .put(`/incidentes/${incidentId}/descricoes/${descriptionId}`, payload)
      .then((res) => res.data.data)
  },
  remove(incidentId, descriptionId) {
    return api.delete(`/incidentes/${incidentId}/descricoes/${descriptionId}`)
  },
}
```

- [ ] **Step 3: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: build completa sem erros (os dois arquivos ainda não são importados por nenhuma tela, então nem entram no bundle — só confirma que não há erro de sintaxe).

- [ ] **Step 4: Commit**

```bash
git add src/services/incidentService.js src/services/incidentDescriptionService.js
git commit -m "feat: add incident and incident description services"
```

---

### Task 4: Frontend — componente de feed (`IncidentFeed.vue`)

**Files:**
- Create: `src/components/IncidentFeed.vue`

**Interfaces:**
- Consumes: `incidentDescriptionService` (Task 3), `initials` de `src/utils/text.js` (Task 2), `extractErrorMessage` de `src/utils/errors.js` (existente), `useAuthStore` (existente), `ConfirmDeleteDialog.vue` (existente, `src/components/admin/ConfirmDeleteDialog.vue`).
- Produces: componente `<IncidentFeed :incident-id="id" />` — prop única `incidentId` (`String | Number`, obrigatória). Sem `emits`. Consumido por `IncidentFormView.vue` (Task 5).

- [ ] **Step 1: Criar `src/components/IncidentFeed.vue`**

```vue
<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import incidentDescriptionService from '@/services/incidentDescriptionService'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import { initials } from '@/utils/text'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  incidentId: { type: [String, Number], required: true },
})

const auth = useAuthStore()

const entries = ref([])
const loading = ref(false)
const errorMessage = ref('')
const feedBody = ref(null)

const newComment = ref('')
const posting = ref(false)

const editingId = ref(null)
const editText = ref('')
const savingEdit = ref(false)

const deleteOpen = ref(false)
const deleting = ref(false)
const entryToDelete = ref(null)

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('pt-BR')
}

function isOwnComment(entry) {
  return entry.tipo === 'comentario' && entry.user?.id === auth.user?.id
}

function scrollToBottom() {
  if (feedBody.value) {
    feedBody.value.scrollTop = feedBody.value.scrollHeight
  }
}

async function loadFeed() {
  loading.value = true
  errorMessage.value = ''
  entries.value = []

  try {
    const { data } = await incidentDescriptionService.list(props.incidentId, { per_page: 100 })
    entries.value = [...data].reverse()
    await nextTick()
    scrollToBottom()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar o feed do incidente.')
  } finally {
    loading.value = false
  }
}

async function submitComment() {
  if (!newComment.value.trim()) return

  posting.value = true
  errorMessage.value = ''

  try {
    const created = await incidentDescriptionService.create(props.incidentId, {
      descricao: newComment.value,
    })
    entries.value.push(created)
    newComment.value = ''
    await nextTick()
    scrollToBottom()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível adicionar o comentário.')
  } finally {
    posting.value = false
  }
}

function startEdit(entry) {
  editingId.value = entry.id
  editText.value = entry.descricao
}

function cancelEdit() {
  editingId.value = null
  editText.value = ''
}

async function saveEdit(entry) {
  if (!editText.value.trim()) return

  savingEdit.value = true
  errorMessage.value = ''

  try {
    const updated = await incidentDescriptionService.update(props.incidentId, entry.id, {
      descricao: editText.value,
    })
    const index = entries.value.findIndex((item) => item.id === entry.id)
    if (index !== -1) entries.value[index] = updated
    cancelEdit()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível editar o comentário.')
  } finally {
    savingEdit.value = false
  }
}

function askDelete(entry) {
  entryToDelete.value = entry
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await incidentDescriptionService.remove(props.incidentId, entryToDelete.value.id)
    entries.value = entries.value.filter((item) => item.id !== entryToDelete.value.id)
    deleteOpen.value = false
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o comentário.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}

onMounted(loadFeed)
</script>

<template>
  <v-card variant="outlined" class="d-flex flex-column" style="height: 640px">
    <v-card-title class="text-subtitle-1 font-weight-bold">Feed do incidente</v-card-title>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mx-4 mb-2">
      {{ errorMessage }}
    </v-alert>

    <div ref="feedBody" class="flex-grow-1 overflow-y-auto pa-4 pt-0">
      <div v-if="loading" class="d-flex justify-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="!entries.length" class="text-body-2 text-medium-emphasis text-center py-8">
        Nenhuma entrada no feed ainda.
      </div>

      <template v-for="entry in entries" :key="entry.id">
        <div v-if="entry.tipo === 'escalonamento'" class="d-flex justify-center my-3">
          <v-chip size="small" variant="tonal" color="default">
            {{ entry.descricao }} — {{ formatDateTime(entry.created_at) }}
          </v-chip>
        </div>

        <div v-else class="d-flex mb-4">
          <v-avatar color="primary" size="36" class="mr-3">
            <span class="text-caption font-weight-bold">{{ initials(entry.user?.name) }}</span>
          </v-avatar>

          <div class="flex-grow-1">
            <div class="d-flex align-center">
              <span class="font-weight-bold text-body-2 mr-2">{{ entry.user?.name }}</span>
              <span class="text-caption text-medium-emphasis">{{ formatDateTime(entry.created_at) }}</span>

              <v-spacer />

              <template v-if="isOwnComment(entry) && editingId !== entry.id">
                <v-btn icon="mdi-pencil" variant="text" size="x-small" @click="startEdit(entry)" />
                <v-btn icon="mdi-delete" variant="text" size="x-small" color="error" @click="askDelete(entry)" />
              </template>
            </div>

            <div v-if="editingId === entry.id">
              <v-textarea v-model="editText" auto-grow rows="2" density="compact" hide-details class="mt-1" />
              <div class="d-flex justify-end mt-1">
                <v-btn variant="text" size="small" @click="cancelEdit">Cancelar</v-btn>
                <v-btn color="primary" size="small" :loading="savingEdit" @click="saveEdit(entry)">Salvar</v-btn>
              </div>
            </div>

            <div v-else class="text-body-2" style="white-space: pre-wrap">{{ entry.descricao }}</div>
          </div>
        </div>
      </template>
    </div>

    <v-card-actions v-if="auth.hasPermission('tickets.manage')" class="flex-column align-stretch pa-4 pt-0">
      <v-textarea
        v-model="newComment"
        label="Adicionar comentário"
        auto-grow
        rows="2"
        density="compact"
        hide-details
        class="mb-2"
      />
      <v-btn color="primary" block :loading="posting" :disabled="!newComment.trim()" @click="submitComment">
        Comentar
      </v-btn>
    </v-card-actions>
  </v-card>

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    message="Excluir este comentário? Essa ação não pode ser desfeita."
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
```

- [ ] **Step 2: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: build completa sem erros (componente ainda não é importado por nenhuma view — build só valida sintaxe/template).

- [ ] **Step 3: Commit**

```bash
git add src/components/IncidentFeed.vue
git commit -m "feat: add incident feed component"
```

---

### Task 5: Frontend — tela de criação/edição (`IncidentFormView.vue`)

**Files:**
- Create: `src/views/IncidentFormView.vue`

**Interfaces:**
- Consumes: `incidentService` (Task 3), `IncidentFeed.vue` (Task 4), `PRIORIDADE_LABELS`/`ORIGEM_LABELS`/`STATUS_LABELS` de `src/utils/incidentLabels.js` (Task 2), `extractErrorMessage`, `useAuthStore`, e os services já existentes `customerService`, `categoryService`, `subcategoryService`, `itemService`, `solutionGroupService`, `userService`.
- Produces: componente de rota com prop `id` (`String | Number`, default `null` — `null` = modo criação). Consumido pelo router (Task 6) nas rotas `incident-new` (sem prop `id`) e `incident-edit` (com `:id` da URL via `props: true`).

- [ ] **Step 1: Criar `src/views/IncidentFormView.vue`**

```vue
<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import IncidentFeed from '@/components/IncidentFeed.vue'
import incidentService from '@/services/incidentService'
import customerService from '@/services/customerService'
import categoryService from '@/services/categoryService'
import subcategoryService from '@/services/subcategoryService'
import itemService from '@/services/itemService'
import solutionGroupService from '@/services/solutionGroupService'
import userService from '@/services/userService'
import { useAuthStore } from '@/stores/auth'
import { extractErrorMessage } from '@/utils/errors'
import { PRIORIDADE_LABELS, ORIGEM_LABELS, STATUS_LABELS } from '@/utils/incidentLabels'

const props = defineProps({
  id: { type: [String, Number], default: null },
})

const router = useRouter()
const auth = useAuthStore()

const isEditing = computed(() => props.id !== null)
const canManage = computed(() => auth.hasPermission('tickets.manage'))

const priorityOptions = Object.entries(PRIORIDADE_LABELS).map(([value, title]) => ({ value, title }))
const originOptions = Object.entries(ORIGEM_LABELS).map(([value, title]) => ({ value, title }))
const statusOptions = Object.entries(STATUS_LABELS).map(([value, title]) => ({ value, title }))

const loading = ref(false)
const loadFailed = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const initializing = ref(true)

const customerId = ref(null)
const titulo = ref('')
const prioridade = ref(null)
const origem = ref(null)
const status = ref(null)
const categoriaId = ref(null)
const subcategoriaId = ref(null)
const itemId = ref(null)
const grupoSolucaoId = ref(null)
const responsavelId = ref(null)
const descricaoInicial = ref('')

const customerOptions = ref([])
const categoryOptions = ref([])
const subcategoryOptions = ref([])
const itemOptions = ref([])
const solutionGroupOptions = ref([])
const userOptions = ref([])

const filteredSubcategoryOptions = computed(() =>
  categoriaId.value
    ? subcategoryOptions.value.filter((sub) => sub.categoria_id === categoriaId.value)
    : [],
)

const filteredItemOptions = computed(() =>
  subcategoriaId.value
    ? itemOptions.value.filter((item) => item.subcategoria_id === subcategoriaId.value)
    : [],
)

const filteredResponsavelOptions = computed(() =>
  grupoSolucaoId.value
    ? userOptions.value.filter((user) => user.grupo_solucao_id === grupoSolucaoId.value)
    : [],
)

function customerLabel(customer) {
  if (!customer || typeof customer !== 'object') return ''
  return `${customer.client?.name ?? '—'} — ${customer.name} (${customer.email})`
}

function watchCategoriaChange() {
  if (initializing.value) return
  subcategoriaId.value = null
  itemId.value = null
}

function watchSubcategoriaChange() {
  if (initializing.value) return
  itemId.value = null
}

function watchGrupoSolucaoChange() {
  if (initializing.value) return
  if (!filteredResponsavelOptions.value.some((user) => user.id === responsavelId.value)) {
    responsavelId.value = null
  }
}

async function loadCustomers() {
  customerOptions.value = []
  const { data } = await customerService.list({ per_page: 200 })
  customerOptions.value = data
}

async function loadCategories() {
  categoryOptions.value = []
  const { data } = await categoryService.list({ per_page: 200 })
  categoryOptions.value = data
}

async function loadSubcategories() {
  subcategoryOptions.value = []
  const { data } = await subcategoryService.list({ per_page: 200 })
  subcategoryOptions.value = data
}

async function loadItems() {
  itemOptions.value = []
  const { data } = await itemService.list({ per_page: 200 })
  itemOptions.value = data
}

async function loadSolutionGroups() {
  solutionGroupOptions.value = []
  const { data } = await solutionGroupService.list({ per_page: 200 })
  solutionGroupOptions.value = data
}

async function loadUsers() {
  userOptions.value = []
  const { data } = await userService.list({ per_page: 200 })
  userOptions.value = data
}

function resolveClassificationFromItemId(currentItemId) {
  const item = itemOptions.value.find((option) => option.id === currentItemId)
  if (!item) return

  itemId.value = item.id
  subcategoriaId.value = item.subcategoria_id

  const subcategory = subcategoryOptions.value.find((option) => option.id === item.subcategoria_id)
  if (subcategory) {
    categoriaId.value = subcategory.categoria_id
  }
}

async function loadIncident() {
  const incident = await incidentService.get(props.id)

  customerId.value = incident.customer_id ?? incident.customer?.id ?? null
  titulo.value = incident.titulo
  prioridade.value = incident.prioridade
  origem.value = incident.origem
  status.value = incident.status
  grupoSolucaoId.value = incident.grupo_solucao_id ?? incident.grupo_solucao?.id ?? null
  responsavelId.value = incident.responsavel_id ?? incident.responsavel?.id ?? null

  // Não resolve a classificação aqui: `loadIncident` roda em paralelo com
  // `loadItems`/`loadSubcategories` no `Promise.all` de `init()`, então
  // `itemOptions`/`subcategoryOptions` podem ainda estar vazios neste ponto.
  // Devolve o `item_id` para `init()` resolver só depois que TODAS as
  // promises (incluindo as listas) já tiverem terminado.
  return incident.item_id ?? incident.item?.id ?? null
}

async function init() {
  loading.value = true
  loadFailed.value = false
  errorMessage.value = ''
  initializing.value = true

  try {
    const results = await Promise.all([
      loadCustomers(),
      loadCategories(),
      loadSubcategories(),
      loadItems(),
      loadSolutionGroups(),
      loadUsers(),
      isEditing.value ? loadIncident() : Promise.resolve(null),
    ])

    const incidentItemId = results[6]
    if (incidentItemId) {
      resolveClassificationFromItemId(incidentItemId)
    }
  } catch (error) {
    loadFailed.value = true
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os dados do incidente.')
  } finally {
    initializing.value = false
    loading.value = false
  }
}

function buildBasePayload() {
  return {
    customer_id: customerId.value,
    titulo: titulo.value,
    prioridade: prioridade.value,
    origem: origem.value,
    item_id: itemId.value,
    grupo_solucao_id: grupoSolucaoId.value,
    responsavel_id: responsavelId.value,
  }
}

async function onSubmit() {
  saving.value = true
  errorMessage.value = ''

  try {
    if (isEditing.value) {
      await incidentService.update(props.id, { ...buildBasePayload(), status: status.value })
    } else {
      const created = await incidentService.create({
        ...buildBasePayload(),
        descricao: descricaoInicial.value,
      })
      router.replace({ name: 'incident-edit', params: { id: created.id } })
      return
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o incidente.')
  } finally {
    saving.value = false
  }
}

init()
</script>

<template>
  <AppLayout>
    <h1 class="text-h5 font-weight-bold mb-4">
      {{ isEditing ? `Incidente #${id}` : 'Novo Incidente' }}
    </h1>

    <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
      {{ errorMessage }}
    </v-alert>

    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <v-row v-else-if="!loadFailed">
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-2">
          <v-card-text>
            <v-form @submit.prevent="onSubmit">
              <v-select
                v-model="customerId"
                :items="customerOptions"
                :item-title="customerLabel"
                item-value="id"
                label="Cliente"
                required
                :disabled="!canManage"
                class="mb-2"
              />

              <v-text-field
                v-model="titulo"
                label="Título"
                required
                :disabled="!canManage"
                class="mb-2"
              />

              <v-select
                v-model="prioridade"
                :items="priorityOptions"
                label="Prioridade"
                required
                :disabled="!canManage"
                class="mb-2"
              />

              <v-select
                v-model="origem"
                :items="originOptions"
                label="Origem"
                required
                :disabled="!canManage"
                class="mb-2"
              />

              <v-select
                v-if="isEditing"
                v-model="status"
                :items="statusOptions"
                label="Status"
                required
                :disabled="!canManage"
                class="mb-2"
              />

              <div class="text-caption text-medium-emphasis mb-1">Classificação</div>
              <v-row dense class="mb-2">
                <v-col cols="4">
                  <v-select
                    v-model="categoriaId"
                    :items="categoryOptions"
                    item-title="nome"
                    item-value="id"
                    label="Categoria"
                    clearable
                    :disabled="!canManage"
                    @update:model-value="watchCategoriaChange"
                  />
                </v-col>
                <v-col cols="4">
                  <v-select
                    v-model="subcategoriaId"
                    :items="filteredSubcategoryOptions"
                    item-title="nome"
                    item-value="id"
                    label="Subcategoria"
                    clearable
                    :disabled="!canManage || !categoriaId"
                    @update:model-value="watchSubcategoriaChange"
                  />
                </v-col>
                <v-col cols="4">
                  <v-select
                    v-model="itemId"
                    :items="filteredItemOptions"
                    item-title="nome"
                    item-value="id"
                    label="Item"
                    clearable
                    :disabled="!canManage || !subcategoriaId"
                  />
                </v-col>
              </v-row>

              <v-select
                v-model="grupoSolucaoId"
                :items="solutionGroupOptions"
                item-title="nome"
                item-value="id"
                label="Grupo de Solução"
                clearable
                :disabled="!canManage"
                class="mb-2"
                @update:model-value="watchGrupoSolucaoChange"
              />

              <v-select
                v-model="responsavelId"
                :items="filteredResponsavelOptions"
                item-title="name"
                item-value="id"
                label="Responsável"
                clearable
                :disabled="!canManage || !grupoSolucaoId"
                :hint="!grupoSolucaoId ? 'Selecione um grupo de solução primeiro' : ''"
                persistent-hint
                class="mb-2"
              />

              <v-textarea
                v-if="!isEditing"
                v-model="descricaoInicial"
                label="Descrição"
                required
                rows="4"
                :disabled="!canManage"
                class="mb-2"
              />

              <v-btn v-if="canManage" color="primary" :loading="saving" @click="onSubmit">
                Salvar
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <IncidentFeed v-if="isEditing" :incident-id="id" />
      </v-col>
    </v-row>
  </AppLayout>
</template>
```

- [ ] **Step 2: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: build completa sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/views/IncidentFormView.vue
git commit -m "feat: add incident create/edit view with 50/50 feed layout"
```

---

### Task 6: Frontend — rotas de incidente

**Files:**
- Modify: `src/router/index.js`

**Interfaces:**
- Consumes: `src/views/IncidentFormView.vue` (Task 5).
- Produces: rotas nomeadas `incident-new` (`/incidents/new`) e `incident-edit` (`/incidents/:id`), usadas por `DashboardView.vue` (Task 7) e pelo próprio `IncidentFormView.vue` (redirect pós-criação).

- [ ] **Step 1: Adicionar as duas rotas**

Ler `src/router/index.js` antes de editar. Inserir logo após o bloco da rota `/dashboard` (antes do comentário `// --- Cliente (guard "customer") ---`):

```js
  {
    path: '/incidents/new',
    name: 'incident-new',
    component: () => import('@/views/IncidentFormView.vue'),
    meta: { requiresAuth: true, guard: 'web' },
  },
  {
    path: '/incidents/:id',
    name: 'incident-edit',
    component: () => import('@/views/IncidentFormView.vue'),
    props: true,
    meta: { requiresAuth: true, guard: 'web' },
  },
```

- [ ] **Step 2: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: build completa sem erros.

- [ ] **Step 3: Verificação manual**

Com `npm run dev` rodando e logado como staff, navegar manualmente para `/incidents/new` pela URL — a tela de criação deve renderizar (mesmo que a navegação pelo dashboard ainda não exista, a rota já funciona standalone).

- [ ] **Step 4: Commit**

```bash
git add src/router/index.js
git commit -m "feat: add incident create/edit routes"
```

---

### Task 7: Frontend — dashboard com listagem de incidentes

**Files:**
- Modify: `src/views/DashboardView.vue` (reescrita completa do conteúdo)

**Interfaces:**
- Consumes: `incidentService.dashboard()` (Task 3), `PRIORIDADE_LABELS`/`PRIORIDADE_COLORS`/`STATUS_LABELS`/`STATUS_COLORS`/`ORIGEM_LABELS` (Task 2), rota nomeada `incident-edit`/`incident-new` (Task 6).
- Produces: nada consumido por outro task — é a ponta final do fluxo.

- [ ] **Step 1: Reescrever `src/views/DashboardView.vue`**

```vue
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import incidentService from '@/services/incidentService'
import { extractErrorMessage } from '@/utils/errors'
import {
  PRIORIDADE_LABELS,
  PRIORIDADE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  ORIGEM_LABELS,
} from '@/utils/incidentLabels'

const auth = useAuthStore()
const router = useRouter()

const headers = [
  { title: 'Número', key: 'numero', sortable: false },
  { title: 'Título', key: 'titulo', sortable: false },
  { title: 'Cliente', key: 'cliente', sortable: false },
  { title: 'Classificação', key: 'classificacao', sortable: false },
  { title: 'Prioridade', key: 'prioridade', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Origem', key: 'origem', sortable: false },
  { title: 'Resposta (h)', key: 'tempo_resposta_horas', sortable: false },
  { title: 'Resolução (h)', key: 'tempo_resolucao_horas', sortable: false },
]

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)

function classification(item) {
  if (!item.categoria) return '—'
  return [item.categoria, item.subcategoria, item.item].filter(Boolean).join(' / ')
}

async function loadIncidents() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await incidentService.dashboard({ page: page.value, per_page: itemsPerPage.value })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os incidentes.')
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadIncidents()
}

function onRowClick(event, { item }) {
  router.push({ name: 'incident-edit', params: { id: item.numero } })
}

function openCreate() {
  router.push({ name: 'incident-new' })
}
</script>

<template>
  <AppLayout>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5 font-weight-bold">Incidentes</h1>
      <v-btn v-if="auth.hasPermission('tickets.manage')" color="primary" prepend-icon="mdi-plus" @click="openCreate">
        Novo Incidente
      </v-btn>
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
      class="incident-table"
      @update:options="onOptionsUpdate"
      @click:row="onRowClick"
    >
      <template #item.cliente="{ item }">
        <div>{{ item.cliente ?? '—' }}</div>
        <div class="text-caption text-medium-emphasis">{{ item.email_cliente }}</div>
      </template>

      <template #item.classificacao="{ item }">
        {{ classification(item) }}
      </template>

      <template #item.prioridade="{ item }">
        <v-chip size="small" :color="PRIORIDADE_COLORS[item.prioridade]" variant="tonal">
          {{ PRIORIDADE_LABELS[item.prioridade] ?? item.prioridade }}
        </v-chip>
      </template>

      <template #item.status="{ item }">
        <v-chip size="small" :color="STATUS_COLORS[item.status]" variant="tonal">
          {{ STATUS_LABELS[item.status] ?? item.status }}
        </v-chip>
      </template>

      <template #item.origem="{ item }">
        {{ ORIGEM_LABELS[item.origem] ?? item.origem }}
      </template>

      <template #item.tempo_resposta_horas="{ item }">
        {{ item.tempo_resposta_horas ?? '—' }}
      </template>

      <template #item.tempo_resolucao_horas="{ item }">
        {{ item.tempo_resolucao_horas ?? '—' }}
      </template>
    </v-data-table-server>
  </AppLayout>
</template>

<style scoped>
.incident-table :deep(tbody tr) {
  cursor: pointer;
}
</style>
```

- [ ] **Step 2: Build**

Run: `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build`
Expected: build completa sem erros.

- [ ] **Step 3: Verificação manual end-to-end**

Com `npm run dev` (Node 22.14.0) e o backend rodando:
1. Logar como staff com `tickets.view`+`tickets.manage` — deve cair direto em `/dashboard` e ver a listagem de incidentes (título visível na coluna).
2. Clicar numa linha — deve navegar para `/incidents/{numero}` com os campos preenchidos e o feed carregado.
3. Clicar em "Novo Incidente" — preencher os campos obrigatórios + descrição, salvar — deve redirecionar para a edição do incidente recém-criado, com a descrição já aparecendo como primeiro comentário do feed.
4. Trocar Categoria — Subcategoria e Item devem limpar. Trocar Grupo de Solução — Responsável deve filtrar/limpar conforme o grupo.
5. No feed: adicionar um comentário próprio, editá-lo, excluí-lo. Confirmar que comentários de outro autor e entradas de escalonamento nunca mostram os ícones de editar/excluir.
6. Editar um incidente trocando `Grupo de Solução`/`Responsável` e salvar — recarregar a página de edição e confirmar que apareceu(m) entrada(s) de escalonamento novas no feed.

- [ ] **Step 4: Commit**

```bash
git add src/views/DashboardView.vue
git commit -m "feat: replace dashboard placeholder with incident listing"
```
