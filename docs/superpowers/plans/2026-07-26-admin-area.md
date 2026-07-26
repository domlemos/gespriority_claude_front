# Área Administrativa (Clientes / Usuários da Aplicação / Usuários de Clientes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin area to the frontend (left nav menu, one section per resource, CRUD in a modal) covering Clients, application Users, and Customers (client-portal users) — plus the backend endpoints for User and Customer CRUD that don't exist yet.

**Architecture:** Backend (`../gespriority_claude`, Laravel 13) gets two new resource controllers (`UserController`, `CustomerController`) plus a small `RoleController@index`, all gated by permission (`can:users.manage` / `can:customers.manage`), following the exact style of the existing `ClientController`. Frontend (this repo, Vue 3 + Vuetify 4) gets a nested `/admin` route tree: `AdminLayout` (parent route component) renders `AppLayout` with a left `v-navigation-drawer`, and `<router-view/>` renders the three leaf views (`ClientsView`, `UsersView`, `CustomersView`), each backed by `v-data-table-server` + a dedicated form modal component.

**Tech Stack:** Laravel 13 / Sanctum / PHPUnit (backend), Vue 3 `<script setup>` / Vue Router / Pinia / Vuetify 4 / Axios (frontend).

## Global Constraints

- Backend authorization stays permission-based (`can:...`), never a raw role check in a controller — matches the existing `ClientController` pattern (spec: "Controle de acesso").
- Frontend gates the whole `/admin` route tree by `auth.roles.includes('admin')` (spec: "Somente usuários com perfil admin").
- Password fields: required on create, optional on update (blank = unchanged) for both `User` and `Customer` forms.
- All list endpoints are paginated server-side; the frontend always uses `v-data-table-server`, never client-side pagination.
- Registration/edit only ever happens inside a `v-dialog` modal — no full-page create/edit routes.
- Backend tests run with `docker compose exec app php artisan test --filter=<Name>` (run from `../gespriority_claude`) — **never** run `php artisan test` directly on the host or against a non-test DB; see `BACKEND_SPECS.md` §3.8's incident note on this exact footgun.
- No frontend test framework is configured in this repo (per its `README.md`) — frontend tasks are verified manually via `npm run dev`, not automated tests.

---

## Task 1: Backend — `GET /api/clients` accepts `?per_page=`

**Files:**
- Modify: `../gespriority_claude/app/Http/Controllers/Api/ClientController.php:9-13`
- Test: `../gespriority_claude/tests/Feature/Clients/ClientCrudTest.php`

**Interfaces:**
- Produces: `GET /api/clients?per_page=N` now honors `N` (previously always 15) — the Customer form modal (Task 13) relies on `per_page=200` to fetch the full client list for its select.

- [ ] **Step 1: Write the failing test**

Add to `ClientCrudTest.php` (after `test_admin_can_list_clients`):

```php
    public function test_admin_can_request_a_larger_page_size(): void
    {
        Client::factory()->count(20)->create();
        $token = $this->staffToken();

        $response = $this->getJson('/api/clients?per_page=20', $this->authHeader($token));

        $response->assertOk()->assertJsonCount(20, 'data');
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ../gespriority_claude && docker compose exec app php artisan test --filter=test_admin_can_request_a_larger_page_size`
Expected: FAIL — response only returns 15 items (default Laravel pagination size).

- [ ] **Step 3: Implement**

In `ClientController.php`, change:

```php
    public function index()
    {
        return ClientResource::collection(
            Client::query()->orderBy('name')->paginate()
        );
    }
```

to:

```php
    public function index(Request $request)
    {
        return ClientResource::collection(
            Client::query()->orderBy('name')->paginate($request->integer('per_page', 15))
        );
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ../gespriority_claude && docker compose exec app php artisan test --filter=ClientCrudTest`
Expected: PASS (all `ClientCrudTest` tests, including the new one).

- [ ] **Step 5: Commit**

```bash
cd ../gespriority_claude
git add app/Http/Controllers/Api/ClientController.php tests/Feature/Clients/ClientCrudTest.php
git commit -m "feat: allow overriding page size on GET /api/clients"
```

---

## Task 2: Backend — `customers.manage` permission

**Files:**
- Modify: `../gespriority_claude/database/seeders/RolesAndPermissionsSeeder.php:19-27`

No dedicated test: `ClientCrudTest`/future `UserCrudTest`/`CustomerCrudTest` create their own ad-hoc `Role`/`Permission` via factories and never call this seeder (see `BACKEND_SPECS.md` §3.8). This task only affects real seeded data (`php artisan db:seed`), verified manually.

- [ ] **Step 1: Add the permission to the seeder**

In `RolesAndPermissionsSeeder.php`, change:

```php
        $permissions = collect([
            ['name' => 'Gerenciar usuários', 'slug' => 'users.manage'],
            ['name' => 'Gerenciar papéis e permissões', 'slug' => 'roles.manage'],
            ['name' => 'Gerenciar clientes', 'slug' => 'clients.manage'],
            ['name' => 'Visualizar chamados', 'slug' => 'tickets.view'],
            ['name' => 'Atribuir chamados', 'slug' => 'tickets.assign'],
        ])->mapWithKeys(fn (array $data) => [
```

to:

```php
        $permissions = collect([
            ['name' => 'Gerenciar usuários', 'slug' => 'users.manage'],
            ['name' => 'Gerenciar papéis e permissões', 'slug' => 'roles.manage'],
            ['name' => 'Gerenciar clientes', 'slug' => 'clients.manage'],
            ['name' => 'Gerenciar usuários de clientes', 'slug' => 'customers.manage'],
            ['name' => 'Visualizar chamados', 'slug' => 'tickets.view'],
            ['name' => 'Atribuir chamados', 'slug' => 'tickets.assign'],
        ])->mapWithKeys(fn (array $data) => [
```

The `admin` role already syncs **all** permissions (`$roles['admin']->permissions()->sync($permissions->pluck('id'));`), so no further change is needed for `admin` to gain `customers.manage` automatically.

- [ ] **Step 2: Verify manually**

Run: `cd ../gespriority_claude && docker compose exec app php artisan db:seed`
Expected: command succeeds (idempotent — safe to re-run); then verify:

Run: `docker compose exec app php artisan tinker --execute="echo App\Models\Permission::where('slug','customers.manage')->exists() ? 'yes' : 'no';"`
Expected: prints `yes`.

- [ ] **Step 3: Commit**

```bash
cd ../gespriority_claude
git add database/seeders/RolesAndPermissionsSeeder.php
git commit -m "feat: add customers.manage permission, granted to admin"
```

