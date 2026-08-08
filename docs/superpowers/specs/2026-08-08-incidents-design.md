# Interface de Incidentes (Chamados) — Dashboard + criação/edição com feed estilo SysAid

Data: 2026-08-08

## Contexto

O backend (`../gespriority_claude`) já implementou o CRUD cadastral de `Incidente` (chamado) e o
feed de descrições (`incidente_descricoes`), além de um endpoint de dashboard achatado
(`GET /dashboard/incidentes`) — ver `BACKEND_SPECS.md`, seções 3.4.7, 3.4.7.1 e 3.4.8.

Este spec cobre a criação de toda a interface de incidentes no frontend: a tela de dashboard (que
passa a ser a home do usuário staff logo após o login — rota `/dashboard` já existe e já é o
destino pós-login, só o conteúdo muda), e as telas de criação/edição de incidente, com um layout
50/50 onde a metade direita é reservada para o feed de descrições, inspirado no SysAid.

## Escopo

Inclui:
- **Patch pequeno no backend**: adicionar o campo `titulo` ao `IncidenteDashboardResource` (hoje
  ausente), usando a relação já carregada do `Incidente` — sem N+1 novo. Sem esse campo, a
  listagem do dashboard não tem como identificar visualmente o incidente além do número.
- **`DashboardView.vue`**: substituição do conteúdo placeholder atual (perfil/sessão) pela
  listagem de incidentes via `GET /dashboard/incidentes`, linha clicável levando à edição.
- **Duas rotas novas**, fora de `/admin` (a permissão relevante é `tickets.*`, não o papel
  `admin`): `/incidents/new` (criação) e `/incidents/:id` (edição).
- **`IncidentFormView.vue`**: layout de página cheia dividido 50/50. Coluna esquerda = dados
  cadastrais do incidente (cliente, título, prioridade, origem, status, classificação em cascata
  Categoria→Subcategoria→Item, grupo de solução, responsável filtrado pelo grupo). Coluna direita
  = campo único de descrição (modo criação, sem `incidente_id` ainda) ou o feed completo (modo
  edição).
- **`IncidentFeed.vue`**: componente de feed estilo chat/timeline (mais antigo no topo, mais novo
  embaixo, composer fixo no rodapé) — comentários (CRUD completo do próprio autor) e
  escalonamentos automáticos (somente leitura, texto já pronto vindo do backend).
- **Serviços novos**: `incidentService.js` e `incidentDescriptionService.js`.
- **Gating de permissão** (`tickets.view`/`tickets.manage`) via `auth.hasPermission()` inline nos
  componentes — mesmo padrão já usado em `AppLayout.vue` para o item de menu "Administração"
  (`auth.roles.includes('admin')`). Sem guard novo no router.

Fora de escopo:
- Qualquer regra de workflow de transição de status (backend não valida transições nesta
  entrega).
- Filtros server-side na listagem do dashboard (status/prioridade/etc.) — o backend tem os
  índices mas ainda não expõe esses query params (confirmado na spec do backend); filtro
  client-side só na página atual seria enganoso, então fica de fora.
- Paginação/"carregar mais" no feed — `per_page: 100` é suficiente para o volume esperado de um
  incidente nesta entrega.
- Portal do cliente ver/abrir o próprio incidente — explicitamente adiado no backend (guard
  `customer` não implementado para incidentes).
- Ação dedicada de atribuição/roteamento (`tickets.assign`) — permission existe mas não é usada
  nesta entrega, nem no backend nem aqui.

## API consumida (backend já existente, + 1 patch pequeno)

### Patch no backend: `IncidenteDashboardResource`

Adicionar `titulo` ao array retornado (`$this->titulo`), sem novas queries — o modelo já está
carregado no controller. Ajustar `tests/Feature/Dashboard/IncidentesDashboardTest.php` para
cobrir o novo campo.

### `Incidente` (cadastro)

