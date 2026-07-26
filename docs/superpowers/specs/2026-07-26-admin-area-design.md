# Área Administrativa — Clientes, Usuários da Aplicação e Usuários de Clientes

Data: 2026-07-26

## Contexto

O frontend (`gespriority_claude_front`) e o backend (`../gespriority_claude`) hoje só cobrem
autenticação. O backend já tem CRUD completo de `Client` (`ClientController`, rota
`apiResource('clients', ...)` gated por `can:clients.manage`), mas não existe CRUD para `User`
(guard `web`, colaboradores internos) nem para `Customer` (guard `customer`, pessoas do portal
vinculadas a um `Client`) — só login/me/refresh para esses dois guards.

Este spec cobre a criação de uma área administrativa no frontend com três seções (Clientes,
Usuários da Aplicação, Usuários de Clientes), cada uma com tabela + CRUD em modal, e a
implementação dos endpoints de backend que faltam para sustentar as duas seções novas.

Só usuários com role `admin` devem enxergar e acessar essa área.

## Escopo

Inclui:
- Backend: `UserController` (CRUD de `User`), `RoleController@index`, `CustomerController` (CRUD
  de `Customer`), `CustomerResource`, nova permission `customers.manage`, ajuste em
  `ClientController@index` para aceitar `?per_page=`, trava contra autoexclusão em
  `UserController@destroy`, atualização do `BACKEND_SPECS.md`.
- Frontend: layout com menu lateral (`AdminLayout`), três views com tabela paginada + modal de
  formulário, serviços de API, rotas protegidas por role `admin`, item de menu condicional.

Fora de escopo:
- Módulo de Tickets (não existe ainda, mencionado só como contexto no backend).
- Busca/filtro nas tabelas administrativas (não pedido; YAGNI).
- Auditoria de alterações (fora do pedido original).
- Gerenciamento de permissions/roles em si (CRUD de `Role`/`Permission`) — só leitura de roles
  para o multi-select do formulário de usuário.

## Controle de acesso

- **Frontend**: guard de rota exige `auth.roles.includes('admin')` para qualquer rota sob
  `/admin`; o item "Administração" no menu do usuário (`AppLayout`) só aparece nesse caso.
- **Backend**: cada endpoint continua gated por *permission* (`can:clients.manage`,
  `can:users.manage`, `can:customers.manage` — nova), seguindo o padrão já usado em
  `ClientController`. Hoje só a role `admin` tem essas três permissions (ver
  `RolesAndPermissionsSeeder`), então o resultado prático equivale a "só admin", mas a
  autorização no backend continua granular por permission em vez de checar role diretamente —
  consistente com o que já existe e mais fácil de estender no futuro (ex: dar `users.manage` para
  Supervisor sem tocar em `admin`).

## Backend — mudanças em `../gespriority_claude`

### Nova permission

Seeder `RolesAndPermissionsSeeder`: adicionar `['name' => 'Gerenciar usuários de clientes', 'slug' => 'customers.manage']`
à lista de permissions, e incluir no `sync()` da role `admin` (junto das demais).

### `UserController` (`app/Http/Controllers/Api/UserController.php`)

CRUD de `App\Models\User` (guard `web`), seguindo o mesmo estilo do `ClientController` (validação
inline, sem FormRequest dedicado, resposta via Resource existente).

| Método | Rota | Body | Resposta |
|---|---|---|---|
| `GET` | `/users` | — | `200` — paginado (`?per_page=`), `UserResource::collection`, com `roles`/`permissions` carregados (`with('roles.permissions')`) |
| `POST` | `/users` | `{name, email, password, role_ids?: number[]}` | `201` — `UserResource` |
| `GET` | `/users/{user}` | — | `200` — `UserResource` |
| `PUT`/`PATCH` | `/users/{user}` | `{name, email, password?, role_ids?: number[]}` | `200` — `UserResource` |
| `DELETE` | `/users/{user}` | — | `204`; **`409`** se `$user->id === $request->user()->id` (não pode excluir a própria conta) |

Validação: `name` obrigatório; `email` obrigatório, `unique:users,email` (ignorando o próprio id no
update); `password` obrigatório (`min:8`) na criação, `nullable` (`min:8` se presente) no update —
se vazio/ausente no update, mantém o hash atual; `role_ids` opcional, array de ids existentes em
`roles`. Após `store`/`update`, sincronizar roles via `$user->roles()->sync($roleIds ?? [])` e
recarregar `roles.permissions` antes de retornar o Resource.

Rota: `Route::middleware(['auth:web', 'can:users.manage'])->apiResource('users', UserController::class)`.

### `RoleController@index` (`app/Http/Controllers/Api/RoleController.php`)

Só para alimentar o multi-select do formulário de usuário — sem CRUD de roles neste escopo.

`GET /roles` → `200`, `{data: [{id, name, slug}, ...]}` (sem paginação — a lista de roles é
pequena e fixa). Gate: `can:users.manage` (mesma permission de quem gerencia usuários).

### `CustomerController` (`app/Http/Controllers/Api/CustomerController.php`)

CRUD de `App\Models\Customer` (guard `customer`), mesmo estilo do `ClientController`.

| Método | Rota | Body | Resposta |
|---|---|---|---|
| `GET` | `/customers` | — | `200` — paginado (`?per_page=`), `CustomerResource::collection`, com `client` carregado |
| `POST` | `/customers` | `{name, email, password, client_id}` | `201` — `CustomerResource` |
| `GET` | `/customers/{customer}` | — | `200` — `CustomerResource` |
| `PUT`/`PATCH` | `/customers/{customer}` | `{name, email, password?, client_id}` | `200` — `CustomerResource` |
| `DELETE` | `/customers/{customer}` | — | `204` |