---

## Task 3: Backend — `GET /api/roles`

**Files:**
- Create: `../gespriority_claude/app/Http/Controllers/Api/RoleController.php`
- Modify: `../gespriority_claude/routes/api.php`
- Test: `../gespriority_claude/tests/Feature/Roles/RoleIndexTest.php` (new)

**Interfaces:**
- Produces: `GET /api/roles` → `200 {data: [{id, name, slug}, ...]}`, gated by `auth:web` + `can:users.manage`. Consumed by the frontend's `roleService.list()` (Task 7) to populate the roles multi-select in `UserFormModal` (Task 12).

- [ ] **Step 1: Write the failing tests**

Create `../gespriority_claude/tests/Feature/Roles/RoleIndexTest.php`:

```php
<?php

namespace Tests\Feature\Roles;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleIndexTest extends TestCase
{
    use RefreshDatabase;

    private function staffToken(string $permissionSlug = 'users.manage'): string
    {
        $role = Role::factory()->create();
        $permission = Permission::factory()->create(['slug' => $permissionSlug]);
        $role->permissions()->attach($permission);

        $user = User::factory()->create();
        $user->roles()->attach($role);

        return $user->createToken('spa', ['staff'], now()->addMinutes(120))->plainTextToken;
    }

    public function test_admin_can_list_roles(): void
    {
        Role::factory()->count(2)->create();
        $token = $this->staffToken();

        $response = $this->getJson('/api/roles', ['Authorization' => "Bearer {$token}"]);

        // +1 pela role criada pro próprio usuário de teste ter a permissão.
        $response->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_staff_without_users_manage_permission_is_forbidden(): void
    {
        $token = $this->staffToken('some.other.permission');

        $this->getJson('/api/roles', ['Authorization' => "Bearer {$token}"])->assertStatus(403);
    }

    public function test_guests_cannot_list_roles(): void
    {
        $this->getJson('/api/roles')->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ../gespriority_claude && docker compose exec app php artisan test --filter=RoleIndexTest`
Expected: FAIL — route `/api/roles` doesn't exist yet (404).

- [ ] **Step 3: Implement the controller**

Create `../gespriority_claude/app/Http/Controllers/Api/RoleController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;

class RoleController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Role::query()->orderBy('name')->get(['id', 'name', 'slug']),
        ]);
    }
}
```

- [ ] **Step 4: Register the route**

In `../gespriority_claude/routes/api.php`, add the import:

```php
use App\Http\Controllers\Api\RoleController;
```

and, after the existing `clients` route at the bottom of the file, add:

```php
Route::middleware(['auth:web', 'can:users.manage'])->get('/roles', [RoleController::class, 'index']);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ../gespriority_claude && docker compose exec app php artisan test --filter=RoleIndexTest`
Expected: PASS (all 3 tests).

- [ ] **Step 6: Commit**

```bash
cd ../gespriority_claude
git add app/Http/Controllers/Api/RoleController.php routes/api.php tests/Feature/Roles/RoleIndexTest.php
git commit -m "feat: add GET /api/roles for the user-form roles picker"
```

---

## Task 4: Backend — `User` CRUD (`UserController`)

**Files:**
- Create: `../gespriority_claude/app/Http/Controllers/Api/UserController.php`
- Modify: `../gespriority_claude/routes/api.php`
- Test: `../gespriority_claude/tests/Feature/Users/UserCrudTest.php` (new)

**Interfaces:**
- Produces: `apiResource('users', UserController::class)` under `auth:web` + `can:users.manage` — `GET/POST /api/users`, `GET/PUT/PATCH/DELETE /api/users/{user}`. Bodies: `{name, email, password?, role_ids?: number[]}`. Responses via the existing `App\Http\Resources\UserResource` (already returns `roles`/`permissions` when `roles.permissions` is loaded). `DELETE` returns `409` when `$user->id === $request->user()->id`. Consumed by the frontend's `userService` (Task 7) and `UserFormModal`/`UsersView` (Task 12).

- [ ] **Step 1: Write the failing tests**

Create `../gespriority_claude/tests/Feature/Users/UserCrudTest.php`:

```php
<?php

namespace Tests\Feature\Users;

use App\Models\Customer;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserCrudTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: string, 1: User} */
    private function staffToken(string $permissionSlug = 'users.manage'): array
    {
        $role = Role::factory()->create();
        $permission = Permission::factory()->create(['slug' => $permissionSlug]);
        $role->permissions()->attach($permission);

        $user = User::factory()->create();
        $user->roles()->attach($role);

        $token = $user->createToken('spa', ['staff'], now()->addMinutes(120))->plainTextToken;

        return [$token, $user];
    }

    private function authHeader(string $token): array
    {
        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_admin_can_list_users(): void
    {
        User::factory()->count(2)->create();
        [$token] = $this->staffToken();

        $response = $this->getJson('/api/users', $this->authHeader($token));

        // +1 porque o próprio usuário autenticado (criado em staffToken()) também é um User.
        $response->assertOk()->assertJsonCount(3, 'data');
    }

    public function test_admin_can_create_a_user_with_roles(): void
    {
        [$token] = $this->staffToken();
        $role = Role::factory()->create();

        $response = $this->postJson('/api/users', [
            'name' => 'Ana Silva',
            'email' => 'ana@example.com',
            'password' => 'password123',
            'role_ids' => [$role->id],
        ], $this->authHeader($token));

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Ana Silva')
            ->assertJsonPath('data.roles.0', $role->slug);
        $this->assertDatabaseHas('users', ['email' => 'ana@example.com']);
    }

    public function test_creating_user_requires_name_email_and_password(): void
    {
        [$token] = $this->staffToken();

        $response = $this->postJson('/api/users', [], $this->authHeader($token));

        $response->assertStatus(422)->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_creating_user_requires_unique_email(): void
    {
        [$token] = $this->staffToken();
        User::factory()->create(['email' => 'dup@example.com']);

        $response = $this->postJson('/api/users', [
            'name' => 'Novo',
            'email' => 'dup@example.com',
            'password' => 'password123',
        ], $this->authHeader($token));

        $response->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_admin_can_update_a_user_without_changing_password(): void
    {
        [$token] = $this->staffToken();
        $user = User::factory()->create(['name' => 'Old Name']);
        $originalPassword = $user->password;

        $response = $this->putJson("/api/users/{$user->id}", [
            'name' => 'New Name',
            'email' => $user->email,
        ], $this->authHeader($token));

        $response->assertOk()->assertJsonPath('data.name', 'New Name');
        $this->assertSame($originalPassword, $user->fresh()->password);
    }

    public function test_admin_can_delete_another_user(): void
    {
        [$token] = $this->staffToken();
        $user = User::factory()->create();

        $response = $this->deleteJson("/api/users/{$user->id}", [], $this->authHeader($token));

        $response->assertNoContent();
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
    }

    public function test_admin_cannot_delete_own_account(): void
    {
        [$token, $admin] = $this->staffToken();

        $response = $this->deleteJson("/api/users/{$admin->id}", [], $this->authHeader($token));

        $response->assertStatus(409);
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_staff_without_users_manage_permission_is_forbidden(): void
    {
        [$token] = $this->staffToken('some.other.permission');

        $this->getJson('/api/users', $this->authHeader($token))->assertStatus(403);
    }

    public function test_guests_cannot_manage_users(): void
    {
        $this->getJson('/api/users')->assertStatus(401);
    }

    public function test_customer_guard_cannot_manage_users(): void
    {
        $customer = Customer::factory()->create();
        $token = $customer->createToken('spa', ['customer'], now()->addMinutes(240))->plainTextToken;

        $this->getJson('/api/users', $this->authHeader($token))->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ../gespriority_claude && docker compose exec app php artisan test --filter=UserCrudTest`