| Método | Rota | Permission | Body | Resposta |
|---|---|---|---|---|
| `GET` | `/incidentes` | `tickets.view` | — | `200`, paginado, mais recente primeiro |
| `GET` | `/incidentes/{incidente}` | `tickets.view` | — | `200` — `{data: {...}}` |
| `POST` | `/incidentes` | `tickets.manage` | `{customer_id, titulo, descricao, prioridade, origem, item_id?, grupo_solucao_id?, responsavel_id?}` | `201`; `status` sempre `"aberto"` |
| `PUT`/`PATCH` | `/incidentes/{incidente}` | `tickets.manage` | subconjunto de `{customer_id, titulo, prioridade, origem, item_id, grupo_solucao_id, responsavel_id, status}` | `200`; update parcial (`sometimes`) |

`IncidenteResource`: `{id, titulo, prioridade, origem, status, customer_id, customer: {id, name},
item_id, item: {id, nome} | null, grupo_solucao_id, grupo_solucao: {id, nome} | null,
responsavel_id, responsavel: {id, name} | null, created_at, updated_at}`. **Sem `descricao`** — o
feed é buscado à parte.

Sem rota de exclusão (`DELETE` responde `405`).

### Feed (`incidente_descricoes`)

| Método | Rota | Permission + regra | Body | Resposta |
|---|---|---|---|---|
| `GET` | `/incidentes/{incidente}/descricoes` | `tickets.view` | — | `200`, paginado, mais recente primeiro, `user` carregado |
| `POST` | `/incidentes/{incidente}/descricoes` | `tickets.manage` | `{descricao}` | `201`; `tipo` sempre `comentario`, autor sempre o autenticado |
| `PUT`/`PATCH` | `/incidentes/{incidente}/descricoes/{descricao}` | `tickets.manage` + autor | `{descricao}` | `200`; `403` se não for o autor, ou se `tipo = escalonamento` |
| `DELETE` | `/incidentes/{incidente}/descricoes/{descricao}` | `tickets.manage` + autor | — | `204`; mesmas travas do `PUT` |

`IncidenteDescricaoResource`: `{id, incidente_id, tipo, descricao, user: {id, name}, created_at,
updated_at}`. `tipo = escalonamento` é gerado automaticamente pelo `update()` do incidente quando
`grupo_solucao_id`/`responsavel_id` mudam para um valor não-nulo diferente do anterior — texto já
pronto ("Encaminhado para o grupo '...' às... "/"Atribuído para... às..."), nunca editável/excluível
por ninguém.

### Dashboard

| Método | Rota | Permission | Resposta |
|---|---|---|---|
| `GET` | `/dashboard/incidentes` | `tickets.view` | `200`, paginado, mais recente primeiro, `{data: [...], links, meta}` |

`IncidenteDashboardResource` (após o patch): `{numero, titulo, origem, status, prioridade,
cliente, email_cliente, tempo_resposta_minutos, tempo_resposta_horas, tempo_resolucao_minutos,
tempo_resolucao_horas, categoria, subcategoria, item}`. Tempos de SLA e campos de classificação
vêm `null` quando não aplicável/não classificado ainda.

### Pickers reaproveitados de cadastros já existentes

`customerService`, `categoryService`, `subcategoryService`, `itemService`, `solutionGroupService`,
`userService` — todos já existem, todos com `list(params)` retornando `{data, meta}`.

## Frontend — mudanças em `gespriority_claude_front`

> 📌 **Por que `get`/`create`/`update` desembrulham `res.data.data` enquanto `list`/`dashboard`
> devolvem o envelope inteiro:** os services existentes (`customerService`, `categoryService`
> etc.) só têm `list` (precisa de `meta` para paginação) e `create`/`update` cujo retorno nenhum
> caller usa hoje (o padrão é só recarregar a lista depois de salvar). Este é o primeiro fluxo que
> precisa do objeto recém-criado imediatamente (redirecionar para `/incidents/:id` com o `id`
> novo), então desembrulhar direto evita repetir `.data.data` em todo call site.

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

### `src/services/incidentDescriptionService.js` (novo)

Mesmo raciocínio: `list` devolve o envelope (paginação), `create`/`update` desembrulham
(`IncidentFeed.vue` precisa anexar a entrada recém-criada/editada à lista local sem recarregar
tudo).

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

