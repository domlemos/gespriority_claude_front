import axios from 'axios'

// Token CSRF da sessão (Sanctum SPA): vem de GET /csrf-token e vai no header
// X-CSRF-TOKEN de toda escrita. Fica só em memória — não é credencial (sem o
// cookie HttpOnly de sessão ele não serve para nada), e o backend o renova
// no login/logout. Ver BACKEND_SPECS.md §1.3.
let token = null
let buscando = null

export function definirCsrf(novo) {
  token = novo
}

export function csrfAtual() {
  return token
}

export async function garantirCsrf(baseURL, { renovar = false } = {}) {
  if (token && !renovar) return token
  buscando ??= axios
    .get(`${baseURL}/csrf-token`, { withCredentials: true, headers: { Accept: 'application/json' } })
    .then((res) => {
      token = res.data.csrf_token
      return token
    })
    .finally(() => {
      buscando = null
    })
  return buscando
}