Expected: FAIL — route `/api/users` doesn't exist yet (404s across the board).

- [ ] **Step 3: Implement the controller**

Create `../gespriority_claude/app/Http/Controllers/Api/UserController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        return UserResource::collection(
            User::query()
                ->with('roles.permissions')
                ->orderBy('name')
                ->paginate($request->integer('per_page', 15))
        );
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        $user->roles()->sync($data['role_ids'] ?? []);

        return (new UserResource($user->load('roles.permissions')))
            ->response()
            ->setStatusCode(201);
    }

    public function show(User $user)
    {
        return new UserResource($user->load('roles.permissions'));
    }

    public function update(Request $request, User $user)
    {
        $data = $this->validated($request, $user);

        $user->fill([
            'name' => $data['name'],
            'email' => $data['email'],
        ]);

        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        $user->save();
        $user->roles()->sync($data['role_ids'] ?? []);

        return new UserResource($user->load('roles.permissions'));
    }

    public function destroy(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'Não é possível excluir a própria conta.',
            ], 409);
        }

        $user->delete();

        return response()->noContent();
    }

    private function validated(Request $request, ?User $user = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($user?->id),
            ],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:8'],
            'role_ids' => ['sometimes', 'array'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
        ]);
    }
}
```

- [ ] **Step 4: Register the route**

In `../gespriority_claude/routes/api.php`, add the import:

```php
use App\Http\Controllers\Api\UserController;
```

and, near the `/roles` route added in Task 3, wrap both under the same middleware group:

```php
Route::middleware(['auth:web', 'can:users.manage'])->group(function () {
    Route::apiResource('users', UserController::class);
    Route::get('/roles', [RoleController::class, 'index']);
});
```