Validação: `name` obrigatório; `email` obrigatório, `unique:customers,email` (ignorando o próprio
id no update); `password` obrigatório (`min:8`) na criação, `nullable` no update (mesma regra do
`UserController`); `client_id` obrigatório, `exists:clients,id`.

Sem trava de exclusão adicional (Customer não tem dependentes no schema atual — módulo de Tickets
ainda não existe).

Rota: `Route::middleware(['auth:web', 'can:customers.manage'])->apiResource('customers', CustomerController::class)`.

### `CustomerResource` (`app/Http/Resources/CustomerResource.php`)

```php
[
    'id' => $this->id,
    'name' => $this->name,
    'email' => $this->email,
    'email_verified_at' => $this->email_verified_at,
    'client' => $this->whenLoaded('client', fn () => ['id' => $this->client->id, 'name' => $this->client->name]),
    'created_at' => $this->created_at,
    'updated_at' => $this->updated_at,
]
```

### Ajuste em `ClientController@index`

Trocar `paginate()` por `paginate($request->integer('per_page', 15))`, para o frontend poder pedir
uma lista maior (ex: `?per_page=200`) ao popular o select de clientes no formulário de Customer,
sem precisar paginar esse dropdown.

### `BACKEND_SPECS.md`

Atualizar seção 3.1 (tabela `permissions`/seed) e seção 3.4 (endpoints), adicionando:
- A permission `customers.manage`.
- Os endpoints de `UserController`, `RoleController@index` e `CustomerController` no mesmo
  formato de tabela já usado para `ClientController` (seção 3.4.2), incluindo validação e casos de
  erro (`422`/`401`/`403`/`409`).

## Frontend — mudanças em `gespriority_claude_front`

### Services (`src/services/`)

- `clientService.js`, `userService.js`, `customerService.js`, `roleService.js` — wrappers finos
  sobre `api` (mesmo padrão do `authService.js`): `list(params)`, `create(payload)`, `update(id,
  payload)`, `remove(id)` (e `roleService.list()` sem paginação).

### `AppLayout.vue`

Adicionar slot nomeado opcional `#drawer`, renderizado como `<v-navigation-drawer>` antes do
`<v-main>`. Sem esse slot preenchido (caso do Dashboard/Portal atuais), nada muda visualmente —
mudança aditiva, não quebra as duas views existentes.

Adicionar também, no menu do usuário (dropdown do avatar), um item "Administração"
(`prepend-icon="mdi-shield-account"`, `to: { name: 'admin' }`), visível só quando
`auth.roles.includes('admin')`.

### `AdminLayout.vue` (novo, `src/layouts/`)

Usa `AppLayout`, preenchendo `#drawer` com um `v-list` de 3 itens (Clientes, Usuários da
Aplicação, Usuários de Clientes → rotas nomeadas `admin-clients`, `admin-users`,
`admin-customers`), e o slot padrão com `<router-view />`.

### Rotas (`src/router/index.js`)

```
/admin                    (redirect → admin-clients)
/admin/clients            name: admin-clients
/admin/users              name: admin-users
/admin/customers          name: admin-customers
```

Todas com `meta: { requiresAuth: true, guard: 'web', requiresAdmin: true }`, componente pai
`AdminLayout` com rotas filhas (`children`), cada filha renderizando sua view dentro do
`<router-view/>` do layout.

Guard global (`router.beforeEach`): quando `to.meta.requiresAdmin` e
`!auth.roles.includes('admin')`, redireciona para `homeRouteFor(auth.guard)` (mesmo padrão já
usado para `guard` mismatch).

### Views (`src/views/admin/`)

`ClientsView.vue`, `UsersView.vue`, `CustomersView.vue` — cada uma:
- `v-data-table-server` (paginação server-side, usando `list({ page, per_page })` do service
  correspondente).
- Botão "Novo" no topo, abre o modal em modo criação.
- Ações de editar/excluir por linha; editar abre o modal preenchido; excluir abre um
  `v-dialog` de confirmação simples antes de chamar `remove(id)`.
- Mensagens de erro via `extractErrorMessage` (já existente em `src/utils/errors.js`), mesmo
  padrão do `LoginView`.

### Modais de formulário (`src/components/admin/`)

- `ClientFormModal.vue` — campo único `name`.
- `UserFormModal.vue` — `name`, `email`, `password` (label muda para "Nova senha (opcional)" em
  modo edição), multi-select de `roles` (carregado via `roleService.list()`).
- `CustomerFormModal.vue` — `name`, `email`, `password` (mesma regra de opcional na edição),
  select de `client` (carregado via `clientService.list({ per_page: 200 })`).

Cada modal é um `v-dialog` + `v-form` autocontido, recebendo o registro a editar (ou `null` para
criação) via prop e emitindo `saved` para a view recarregar a tabela e fechar o modal.

## Testes

- Backend: feature tests para `UserController`, `CustomerController`, `RoleController@index`
  cobrindo autorização (403 sem permission), validação (422) e os casos de 409 (autoexclusão).
- Frontend: sem framework de teste configurado no projeto atualmente — validação manual via
  `npm run dev`, cobrindo os fluxos de criar/editar/excluir em cada uma das 3 seções e o guard de
  acesso (usuário não-admin não deve nem ver o menu nem acessar `/admin` por URL direta).