### `src/views/DashboardView.vue` (reescrito)

Remove o conteúdo de perfil/sessão atual. Passa a ser:

- `v-data-table-server`, fonte `incidentService.dashboard({ page, per_page })`, mesmo padrão de
  `onOptionsUpdate` das telas de admin.
- Colunas: `Número` (`numero`), `Título` (`titulo`), `Cliente` (`cliente` com `email_cliente` como
  subtítulo pequeno abaixo), `Classificação` (`categoria / subcategoria / item`, `—` se
  `categoria` for `null`), `Prioridade` (chip, reaproveita os mapas `PRIORIDADE_LABELS`/
  `PRIORIDADE_COLORS` já definidos em `SlasView.vue` — extraídos para
  `src/utils/incidentLabels.js` para reuso), `Status` (chip, novo mapa `STATUS_LABELS`/
  `STATUS_COLORS` também em `incidentLabels.js`), `Origem` (`ORIGEM_LABELS`), `Resposta (h)`
  (`tempo_resposta_horas`, `—` se `null`), `Resolução (h)` (`tempo_resolucao_horas`, `—` se
  `null`).
- Linha clicável: `<tr @click="...">` via slot `#item` customizado do `v-data-table-server`
  (Vuetify permite sobrescrever a linha inteira), navegando para
  `{ name: 'incident-edit', params: { id: item.numero } }`. Cursor `pointer` via CSS.
- Botão "Novo Incidente" no cabeçalho, visível só com `auth.hasPermission('tickets.manage')`,
  navega para `{ name: 'incident-new' }`.
- Erros (incluindo `403` por falta de `tickets.view`) no `v-alert` padrão via
  `extractErrorMessage`.

### `src/utils/incidentLabels.js` (novo)

Centraliza os mapas de tradução/cor usados tanto no dashboard quanto no form:

