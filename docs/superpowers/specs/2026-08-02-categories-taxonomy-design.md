# Área Administrativa — Categorias / Subcategorias / Itens + reorganização do menu

Data: 2026-08-02

## Contexto

O backend (`../gespriority_claude`) já implementou a taxonomia de incidentes em 3 níveis —
`Categoria` → `Subcategoria` → `Item` — via `CategoriaController`/`SubcategoriaController`/
`ItemController`, endpoints `/categorias`, `/subcategorias`, `/itens` (ver `BACKEND_SPECS.md`,
seção 3.4.5).

Este spec cobre a criação das 3 novas seções administrativas no frontend, seguindo o mesmo padrão
já usado nas seções existentes (ver `2026-07-26-admin-area-design.md` e
`2026-07-31-solution-groups-design.md`), além da reorganização do menu lateral do admin em 3
grupos com título.

## Escopo

Inclui:
- Frontend: 3 novas seções — Categorias, Subcategorias, Itens (tabela + CRUD em modal cada),
  rotas protegidas por role `admin` (herdada do pai `/admin`, mesmo padrão de todas as seções
  atuais), itens de menu no `AdminLayout`.
- Subcategoria e Item têm um seletor obrigatório do pai (Categoria / Subcategoria,
  respectivamente) no formulário, e uma coluna extra na tabela mostrando o nome do pai — mesmo
  padrão já usado em `CustomerFormModal.vue`/`CustomersView.vue` (seletor + coluna de Cliente).
- Reorganização do `AdminLayout.vue`: os 5 itens de menu existentes + os 3 novos passam a ser
  agrupados sob 3 títulos de seção (`v-list-subheader`), sem remover, renomear ou reordenar nenhum
  item existente dentro do seu grupo:
  - **Cadastros**: Clientes, Usuários da Aplicação, Usuários de Clientes
  - **Políticas**: Políticas de SLA, Grupos de Solução
  - **Categorias**: Categorias, Subcategorias, Itens

Fora de escopo:
- Qualquer mudança no backend — a API já existe e está documentada em `BACKEND_SPECS.md`.
- Filtro em cascata (selecionar Categoria para filtrar Subcategorias, etc.) — decisão explícita do
  usuário de manter lista simples com coluna do pai, mesmo padrão do restante do projeto.
- Busca/filtro/ordenação nas tabelas (mesma decisão já tomada nas seções anteriores — YAGNI).
- Qualquer uso da taxonomia fora do admin (ex.: seleção de categoria/subcategoria/item ao abrir um
  chamado) — isso pertence à feature de Tickets, não implementada ainda.

## API consumida (backend já existente)

Mesmo shape de resposta paginada `{data, links, meta}` das demais seções.

| Método | Rota | Permission | Body | Resposta |
|---|---|---|---|---|
| `GET` | `/categorias` | `categorias.view` | — | `200`, paginado |
| `POST` | `/categorias` | `categorias.manage` | `{nome, ativo?}` | `201` |
| `PUT`/`PATCH` | `/categorias/{categoria}` | `categorias.manage` | `{nome, ativo?}` | `200` |
| `DELETE` | `/categorias/{categoria}` | `categorias.manage` | — | `204`; **`409`** se houver `Subcategoria` vinculada |
| `GET` | `/subcategorias` | `categorias.view` | — | `200`, paginado, com `categoria` carregada |
| `POST` | `/subcategorias` | `categorias.manage` | `{categoria_id, nome, ativo?}` | `201` |
| `PUT`/`PATCH` | `/subcategorias/{subcategoria}` | `categorias.manage` | `{categoria_id, nome, ativo?}` | `200` |
| `DELETE` | `/subcategorias/{subcategoria}` | `categorias.manage` | — | `204`; **`409`** se houver `Item` vinculado |
| `GET` | `/itens` | `categorias.view` | — | `200`, paginado, com `subcategoria` carregada |
| `POST` | `/itens` | `categorias.manage` | `{subcategoria_id, nome, ativo?}` | `201` |
| `PUT`/`PATCH` | `/itens/{item}` | `categorias.manage` | `{subcategoria_id, nome, ativo?}` | `200` |
| `DELETE` | `/itens/{item}` | `categorias.manage` | — | `204` — sem trava adicional |

