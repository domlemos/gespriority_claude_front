# Área Administrativa — Grupos de Solução

Data: 2026-07-31

## Contexto

O backend (`../gespriority_claude`) já implementou a feature "Grupo de Solução"
(`GrupoSolucaoController`, rota `apiResource('grupos-solucao', ...)`, parâmetro forçado para
`grupo_solucao`), que representa o conjunto de agentes (usuários da aplicação, guard `web`) que
resolvem os chamados. Todo `User` agora pertence obrigatoriamente a um grupo de solução
(`users.grupo_solucao_id`, `NOT NULL`, FK `restrictOnDelete`).

Este spec cobre a criação da seção "Grupos de Solução" no frontend, seguindo o mesmo padrão das
seções administrativas já existentes (Clientes, Usuários da Aplicação, Usuários de Clientes,
Políticas de SLA — ver `2026-07-26-admin-area-design.md`), além do ajuste necessário no formulário
de Usuário para vincular cada usuário ao seu grupo.

## Escopo

Inclui:
- Frontend: nova seção "Grupos de Solução" (tabela + CRUD em modal), rota protegida por role
  `admin`, item de menu no `AdminLayout`.
- Frontend: `UserFormModal.vue` ganha um select obrigatório de Grupo de Solução; `UsersView.vue`
  ganha uma coluna mostrando o grupo de cada usuário.

Fora de escopo:
- Qualquer mudança no backend — a API já existe e está documentada em `BACKEND_SPECS.md` (seção
  3.4.6).
- Gestão de membros do grupo a partir da própria tela de Grupos de Solução (multi-select de
  usuários no grupo). O vínculo é feito exclusivamente pelo formulário de Usuário, um grupo por
  vez — decisão explícita do usuário para manter o escopo simples (CRUD simples + picker no form
  de Usuário).
- Busca/filtro/ordenação nas tabelas (mesma decisão já tomada nas seções anteriores — YAGNI).

## API consumida (backend já existente)

Endpoint `/grupos-solucao`, mesmo shape de resposta paginada `{data, links, meta}` das demais
seções.

| Método | Rota | Permission | Body | Resposta |
|---|---|---|---|---|
| `GET` | `/grupos-solucao` | `grupos_solucao.view` | — | `200`, paginado |
| `POST` | `/grupos-solucao` | `grupos_solucao.manage` | `{nome, ativo?}` | `201` |
| `PUT`/`PATCH` | `/grupos-solucao/{grupo_solucao}` | `grupos_solucao.manage` | `{nome, ativo?}` | `200` |
| `DELETE` | `/grupos-solucao/{grupo_solucao}` | `grupos_solucao.manage` | — | `204`; **`409`** se houver `User` vinculado |

Shape do recurso (`GrupoSolucaoResource`): `{id, nome, ativo, created_at, updated_at}`.

`UserResource` já expõe `grupo_solucao_id` e `grupo_solucao: {id, nome} | null`.

## Frontend — mudanças em `gespriority_claude_front`

### `src/services/solutionGroupService.js` (novo)

Wrapper fino sobre `api`, mesmo padrão de `slaService.js`: `list(params)`, `create(payload)`,
`update(id, payload)`, `remove(id)`, todos batendo em `/grupos-solucao`.

### `src/views/admin/SolutionGroupsView.vue` (novo)

`v-data-table-server` com colunas Nome, Ativo (chip verde/cinza, igual ao padrão de `SlasView`),
Ações (editar/excluir). Botão "Novo grupo" no topo. Exclusão via `ConfirmDeleteDialog` existente;
erro de exclusão (inclui o `409` de grupo com usuários vinculados) tratado via
`extractErrorMessage`, mesmo padrão das demais views.

### `src/components/admin/SolutionGroupFormModal.vue` (novo)

`v-dialog` + `v-form` autocontido, mesmo esqueleto do `ClientFormModal`/`SlaFormModal`: campo
`v-text-field` (nome, obrigatório) + `v-checkbox` (ativo, default `true`). Recebe o grupo a editar
(ou `null`) via prop `solutionGroup`, emite `saved`.

### `src/router/index.js`

Nova rota filha dentro do bloco `/admin`:

```js
{
  path: 'solution-groups',
  name: 'admin-solution-groups',
  component: () => import('@/views/admin/SolutionGroupsView.vue'),
},
```

### `src/layouts/AdminLayout.vue`

Novo item no array `items`: `{ title: 'Grupos de Solução', icon: 'mdi-account-multiple-outline', to: { name: 'admin-solution-groups' } }`.

### `src/components/admin/UserFormModal.vue`

Adicionar `v-select` obrigatório de Grupo de Solução (single-select, mesmo padrão do select de
Papéis mas sem `multiple`), populado via `solutionGroupService.list({ per_page: 200 })`. Estado
`solutionGroupId` inicializado a partir de `props.user?.grupo_solucao_id ?? null` no `watch` de
abertura do modal (mesmo padrão do `roleIds`). Incluído no payload de `create`/`update` como
`grupo_solucao_id`.

### `src/views/admin/UsersView.vue`

Nova coluna "Grupo de Solução" nos `headers`, renderizando `item.grupo_solucao?.nome ?? '—'`.

## Testes

Sem framework de teste configurado no projeto (mesma situação das seções anteriores) — validação
manual via `npm run dev`, cobrindo: listar/criar/editar/excluir grupo de solução, exclusão
bloqueada (`409`) quando há usuário vinculado, e o formulário de Usuário exigindo/persistindo o
grupo corretamente (criação e edição).