```js
export const PRIORIDADE_LABELS = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }
export const PRIORIDADE_COLORS = { baixa: 'secondary', media: 'info', alta: 'warning', urgente: 'error' }

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

(`SlasView.vue` continua com sua própria cópia local de `PRIORIDADE_LABELS`/`PRIORIDADE_COLORS` —
não faz parte deste escopo tocar numa tela de admin já pronta só para desduplicar 4 linhas.)

### `src/router/index.js`

Duas rotas novas, top-level (mesmo nível de `/dashboard`, fora do bloco `/admin`):

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

### `src/views/IncidentFormView.vue` (novo)

Página cheia. `props: { id: { type: [String, Number], default: null } }` — modo criação quando
`id` é `null`, edição caso contrário.

Layout: `v-row` com duas `v-col cols="12" md="6"` (empilha em telas estreitas). Coluna esquerda =
`v-form` num `v-card`; coluna direita = `v-textarea` de descrição (criação) ou `<IncidentFeed>`
(edição).

**Estado e carregamento (modo edição):** ao montar, `incidentService.get(id)` popula os campos;
`IncidentFeed` carrega o próprio feed de forma independente (recebe só `incident-id` como prop).

**Campos da coluna esquerda:**
- `Cliente` (`customerId`): `v-select`, obrigatório, opções de
  `customerService.list({ per_page: 200 })`, `item-title` função:
  `` `${c.client?.name ?? '—'} — ${c.name} (${c.email})` `` (mesmo espírito de desambiguação do
  `subcategoryLabel` em `ItemFormModal.vue`, incluindo a mesma guarda contra valor escalar não
  resolvido). Inicializa via `props.incident?.customer_id ?? props.incident?.customer?.id ?? null`
  (dual fallback, mesmo padrão consolidado nas features anteriores).
- `Título` (`titulo`): `v-text-field`, obrigatório.
- `Prioridade` (`prioridade`): `v-select`, opções fixas de `PRIORIDADE_LABELS`, obrigatório.
- `Origem` (`origem`): `v-select`, opções fixas de `ORIGEM_LABELS`, obrigatório.
- `Status` (`status`): `v-select`, opções fixas de `STATUS_LABELS` — **renderizado só quando
  `props.id` não é `null`** (criação sempre força `aberto` no backend, campo nem existe no
  formulário de criação).
- **Classificação em cascata** — três `v-select` lado a lado (`v-row`/`v-col cols="4"` dentro da
  coluna esquerda):
  - `Categoria` (`categoriaId`): opções de `categoryService.list({ per_page: 200 })`.
  - `Subcategoria` (`subcategoriaId`): opções de `subcategoryService.list({ per_page: 200 })`
    filtradas client-side por `subcategoria.categoria_id === categoriaId.value`; `disabled`
    enquanto `categoriaId` for `null`.
  - `Item` (`itemId`): opções de `itemService.list({ per_page: 200 })` filtradas por
    `item.subcategoria_id === subcategoriaId.value`; `disabled` enquanto `subcategoriaId` for
    `null`.
  - `watch` em `categoriaId` limpa `subcategoriaId`/`itemId` quando muda; `watch` em
    `subcategoriaId` limpa `itemId`. Nenhum dos três é obrigatório (`item_id` nullable no
    backend). Ao editar um incidente já classificado, inicializa os 3 a partir de
    `item.subcategoria.categoria_id` / `item.subcategoria_id` / `item.id` (a resposta de
    `IncidenteResource` só traz `item: {id, nome}`, sem `subcategoria` aninhada — então, se
    `item_id` existir na edição, busco a subcategoria/categoria dele varrendo as listas já
    carregadas de `itemService`/`subcategoryService` pelo `id`, em vez de esperar um campo que o
    `IncidenteResource` não tem).
- `Grupo de Solução` (`grupoSolucaoId`): `v-select`, opções de `solutionGroupService.list()`,
  opcional.
- `Responsável` (`responsavelId`): `v-select`, opções de `userService.list({ per_page: 200 })`
  **filtradas client-side por `user.grupo_solucao_id === grupoSolucaoId.value`**; lista vazia com
  texto placeholder "Selecione um grupo de solução primeiro" enquanto `grupoSolucaoId` for `null`.
  `watch` em `grupoSolucaoId` limpa `responsavelId` se o valor atual não pertencer mais ao grupo
  novo.
- Botão `Salvar`: no modo criação, `incidentService.create({...campos, descricao: descricaoInicial.value})`
  seguido de `router.replace({ name: 'incident-edit', params: { id: novoIncidente.id } })`. No
  modo edição, `incidentService.update(id, {...campos, status})`. Todo o form (`v-form` +
  `v-textarea` de descrição inicial) fica com `disabled` (via `:readonly`/`:disabled` em cada
  campo) e o botão Salvar oculto quando `!auth.hasPermission('tickets.manage')`.
- Erros via `v-alert` + `extractErrorMessage`, mesmo padrão.

**Coluna direita — modo criação:** `v-textarea` "Descrição" obrigatória, dentro do mesmo
`v-card`/`v-form` da esquerda (é só outro campo do `POST`, não um recurso separado ainda).

**Coluna direita — modo edição:** `<IncidentFeed :incident-id="id" />`.

### `src/components/IncidentFeed.vue` (novo)

Props: `{ incidentId: { type: [String, Number], required: true } }`.

- `v-card` com altura fixa (ex. `height: 600px` em desktop, `100%` do espaço disponível) e uma
  área de scroll interna (`class="overflow-y-auto"` num `v-card-text` flexível) + composer fixo
  no rodapé do card (`v-card-actions` fora da área de scroll).
- Carrega `incidentDescriptionService.list(incidentId, { per_page: 100 })` ao montar; a resposta
  vem mais recente primeiro (backend usa `->latest()`), então inverto localmente
  (`[...data].reverse()`) para exibir mais antigo no topo / mais novo embaixo, e faço scroll para
  o fim após o carregamento inicial (`nextTick` + `scrollTop = scrollHeight`).
- Cada entrada:
  - `tipo === 'comentario'`: balão com avatar (iniciais, mesmo helper `initials()` hoje só em
    `AppLayout.vue` — extraído para `src/utils/text.js` e importado nos dois lugares), nome do
    autor, timestamp `created_at` formatado pt-BR, texto do comentário. Se
    `descricao.user.id === auth.user.id`, dois ícones pequenos (`mdi-pencil`, `mdi-delete`) no
    canto do balão:
    - Editar: substitui o texto por um `v-textarea` inline + botões Salvar/Cancelar; Salvar chama
      `incidentDescriptionService.update()` e atualiza a entrada local.
    - Excluir: abre o `ConfirmDeleteDialog` já existente; confirmar chama
      `incidentDescriptionService.remove()` e remove a entrada da lista local.
  - `tipo === 'escalonamento'`: renderizado como uma pílula centralizada (`v-chip` ou `div`
    discreto, sem avatar, cor `default`/neutra), só o texto (já vem pronto do backend) + timestamp
    pequeno. Sem ícones de ação (nunca editável/excluível, nem para o autor).
- Composer no rodapé: `v-textarea` (auto-grow, 1-2 linhas) + botão "Comentar"
  (`incidentDescriptionService.create(incidentId, { descricao })`); ao concluir, anexa a nova
  entrada ao fim da lista local (sem recarregar tudo) e limpa o textarea. Oculto/desabilitado sem
  `auth.hasPermission('tickets.manage')`.
- Erros (carregar/comentar/editar/excluir) no `v-alert` padrão via `extractErrorMessage`.

## Permissões (resumo)

Sem guard novo no router — mesmo padrão já usado em `AppLayout.vue`
(`v-if="auth.roles.includes('admin')"`), agora com `auth.hasPermission('tickets.manage')`:

| Onde | Sem `tickets.view` | Sem `tickets.manage` |
|---|---|---|
| Dashboard | `GET /dashboard/incidentes` retorna `403`; tela mostra só o `v-alert` de erro, tabela vazia. Botão "Novo Incidente" continua visível (dono de `tickets.manage` sem `tickets.view` é uma combinação estranha, mas não é este frontend que decide isso). | Botão "Novo Incidente" oculto. |
| Form (criar/editar) | N/A (`GET /incidentes/{id}` também exigiria `tickets.view`; se falhar, mesmo `v-alert`) | Todos os campos `disabled`, botão Salvar oculto, composer do feed oculto. |
| Feed — editar/excluir próprio comentário | — | Ícones de editar/excluir dependem só de `descricao.user.id === auth.user.id`, independente de `tickets.manage` (regra de posse do backend, não checagem adicional de permission). |

## Testes

Sem framework de teste automatizado no frontend (mesma situação de todas as seções anteriores) —
validação via `source ~/.nvm/nvm.sh && nvm use 22.14.0 && npm run build` + checklist manual no
navegador cobrindo:

- Login como staff cai direto no dashboard, listagem de incidentes aparece com título visível.
- Clicar numa linha abre a edição com os campos preenchidos e o feed carregado (mais antigo no
  topo).
- Criar um incidente novo: preencher os campos obrigatórios + descrição inicial, salvar, cair
  automaticamente na tela de edição do incidente recém-criado com a descrição já aparecendo como
  primeiro comentário do feed.
- Cascata Categoria→Subcategoria→Item: trocar a Categoria limpa Subcategoria/Item; trocar a
  Subcategoria limpa só o Item.
- Trocar Grupo de Solução: lista de Responsável se atualiza para só os usuários daquele grupo;
  Responsável anterior é limpo se não pertencer ao novo grupo.
- Editar um incidente existente trocando `grupo_solucao_id`/`responsavel_id`: confirmar que
  aparecem entradas `escalonamento` novas no feed após salvar e recarregar.
- No feed: adicionar comentário próprio, editar esse mesmo comentário, excluir esse mesmo
  comentário; confirmar que comentários de outros autores e entradas de escalonamento nunca
  mostram os ícones de ação.
- Usuário sem `tickets.manage`: formulário abre só leitura, sem botão Salvar, sem composer no
  feed.

Do lado do backend (`gespriority_claude`), após o patch do `titulo`: rodar a suíte existente
(`Incidentes/*`, `Dashboard/*`) e ajustar/confirmar o teste de dashboard cobrindo o novo campo.