(This replaces the standalone `/roles` route line added in Task 3 — same middleware, now grouped.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ../gespriority_claude && docker compose exec app php artisan test --filter=UserCrudTest`
Expected: PASS (all 9 tests).

Also re-run Task 3's tests to confirm the route regrouping didn't break them:

Run: `docker compose exec app php artisan test --filter=RoleIndexTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd ../gespriority_claude
git add app/Http/Controllers/Api/UserController.php routes/api.php tests/Feature/Users/UserCrudTest.php
git commit -m "feat: add CRUD endpoints for application users (guard web)"
```

---

## Task 5: Backend — `Customer` CRUD (`CustomerResource` + `CustomerController`)

**Files:**
- Create: `../gespriority_claude/app/Http/Resources/CustomerResource.php`
- Create: `../gespriority_claude/app/Http/Controllers/Api/CustomerController.php`
- Modify: `../gespriority_claude/routes/api.php`
- Test: `../gespriority_claude/tests/Feature/Customers/CustomerCrudTest.php` (new)

**Interfaces:**
- Produces: `apiResource('customers', CustomerController::class)` under `auth:web` + `can:customers.manage` — `GET/POST /api/customers`, `GET/PUT/PATCH/DELETE /api/customers/{customer}`. Bodies: `{name, email, password?, client_id}`. Responses: `{data: {id, name, email, email_verified_at, client: {id, name}, created_at, updated_at}}`. Consumed by the frontend's `customerService` (Task 7) and `CustomerFormModal`/`CustomersView` (Task 13).

- [ ] **Step 1: Write the failing tests**

Create `../gespriority_claude/tests/Feature/Customers/CustomerCrudTest.php`:

```php
<?php

namespace Tests\Feature\Customers;

use App\Models\Client;
use App\Models\Customer;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerCrudTest extends TestCase
{
    use RefreshDatabase;

    private function staffToken(string $permissionSlug = 'customers.manage'): string
    {
        $role = Role::factory()->create();
        $permission = Permission::factory()->create(['slug' => $permissionSlug]);
        $role->permissions()->attach($permission);

        $user = User::factory()->create();
        $user->roles()->attach($role);

        return $user->createToken('spa', ['staff'], now()->addMinutes(120))->plainTextToken;
    }

    private function authHeader(string $token): array
    {
        return ['Authorization' => "Bearer {$token}"];
    }

    public function test_admin_can_list_customers_with_client(): void
    {
        $client = Client::factory()->create(['name' => 'Acme Corp']);
        Customer::factory()->count(2)->create(['client_id' => $client->id]);
        $token = $this->staffToken();

        $response = $this->getJson('/api/customers', $this->authHeader($token));

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.client.name', 'Acme Corp');
    }

    public function test_admin_can_create_a_customer(): void
    {
        $client = Client::factory()->create();
        $token = $this->staffToken();

        $response = $this->postJson('/api/customers', [
            'name' => 'João Cliente',
            'email' => 'joao@example.com',
            'password' => 'password123',
            'client_id' => $client->id,
        ], $this->authHeader($token));

        $response->assertCreated()->assertJsonPath('data.name', 'João Cliente');
        $this->assertDatabaseHas('customers', ['email' => 'joao@example.com', 'client_id' => $client->id]);
    }

    public function test_creating_customer_requires_a_valid_client_id(): void
    {
        $token = $this->staffToken();

        $response = $this->postJson('/api/customers', [
            'name' => 'João Cliente',
            'email' => 'joao@example.com',
            'password' => 'password123',
            'client_id' => 999,
        ], $this->authHeader($token));

        $response->assertStatus(422)->assertJsonValidationErrors('client_id');
    }

    public function test_admin_can_update_a_customer_without_changing_password(): void
    {
        $client = Client::factory()->create();
        $customer = Customer::factory()->create(['client_id' => $client->id, 'name' => 'Old Name']);
        $originalPassword = $customer->password;
        $token = $this->staffToken();

        $response = $this->putJson("/api/customers/{$customer->id}", [
            'name' => 'New Name',
            'email' => $customer->email,
            'client_id' => $client->id,
        ], $this->authHeader($token));

        $response->assertOk()->assertJsonPath('data.name', 'New Name');
        $this->assertSame($originalPassword, $customer->fresh()->password);
    }

    public function test_admin_can_delete_a_customer(): void
    {
        $customer = Customer::factory()->create();
        $token = $this->staffToken();

        $response = $this->deleteJson("/api/customers/{$customer->id}", [], $this->authHeader($token));

        $response->assertNoContent();
        $this->assertDatabaseMissing('customers', ['id' => $customer->id]);
    }

    public function test_staff_without_customers_manage_permission_is_forbidden(): void
    {
        $token = $this->staffToken('some.other.permission');

        $this->getJson('/api/customers', $this->authHeader($token))->assertStatus(403);
    }

    public function test_guests_cannot_manage_customers(): void
    {
        $this->getJson('/api/customers')->assertStatus(401);
    }

    public function test_customer_guard_cannot_manage_customers(): void
    {
        $customer = Customer::factory()->create();
        $token = $customer->createToken('spa', ['customer'], now()->addMinutes(240))->plainTextToken;

        $this->getJson('/api/customers', $this->authHeader($token))->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ../gespriority_claude && docker compose exec app php artisan test --filter=CustomerCrudTest`
Expected: FAIL — route `/api/customers` doesn't exist yet (404s).

- [ ] **Step 3: Implement the resource**

Create `../gespriority_claude/app/Http/Resources/CustomerResource.php`:

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified_at' => $this->email_verified_at,
            'client' => $this->whenLoaded('client', fn () => [
                'id' => $this->client->id,
                'name' => $this->client->name,
            ]),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
```

- [ ] **Step 4: Implement the controller**

Create `../gespriority_claude/app/Http/Controllers/Api/CustomerController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        return CustomerResource::collection(
            Customer::query()
                ->with('client')
                ->orderBy('name')
                ->paginate($request->integer('per_page', 15))
        );
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $customer = Customer::query()->create([
            'client_id' => $data['client_id'],
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        return (new CustomerResource($customer->load('client')))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Customer $customer)
    {
        return new CustomerResource($customer->load('client'));
    }

    public function update(Request $request, Customer $customer)
    {
        $data = $this->validated($request, $customer);

        $customer->fill([
            'client_id' => $data['client_id'],
            'name' => $data['name'],
            'email' => $data['email'],
        ]);

        if (! empty($data['password'])) {
            $customer->password = Hash::make($data['password']);
        }

        $customer->save();

        return new CustomerResource($customer->load('client'));
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();

        return response()->noContent();
    }

    private function validated(Request $request, ?Customer $customer = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required', 'email', 'max:255',
                Rule::unique('customers', 'email')->ignore($customer?->id),
            ],
            'password' => [$customer ? 'nullable' : 'required', 'string', 'min:8'],
            'client_id' => ['required', 'integer', 'exists:clients,id'],
        ]);
    }
}
```

- [ ] **Step 5: Register the route**

In `../gespriority_claude/routes/api.php`, add the import:

```php
use App\Http\Controllers\Api\CustomerController;
```

and, at the end of the file (after the `clients` route), add:

```php
Route::middleware(['auth:web', 'can:customers.manage'])->apiResource('customers', CustomerController::class);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd ../gespriority_claude && docker compose exec app php artisan test --filter=CustomerCrudTest`
Expected: PASS (all 8 tests).

Then run the full suite to make sure nothing else broke:

Run: `docker compose exec app php artisan test`
Expected: PASS (all tests, including `ClientCrudTest`, `UserCrudTest`, `RoleIndexTest`, `Auth/*`).

- [ ] **Step 7: Commit**

```bash
cd ../gespriority_claude
git add app/Http/Resources/CustomerResource.php app/Http/Controllers/Api/CustomerController.php routes/api.php tests/Feature/Customers/CustomerCrudTest.php
git commit -m "feat: add CRUD endpoints for customers (portal users tied to a client)"
```

---

## Task 6: Backend — update `BACKEND_SPECS.md`

**Files:**
- Modify: `../gespriority_claude/BACKEND_SPECS.md`

No test — documentation only.

- [ ] **Step 1: Fix the pre-existing `clients.manage` gap and add `customers.manage` in §3.7**

Around line 427, change:

```markdown
Permissions: `users.manage`, `roles.manage`, `tickets.view`, `tickets.assign` (as duas últimas são placeholders para o futuro módulo de Tickets).
```

to:

```markdown
Permissions: `users.manage`, `roles.manage`, `clients.manage`, `customers.manage`, `tickets.view`, `tickets.assign` (as duas últimas são placeholders para o futuro módulo de Tickets; `clients.manage` já existia mas não estava listada aqui).
```

- [ ] **Step 2: Document the new endpoints in a new §3.4.3**

After the existing §3.4.2 (`Client` CRUD, ends around line 401, right before `### 3.5. Outras decisões de implementação`), insert:

```markdown
### 3.4.3. Endpoints — CRUD de `User` e `Customer`, e listagem de `Role`

`Route::apiResource('users', UserController::class)` + `Route::get('/roles', ...)`, ambas sob
`auth:web` + `can:users.manage`.

| Método | Rota | Body | Resposta |
|---|---|---|---|
| `GET` | `/users` | — | `200` — paginado (`?per_page=`), `UserResource::collection` com `roles`/`permissions` carregados |
| `POST` | `/users` | `{name, email, password, role_ids?: number[]}` | `201` — `UserResource` |
| `GET` | `/users/{user}` | — | `200` — `UserResource` |
| `PUT`/`PATCH` | `/users/{user}` | `{name, email, password?, role_ids?: number[]}` | `200` — `UserResource`; `password` omitido/vazio mantém o hash atual |
| `DELETE` | `/users/{user}` | — | `204`; **`409`** se `$user->id` for o do próprio autenticado |
| `GET` | `/roles` | — | `200` — `{data: [{id, name, slug}, ...]}`, sem paginação |

Validação de `User`: `name` obrigatório; `email` obrigatório, único (ignorando o próprio id no
update); `password` obrigatório (`min:8`) na criação, opcional (`min:8` se presente) no update;
`role_ids` opcional, array de ids existentes em `roles` (sincronizado via `roles()->sync()`).

`Route::apiResource('customers', CustomerController::class)`, sob `auth:web` +
`can:customers.manage` (nova permission — `Customer` do guard `customer` não participa desse
gate, só `User` do guard `web` gerencia).

| Método | Rota | Body | Resposta |
|---|---|---|---|
| `GET` | `/customers` | — | `200` — paginado (`?per_page=`), `CustomerResource::collection` com `client` carregado |
| `POST` | `/customers` | `{name, email, password, client_id}` | `201` — `CustomerResource` |
| `GET` | `/customers/{customer}` | — | `200` — `CustomerResource` |
| `PUT`/`PATCH` | `/customers/{customer}` | `{name, email, password?, client_id}` | `200` — `CustomerResource`; `password` omitido/vazio mantém o hash atual |
| `DELETE` | `/customers/{customer}` | — | `204` — sem trava adicional (sem dependentes no schema atual) |

Validação de `Customer`: mesmas regras de `name`/`email`/`password` do `User` (email único na
tabela `customers`); `client_id` obrigatório, `exists:clients,id`.

`App\Http\Resources\CustomerResource`: `{id, name, email, email_verified_at, client: {id, name},
created_at, updated_at}`.

Todas as respostas seguem o mesmo envelope `{data: ...}` do `ClientController`. Validação: campo
ausente/inválido → `422`; sem token → `401`; sem a permission correspondente → `403`.
```

- [ ] **Step 3: Add a testing note in §3.8 (or a new §3.9)**

After the existing §3.8 table (around line 464, end of file), append:

```markdown

### 3.9. Suíte de testes automatizados — CRUD administrativo (`tests/Feature/{Clients,Users,Customers,Roles}`)

Mesmo padrão do §3.8: `RefreshDatabase`, dados via factories, permissions/roles montadas ad-hoc por
teste (nunca via `RolesAndPermissionsSeeder`).

| Arquivo | Cobre |
|---|---|
| `Clients/ClientCrudTest.php` | CRUD completo de `Client`, `409` ao excluir com `Customer`s vinculados, `?per_page=` |
| `Users/UserCrudTest.php` | CRUD completo de `User`, roles via `role_ids`, senha opcional no update, `409` ao tentar excluir a própria conta, `403`/`401` |
| `Customers/CustomerCrudTest.php` | CRUD completo de `Customer`, `client_id` obrigatório/validado, senha opcional no update, `403`/`401` |
| `Roles/RoleIndexTest.php` | Listagem de roles (sem paginação), `403`/`401` |
```

- [ ] **Step 4: Verify the doc renders sensibly**

Run: `cd ../gespriority_claude && grep -n "^### " BACKEND_SPECS.md`
Expected: see `3.4.3`, `3.9` (or whatever numbers landed) alongside the existing `3.1`–`3.8` headings, in order, no duplicated numbers.

- [ ] **Step 5: Commit**

```bash
cd ../gespriority_claude
git add BACKEND_SPECS.md
git commit -m "docs: document User/Customer CRUD and customers.manage permission"
```

---

## Task 7: Frontend — API service wrappers

**Files:**
- Create: `src/services/clientService.js`
- Create: `src/services/userService.js`
- Create: `src/services/customerService.js`
- Create: `src/services/roleService.js`

**Interfaces:**
- Produces: each of `clientService`, `userService`, `customerService` exposes `list(params = {})`, `create(payload)`, `update(id, payload)`, `remove(id)` — all returning the parsed `res.data` (the Laravel envelope, e.g. `{data, links, meta}` for `list`, `{data}` for `create`/`update`). `roleService` exposes only `list()` → `{data}`. Consumed by every admin view/modal in Tasks 11–13.

No backend involved in this task — pure frontend wrappers around the existing `api` axios instance (`src/services/api.js`), same shape as `src/services/authService.js`.

- [ ] **Step 1: Create `clientService.js`**

```js
import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/clients', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/clients', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/clients/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/clients/${id}`)
  },
}
```

- [ ] **Step 2: Create `userService.js`**

```js
import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/users', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/users', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/users/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/users/${id}`)
  },
}
```

