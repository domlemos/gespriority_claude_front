# upITSM — Frontend

SPA em Vue 3 + Vuetify para o backend em [`../gespriority_claude`](../gespriority_claude). Cobre o módulo de autenticação: login/logout/refresh, recuperação de senha e um painel autenticado, para os dois guards do backend — `web` (equipe interna) e `customer` (portal do cliente).

## Stack

- Vue 3 (`<script setup>`) + Vue Router + Pinia
- Vuetify 4, tema com a paleta extraída de `login.uplexis.com`
- Axios com interceptors (Bearer token automático, logout em 401)

## Rodando localmente

1. `npm install`
2. Copiar `.env.example` para `.env` e ajustar `VITE_API_URL` se o backend não estiver em `http://localhost:8000/api`.
3. Backend rodando (`docker compose up -d` em `../gespriority_claude`) e com `FRONTEND_URL=http://localhost:5173` no `.env` dele — é o que a whitelist de CORS usa.
4. `npm run dev` — abre em `http://localhost:5173`.

## Rotas

| Rota | Guard | Descrição |
|---|---|---|
| `/login` | `web` | Login da equipe interna |
| `/forgot-password`, `/reset-password` | `web` | Recuperação de senha (staff) |
| `/dashboard` | `web` (autenticado) | Painel interno |
| `/portal/login` | `customer` | Login do portal do cliente |
| `/portal/forgot-password`, `/portal/reset-password` | `customer` | Recuperação de senha (cliente) |
| `/portal` | `customer` (autenticado) | Painel do cliente |

O guard de navegação (`src/router/index.js`) impede acesso cruzado — um usuário `customer` autenticado não acessa `/dashboard`, e vice-versa.

## Sessão

O token fica em `sessionStorage` (não `localStorage`, para reduzir exposição a XSS — ver seção 1.3 do `BACKEND_SPECS.md` do backend) e é renovado proativamente aos 80% do TTL via `POST /api/refresh` (`src/stores/auth.js`).

## Credenciais de teste (seed do backend)

Todas com senha `password`:

| E-mail | Guard |
|---|---|
| `admin@example.com` | `web` (role admin) |
| `supervisor@example.com` | `web` (role supervisor) |
| `agente@example.com` | `web` (role agente) |
| `cliente@example.com` | `customer` |
# gespriority_claude_front
