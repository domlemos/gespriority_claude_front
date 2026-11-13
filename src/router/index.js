import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  // Sem `redirect` estático aqui de propósito: a opção `redirect` é resolvida
  // ANTES dos guards globais (`beforeEach`) rodarem, ou seja, antes de a
  // sessão ser conferida com o backend — resultaria num "pisca" para /login
  // antes de corrigir para /dashboard. O redirect de "/" é tratado no
  // beforeEach, depois de `auth.conferir()`.
  {
    path: '/',
    name: 'root',
    component: () => import('@/views/NotFoundView.vue'),
  },

  // --- Staff (guard "web") ---
  {
    path: '/login',
    name: 'staff-login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true, guard: 'web' },
  },
  {
    path: '/forgot-password',
    name: 'staff-forgot-password',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { guestOnly: true, guard: 'web' },
  },
  {
    path: '/reset-password',
    name: 'staff-reset-password',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { guestOnly: true, guard: 'web' },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true, guard: 'web' },
  },
  {
    // A abertura de chamado é uma modal no painel; a rota só mantém
    // funcionando links antigos, abrindo o painel com a modal aberta.
    path: '/incidents/new',
    name: 'incident-new',
    redirect: { name: 'dashboard', query: { novo: '1' } },
  },
  {
    path: '/incidents/:id',
    name: 'incident-edit',
    component: () => import('@/views/IncidentFormView.vue'),
    props: true,
    meta: { requiresAuth: true, guard: 'web' },
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('@/views/ReportsView.vue'),
    meta: { requiresAuth: true, guard: 'web', requiresPermission: 'relatorios.view' },
  },

  // --- Cliente (guard "customer") ---
  {
    path: '/portal/login',
    name: 'customer-login',
    component: () => import('@/views/CustomerLoginView.vue'),
    meta: { guestOnly: true, guard: 'customer' },
  },
  {
    path: '/portal/forgot-password',
    name: 'customer-forgot-password',
    component: () => import('@/views/ForgotPasswordView.vue'),
    meta: { guestOnly: true, guard: 'customer' },
  },
  {
    path: '/portal/reset-password',
    name: 'customer-reset-password',
    component: () => import('@/views/ResetPasswordView.vue'),
    meta: { guestOnly: true, guard: 'customer' },
  },
  {
    path: '/portal',
    name: 'portal',
    component: () => import('@/views/PortalView.vue'),
    meta: { requiresAuth: true, guard: 'customer' },
  },
  // Abrir e ver chamado são modais sobre a lista do portal (o chamado aberto
  // fica em `?chamado=N`); estas rotas só mantêm funcionando links antigos.
  {
    path: '/portal/incidentes/novo',
    name: 'portal-incident-new',
    redirect: { name: 'portal', query: { novo: '1' } },
  },
  {
    path: '/portal/incidentes/:id(\\d+)',
    name: 'portal-incident',
    redirect: (to) => ({ name: 'portal', query: { chamado: to.params.id } }),
  },

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
      {
        path: 'audit-logs',
        name: 'admin-audit-logs',
        component: () => import('@/views/admin/AuditLogsView.vue'),
      },
    ],
  },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

function loginRouteFor(guard) {
  return guard === 'customer' ? { name: 'customer-login' } : { name: 'staff-login' }
}

function homeRouteFor(guard) {
  return guard === 'customer' ? { name: 'portal' } : { name: 'dashboard' }
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (!auth.hydrated) {
    auth.hydrate()
  }

  // A sessão é um cookie HttpOnly que o front não lê: confere com o backend
  // se há sessão do perfil da rota (uma vez por carga da aplicação).
  if (to.meta.guard) {
    await auth.conferir(to.meta.guard)
  }

  if (to.name === 'root') {
    if ((await auth.conferir('web')) || (await auth.conferir('customer'))) {
      return homeRouteFor(auth.guard)
    }
    return loginRouteFor('web')
  }

  if (to.meta.requiresAuth) {
    // Sem sessão do perfil desta rota (mesmo que haja do outro): login dele.
    if (!auth.isAuthenticated || (to.meta.guard && auth.guard !== to.meta.guard)) {
      return { ...loginRouteFor(to.meta.guard), query: { redirect: to.fullPath } }
    }

    if (to.meta.requiresAdmin && !auth.roles.includes('admin')) {
      return homeRouteFor(auth.guard)
    }

    if (to.meta.requiresPermission && !auth.hasPermission(to.meta.requiresPermission)) {
      return homeRouteFor(auth.guard)
    }
  }

  if (to.meta.guestOnly && auth.isAuthenticated && (!to.meta.guard || auth.guard === to.meta.guard)) {
    return homeRouteFor(auth.guard)
  }

  return true
})

export default router
