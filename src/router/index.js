import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  // Sem `redirect` estático aqui de propósito: a opção `redirect` é resolvida
  // ANTES dos guards globais (`beforeEach`) rodarem, ou seja, antes da sessão
  // ser hidratada do sessionStorage — resultaria num "pisca" para /login antes
  // de corrigir para /dashboard. O redirect de "/" é tratado no beforeEach,
  // depois de `auth.hydrate()`.
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
    await auth.hydrate()
  }

  if (to.name === 'root') {
    return auth.isAuthenticated ? homeRouteFor(auth.guard) : loginRouteFor('web')
  }

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

    if (to.meta.requiresPermission && !auth.hasPermission(to.meta.requiresPermission)) {
      return homeRouteFor(auth.guard)
    }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return homeRouteFor(auth.guard)
  }

  return true
})

export default router