- [ ] **Step 3: Create `customerService.js`**

```js
import api from '@/services/api'

export default {
  list(params = {}) {
    return api.get('/customers', { params }).then((res) => res.data)
  },
  create(payload) {
    return api.post('/customers', payload).then((res) => res.data)
  },
  update(id, payload) {
    return api.put(`/customers/${id}`, payload).then((res) => res.data)
  },
  remove(id) {
    return api.delete(`/customers/${id}`)
  },
}
```

- [ ] **Step 4: Create `roleService.js`**

```js
import api from '@/services/api'

export default {
  list() {
    return api.get('/roles').then((res) => res.data)
  },
}
```

- [ ] **Step 5: Verify with a syntax/import check**

Run: `npm run build`
Expected: build succeeds (these files aren't imported anywhere yet, but this catches any syntax typos immediately rather than at Task 11+).

- [ ] **Step 6: Commit**

```bash
git add src/services/clientService.js src/services/userService.js src/services/customerService.js src/services/roleService.js
git commit -m "feat: add API service wrappers for clients, users, customers and roles"
```

---

## Task 8: Frontend — `AppLayout` drawer slot + admin menu entry

**Files:**
- Modify: `src/layouts/AppLayout.vue`

**Interfaces:**
- Produces: `AppLayout` now accepts an optional named slot `#drawer`. When absent (current `DashboardView`/`PortalView` usage), rendering is unchanged. When present, it's wrapped in a `<v-navigation-drawer permanent>` placed before `<v-main>`. Consumed by `AdminLayout` (Task 9).

- [ ] **Step 1: Add the drawer slot**

In `src/layouts/AppLayout.vue`, change:

```vue
  <v-main>
    <v-container class="py-8" style="max-width: 1100px">
      <slot />
    </v-container>
  </v-main>
```

to:

```vue
  <v-navigation-drawer v-if="$slots.drawer" permanent>
    <slot name="drawer" />
  </v-navigation-drawer>

  <v-main>
    <v-container class="py-8" style="max-width: 1100px">
      <slot />
    </v-container>
  </v-main>
```

- [ ] **Step 2: Add the "Administração" menu item**

In the same file, change:

```vue
      <v-list density="compact" min-width="240">
        <v-list-item :title="auth.user?.name" :subtitle="auth.user?.email" />
        <v-divider class="my-1" />
        <v-list-item
          prepend-icon="mdi-logout"
          title="Sair"
          :disabled="loggingOut"
          @click="handleLogout(false)"
        />
```

to:

```vue
      <v-list density="compact" min-width="240">
        <v-list-item :title="auth.user?.name" :subtitle="auth.user?.email" />
        <v-divider class="my-1" />
        <v-list-item
          v-if="auth.roles.includes('admin')"
          prepend-icon="mdi-shield-account"
          title="Administração"
          :to="{ name: 'admin' }"
        />
        <v-divider v-if="auth.roles.includes('admin')" class="my-1" />
        <v-list-item
          prepend-icon="mdi-logout"
          title="Sair"
          :disabled="loggingOut"
          @click="handleLogout(false)"
        />
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, log in as `admin@example.com` / `password` (staff seed user — see this repo's `README.md`), open the user menu (top-right avatar).
Expected: "Administração" item appears above "Sair", with a shield icon. Clicking it 404s for now (route `admin` doesn't exist until Task 9) — that's expected at this point.

Then log in as `agente@example.com` / `password`.
Expected: no "Administração" item, no stray divider.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/AppLayout.vue
git commit -m "feat: add optional drawer slot and admin menu entry to AppLayout"
```

---

## Task 9: Frontend — `AdminLayout` + admin routes + route guard

**Files:**
- Create: `src/layouts/AdminLayout.vue`
- Modify: `src/router/index.js`

**Interfaces:**
- Produces: route `admin` (path `/admin`, redirects to `admin-clients`) with children `admin-clients` (`/admin/clients`), `admin-users` (`/admin/users`), `admin-customers` (`/admin/customers`) — all rendered inside `AdminLayout`'s `<router-view/>`. `meta.requiresAdmin: true` on the parent is inherited by all children (Vue Router 4 merges matched-route `meta` across the whole matched chain). Consumed by Tasks 11–13 (the three leaf views must NOT wrap themselves in `AdminLayout` — the router already does that).

- [ ] **Step 1: Create `AdminLayout.vue`**

```vue
<script setup>
import AppLayout from '@/layouts/AppLayout.vue'

const items = [
  { title: 'Clientes', icon: 'mdi-domain', to: { name: 'admin-clients' } },
  { title: 'Usuários da Aplicação', icon: 'mdi-account-cog', to: { name: 'admin-users' } },
  { title: 'Usuários de Clientes', icon: 'mdi-account-group', to: { name: 'admin-customers' } },
]
</script>

<template>
  <AppLayout>
    <template #drawer>
      <v-list nav density="compact">
        <v-list-item
          v-for="item in items"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
        />
      </v-list>
    </template>

    <router-view />
  </AppLayout>
</template>
```

- [ ] **Step 2: Add the admin routes**

In `src/router/index.js`, add the following block right after the `/portal` route (`name: 'portal'`) and before the catch-all `{ path: '/:pathMatch(.*)*', ... }`:

```js
  // --- Administração (só role "admin", guard "web") ---
  {
    path: '/admin',
    name: 'admin',
    redirect: { name: 'admin-clients' },
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, guard: 'web', requiresAdmin: true },
    children: [
      {
        path: 'clients',
        name: 'admin-clients',
        component: () => import('@/views/admin/ClientsView.vue'),
      },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('@/views/admin/UsersView.vue'),
      },
      {
        path: 'customers',
        name: 'admin-customers',
        component: () => import('@/views/admin/CustomersView.vue'),
      },
    ],
  },
```

- [ ] **Step 3: Add the `requiresAdmin` guard check**

In the same file, inside `router.beforeEach`, change:

```js
  if (to.meta.requiresAuth) {
    if (!auth.isAuthenticated) {
      return { ...loginRouteFor(to.meta.guard), query: { redirect: to.fullPath } }
    }

    if (to.meta.guard && auth.guard !== to.meta.guard) {
      return homeRouteFor(auth.guard)
    }
  }
```

to:

```js
  if (to.meta.requiresAuth) {
    if (!auth.isAuthenticated) {
      return { ...loginRouteFor(to.meta.guard), query: { redirect: to.fullPath } }
    }

    if (to.meta.guard && auth.guard !== to.meta.guard) {
      return homeRouteFor(auth.guard)
    }

    if (to.meta.requiresAdmin && !auth.roles.includes('admin')) {
      return homeRouteFor(auth.guard)
    }
  }
```

- [ ] **Step 4: Verify manually**

Note: the three leaf views (`ClientsView`, `UsersView`, `CustomersView`) don't exist yet (Tasks 11–13) — for this step only, temporarily verify with a placeholder. Run: `npm run dev`, log in as `agente@example.com` / `password`, navigate the browser to `http://localhost:5173/admin/clients` directly.
Expected: redirected to `/dashboard` (non-admin blocked even via direct URL).

Then log in as `admin@example.com` / `password`, click "Administração" in the user menu.
Expected: navigates to `/admin/clients`, shows the left drawer with the 3 items (page content itself will show a blank/loading area or an import error until Task 11 exists — that's expected here; the important part is the drawer renders and the guard didn't block the admin user).

- [ ] **Step 5: Commit**

```bash
git add src/layouts/AdminLayout.vue src/router/index.js
git commit -m "feat: add /admin route tree gated to the admin role"
```

---

## Task 10: Frontend — shared `ConfirmDeleteDialog`

**Files:**
- Create: `src/components/admin/ConfirmDeleteDialog.vue`

**Interfaces:**
- Produces: `ConfirmDeleteDialog` — props `modelValue: Boolean`, `title?: String` (default `'Excluir registro'`), `message: String` (required), `loading?: Boolean`; emits `update:modelValue` (v-model) and `confirm`. Consumed by `ClientsView`, `UsersView`, `CustomersView` (Tasks 11–13).

- [ ] **Step 1: Create the component**

```vue
<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Excluir registro' },
  message: { type: String, required: true },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm'])
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="420"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">{{ title }}</v-card-title>
      <v-card-text>{{ message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancelar</v-btn>
        <v-btn color="error" variant="tonal" :loading="loading" @click="emit('confirm')">
          Excluir
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
```

- [ ] **Step 2: Verify with a build check**

Run: `npm run build`
Expected: succeeds (component isn't wired up anywhere yet, but this confirms no template/syntax errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ConfirmDeleteDialog.vue
git commit -m "feat: add shared ConfirmDeleteDialog for admin CRUD tables"
```

---

## Task 11: Frontend — Clients section (`ClientFormModal` + `ClientsView`)

**Files:**
- Create: `src/components/admin/ClientFormModal.vue`
- Create: `src/views/admin/ClientsView.vue`

**Interfaces:**
- Consumes: `clientService` (Task 7), `ConfirmDeleteDialog` (Task 10), `extractErrorMessage` from `src/utils/errors.js` (existing).
- Produces: `ClientsView` — the leaf component the router (Task 9) mounts at `admin-clients`. Do **not** wrap it in `AdminLayout` or `AppLayout` — the router's parent route (`AdminLayout`) already provides the chrome; this view is pure content.

- [ ] **Step 1: Create `ClientFormModal.vue`**

```vue
<script setup>
import { ref, watch } from 'vue'
import clientService from '@/services/clientService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  client: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const name = ref('')
const loading = ref(false)
const errorMessage = ref('')

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = props.client?.name ?? ''
    errorMessage.value = ''
  },
)