Shapes dos recursos:
- `CategoriaResource`: `{id, nome, ativo, created_at, updated_at}`.
- `SubcategoriaResource`: `{id, categoria_id, nome, ativo, categoria: {id, nome} | null, created_at, updated_at}`.
- `ItemResource`: `{id, subcategoria_id, nome, ativo, subcategoria: {id, nome} | null, created_at, updated_at}`.

Assim como em `grupos-solucao`, o backend usa permissions (`categorias.view`/`categorias.manage`)
que hoje mapeiam para o role `admin`; o frontend continua fazendo o guard só por role `admin` no
nível da rota pai `/admin` (mesmo padrão de todas as seções existentes, nenhuma seção individual
tem guard de permission próprio no frontend hoje).

## Frontend — mudanças em `gespriority_claude_front`

### `src/services/categoryService.js` (novo)

Wrapper fino sobre `api`, mesmo padrão de `solutionGroupService.js`: `list(params)`,
`create(payload)`, `update(id, payload)`, `remove(id)`, batendo em `/categorias`.

### `src/services/subcategoryService.js` (novo)

Mesmo padrão, batendo em `/subcategorias`.

### `src/services/itemService.js` (novo)

Mesmo padrão, batendo em `/itens`.

### `src/views/admin/CategoriesView.vue` (novo)

`v-data-table-server` com colunas Nome, Ativo (chip verde/cinza), Ações — cópia estrutural de
`SolutionGroupsView.vue` trocando o service e os textos.

### `src/components/admin/CategoryFormModal.vue` (novo)

`v-dialog` + `v-form`: `v-text-field` (nome, obrigatório) + `v-checkbox` (ativo, default `true`) —
cópia estrutural de `SolutionGroupFormModal.vue`.

### `src/views/admin/SubcategoriesView.vue` (novo)

Mesma estrutura de `CategoriesView.vue`, mais uma coluna "Categoria" renderizando
`item.categoria?.nome ?? '—'` (mesmo padrão da coluna "Cliente" em `CustomersView.vue`).

### `src/components/admin/SubcategoryFormModal.vue` (novo)

Mesma estrutura de `CategoryFormModal.vue`, mais um `v-select` obrigatório de Categoria
(`categoriaId`, populado via `categoryService.list({ per_page: 200 })`), incluído no payload como
`categoria_id`. Ao editar, inicializa `categoriaId` a partir de
`props.subcategory?.categoria_id ?? props.subcategory?.categoria?.id ?? null` (usa o campo flat
primeiro, com fallback pro objeto aninhado — evita o ponto único de falha apontado na revisão
final de Grupos de Solução).

### `src/views/admin/ItemsView.vue` (novo)

Mesma estrutura de `SubcategoriesView.vue`, trocando para coluna "Subcategoria"
(`item.subcategoria?.nome ?? '—'`).

### `src/components/admin/ItemFormModal.vue` (novo)

Mesma estrutura de `SubcategoryFormModal.vue`, trocando o seletor para Subcategoria
(`subcategoriaId`, populado via `subcategoryService.list({ per_page: 200 })`), payload
`subcategoria_id`. Inicializa a partir de
`props.item?.subcategoria_id ?? props.item?.subcategoria?.id ?? null`.

### `src/router/index.js`

3 novas rotas filhas dentro do bloco `/admin`:

```js
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
```

### `src/layouts/AdminLayout.vue`

Reestrutura o array `items` único em 3 grupos, renderizados no template com um `v-list-subheader`
antes de cada grupo:

```js
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
```

Template itera `menuGroups`, um `<v-list-subheader>{{ group.title }}</v-list-subheader>` seguido
dos `v-list-item` do grupo (mesmo `v-for` de hoje, só aninhado por grupo). Nenhum item existente
muda de rota, ícone ou título — só ganham um título de seção acima.

## Testes

Sem framework de teste configurado no projeto (mesma situação das seções anteriores) — validação
via `npm run build` (Node 22.14.0, requisito de ambiente já documentado) + checklist manual no
navegador cobrindo: CRUD de cada um dos 3 níveis, seletor de pai obrigatório e persistindo
corretamente (criação e edição) em Subcategoria/Item, exclusão bloqueada (`409`) quando há filho
vinculado (Categoria com Subcategoria, Subcategoria com Item), exclusão de Item sem trava, e o
menu lateral mostrando os 3 títulos de seção com todos os 8 itens visíveis e navegáveis.