function close() {
  emit('update:modelValue', false)
}

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  try {
    if (props.client) {
      await clientService.update(props.client.id, { name: name.value })
    } else {
      await clientService.create({ name: name.value })
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o cliente.')
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
        {{ client ? 'Editar cliente' : 'Novo cliente' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="name" label="Nome" required autofocus />
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

- [ ] **Step 2: Create `ClientsView.vue`**

```vue
<script setup>
import { ref, onMounted } from 'vue'
import ClientFormModal from '@/components/admin/ClientFormModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import clientService from '@/services/clientService'
import { extractErrorMessage } from '@/utils/errors'

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
]

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)

const formOpen = ref(false)
const editingClient = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const clientToDelete = ref(null)

async function loadClients() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await clientService.list({ page: page.value, per_page: itemsPerPage.value })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os clientes.')
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadClients()
}

function openCreate() {
  editingClient.value = null
  formOpen.value = true
}

function openEdit(client) {
  editingClient.value = client
  formOpen.value = true
}

function askDelete(client) {
  clientToDelete.value = client
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await clientService.remove(clientToDelete.value.id)
    deleteOpen.value = false
    await loadClients()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o cliente.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}

onMounted(loadClients)
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Clientes</h1>
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Novo cliente</v-btn>
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
    <template #item.actions="{ item }">
      <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(item)" />
      <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
    </template>
  </v-data-table-server>

  <ClientFormModal v-model="formOpen" :client="editingClient" @saved="loadClients" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message="`Excluir o cliente &quot;${clientToDelete?.name}&quot;? Essa ação não pode ser desfeita.`"
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
```

- [ ] **Step 3: Verify manually end-to-end**

Prerequisite: backend Task 1 deployed (per_page support isn't required here, but the base `Client` CRUD from before this whole plan already works).

Run: `npm run dev` (frontend) with the backend running (`docker compose up -d` in `../gespriority_claude`). Log in as `admin@example.com` / `password`, go to Administração → Clientes.
Expected: table loads (possibly empty), "Novo cliente" opens a modal, saving a name adds a row, the pencil icon opens the same modal pre-filled, the trash icon opens a confirm dialog and deleting removes the row. Creating with an empty name shows a validation error inline (422 message).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/ClientFormModal.vue src/views/admin/ClientsView.vue
git commit -m "feat: add Clients admin section (table + form modal)"
```

---

## Task 12: Frontend — Users section (`UserFormModal` + `UsersView`)

**Files:**
- Create: `src/components/admin/UserFormModal.vue`
- Create: `src/views/admin/UsersView.vue`

**Interfaces:**
- Consumes: `userService`, `roleService` (Task 7), `ConfirmDeleteDialog` (Task 10), `extractErrorMessage`.
- Produces: `UsersView`, the leaf component mounted at `admin-users`. Same "no layout wrapper" rule as Task 11.

**Requires:** backend Tasks 3 and 4 deployed (`GET /api/roles`, `User` CRUD) — this task will 404 against the current backend until those are done.

- [ ] **Step 1: Create `UserFormModal.vue`**

```vue
<script setup>
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

function close() {
  emit('update:modelValue', false)
}

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  const payload = {
    name: name.value,
    email: email.value,
    role_ids: roleIds.value,
    ...(password.value ? { password: password.value } : {}),
  }

  try {
    if (props.user) {
      await userService.update(props.user.id, payload)
    } else {
      await userService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o usuário.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">
        {{ user ? 'Editar usuário' : 'Novo usuário' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="name" label="Nome" required autofocus class="mb-2" />
          <v-text-field v-model="email" label="E-mail" type="email" required class="mb-2" />
          <v-text-field
            v-model="password"
            :label="user ? 'Nova senha (opcional)' : 'Senha'"
            type="password"
            :required="!user"
            class="mb-2"
          />
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

- [ ] **Step 2: Create `UsersView.vue`**

```vue
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
    :message="`Excluir o usuário &quot;${userToDelete?.name}&quot;? Essa ação não pode ser desfeita.`"
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
```

- [ ] **Step 3: Verify manually end-to-end**

Run: `npm run dev` with backend running. Log in as `admin@example.com` / `password`, go to Administração → Usuários da Aplicação.
Expected: table shows the seeded staff users with role chips; "Novo usuário" lets you create one with a name/email/password and pick roles; editing an existing user shows its current roles pre-selected and lets you leave the password blank to keep it unchanged; deleting a user other than yourself works; attempting to delete your own logged-in account (`admin@example.com`) shows the 409 error message from the backend instead of removing the row.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/UserFormModal.vue src/views/admin/UsersView.vue
git commit -m "feat: add Users admin section (table + form modal with role picker)"
```

---

## Task 13: Frontend — Customers section (`CustomerFormModal` + `CustomersView`)

**Files:**
- Create: `src/components/admin/CustomerFormModal.vue`
- Create: `src/views/admin/CustomersView.vue`

**Interfaces:**
- Consumes: `customerService`, `clientService` (Task 7), `ConfirmDeleteDialog` (Task 10), `extractErrorMessage`.
- Produces: `CustomersView`, the leaf component mounted at `admin-customers`. Same "no layout wrapper" rule as Task 11.

**Requires:** backend Task 5 deployed (`Customer` CRUD) and Task 1 (`?per_page=` on `/clients`, used here to fetch the full client list for the select) — this task will 404/truncate against the current backend until those are done.

- [ ] **Step 1: Create `CustomerFormModal.vue`**

```vue
<script setup>
import { ref, watch } from 'vue'
import customerService from '@/services/customerService'
import clientService from '@/services/clientService'
import { extractErrorMessage } from '@/utils/errors'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  customer: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const name = ref('')
const email = ref('')
const password = ref('')
const clientId = ref(null)
const clientOptions = ref([])
const loading = ref(false)
const errorMessage = ref('')

async function loadClients() {
  const { data } = await clientService.list({ per_page: 200 })
  clientOptions.value = data
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    errorMessage.value = ''
    password.value = ''
    name.value = props.customer?.name ?? ''
    email.value = props.customer?.email ?? ''
    clientId.value = props.customer?.client?.id ?? null

    await loadClients()
  },
)

function close() {
  emit('update:modelValue', false)
}

async function onSubmit() {
  errorMessage.value = ''
  loading.value = true

  const payload = {
    name: name.value,
    email: email.value,
    client_id: clientId.value,
    ...(password.value ? { password: password.value } : {}),
  }

  try {
    if (props.customer) {
      await customerService.update(props.customer.id, payload)
    } else {
      await customerService.create(payload)
    }
    emit('saved')
    close()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível salvar o usuário do cliente.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 font-weight-bold">
        {{ customer ? 'Editar usuário de cliente' : 'Novo usuário de cliente' }}
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="onSubmit">
          <v-alert v-if="errorMessage" type="error" variant="tonal" density="comfortable" class="mb-4">
            {{ errorMessage }}
          </v-alert>

          <v-text-field v-model="name" label="Nome" required autofocus class="mb-2" />
          <v-text-field v-model="email" label="E-mail" type="email" required class="mb-2" />
          <v-text-field
            v-model="password"
            :label="customer ? 'Nova senha (opcional)' : 'Senha'"
            type="password"
            :required="!customer"
            class="mb-2"
          />
          <v-select
            v-model="clientId"
            :items="clientOptions"
            item-title="name"
            item-value="id"
            label="Cliente (empresa)"
            required
          />
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

- [ ] **Step 2: Create `CustomersView.vue`**

```vue
<script setup>
import { ref, onMounted } from 'vue'
import CustomerFormModal from '@/components/admin/CustomerFormModal.vue'
import ConfirmDeleteDialog from '@/components/admin/ConfirmDeleteDialog.vue'
import customerService from '@/services/customerService'
import { extractErrorMessage } from '@/utils/errors'

const headers = [
  { title: 'Nome', key: 'name' },
  { title: 'E-mail', key: 'email' },
  { title: 'Cliente', key: 'client.name' },
  { title: 'Ações', key: 'actions', sortable: false, align: 'end' },
]

const items = ref([])
const totalItems = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const page = ref(1)
const itemsPerPage = ref(15)

const formOpen = ref(false)
const editingCustomer = ref(null)

const deleteOpen = ref(false)
const deleting = ref(false)
const customerToDelete = ref(null)

async function loadCustomers() {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, meta } = await customerService.list({ page: page.value, per_page: itemsPerPage.value })
    items.value = data
    totalItems.value = meta.total
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível carregar os usuários de clientes.')
  } finally {
    loading.value = false
  }
}

function onOptionsUpdate({ page: newPage, itemsPerPage: newItemsPerPage }) {
  page.value = newPage
  itemsPerPage.value = newItemsPerPage
  loadCustomers()
}

function openCreate() {
  editingCustomer.value = null
  formOpen.value = true
}

function openEdit(customer) {
  editingCustomer.value = customer
  formOpen.value = true
}

function askDelete(customer) {
  customerToDelete.value = customer
  deleteOpen.value = true
}

async function confirmDelete() {
  deleting.value = true

  try {
    await customerService.remove(customerToDelete.value.id)
    deleteOpen.value = false
    await loadCustomers()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, 'Não foi possível excluir o usuário do cliente.')
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}

onMounted(loadCustomers)
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-4">
    <h1 class="text-h5 font-weight-bold">Usuários de Clientes</h1>
    <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Novo usuário de cliente</v-btn>
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
    <template #item.actions="{ item }">
      <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEdit(item)" />
      <v-btn icon="mdi-delete" variant="text" size="small" color="error" @click="askDelete(item)" />
    </template>
  </v-data-table-server>

  <CustomerFormModal v-model="formOpen" :customer="editingCustomer" @saved="loadCustomers" />

  <ConfirmDeleteDialog
    v-model="deleteOpen"
    :message="`Excluir o usuário &quot;${customerToDelete?.name}&quot;? Essa ação não pode ser desfeita.`"
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
```

- [ ] **Step 3: Verify manually end-to-end**

Run: `npm run dev` with backend running. Log in as `admin@example.com` / `password`, go to Administração → Usuários de Clientes.
Expected: table shows customers with their client name in the "Cliente" column; "Novo usuário de cliente" opens a modal with a client select populated from every seeded `Client`; creating/editing/deleting all work the same way as Clients/Users; creating with `client_id` left empty shows a validation error.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/CustomerFormModal.vue src/views/admin/CustomersView.vue
git commit -m "feat: add Customers admin section (table + form modal with client picker)"
```

---

## Task 14: End-to-end manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full regression pass as admin**

With both `docker compose up -d` (backend) and `npm run dev` (frontend) running, log in as `admin@example.com` / `password` and walk through:
1. Dashboard still loads normally (unaffected by `AppLayout`'s new optional slot).
2. Administração → Clientes: create, edit, delete a client; deleting a client that has `Customer`s attached still shows the pre-existing 409 error.
3. Administração → Usuários da Aplicação: create a user with 2 roles, edit it to remove one role, confirm the chips update; try deleting your own account and confirm the 409 message shows instead of the row disappearing.
4. Administração → Usuários de Clientes: create a customer under an existing client, edit it to move it to a different client, delete it.
5. Pagination: seed or create >15 rows in any one section and confirm the data table's page controls work (`v-data-table-server` page/items-per-page).

- [ ] **Step 2: Access-control regression pass as non-admin**

Log in as `agente@example.com` / `password`:
1. No "Administração" item in the user menu.
2. Navigating directly to `/admin`, `/admin/clients`, `/admin/users`, `/admin/customers` redirects to `/dashboard` every time.

Log in as the `customer` guard (`cliente@example.com` / `password` via `/portal/login`):
1. `/portal` still works unaffected.
2. Navigating to `/admin/clients` redirects to `/portal` (guard mismatch, same as any other staff-only route).

- [ ] **Step 3: Backend full test suite**

Run: `cd ../gespriority_claude && docker compose exec app php artisan test`
Expected: PASS — every test from Tasks 1–5 plus the pre-existing `Auth`/`Clients` suites, all green.

- [ ] **Step 4: Final commit (only if Step 1–3 uncovered fixes)**

If any of the manual passes above required a code fix, commit it now with a message describing what was wrong; otherwise there's nothing to commit for this task — it's a verification gate, not a code task.
