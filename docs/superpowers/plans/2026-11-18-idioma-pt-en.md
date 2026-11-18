# Seletor de idioma PT-BR / EN — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interface do upITSM traduzível entre PT-BR e EN com um seletor no menu superior e nas telas de autenticação, só no frontend.

**Architecture:** `vue-i18n` (Composition API, `legacy: false`) com um JSON por idioma em `src/locales/`; o Vuetify usa a mesma instância via `createVueI18nAdapter`. Textos fora de componentes (`src/utils`, `reportService`) leem `i18n.global.t` em tempo de chamada, então todo rótulo é função e toda lista com texto vira `computed`. Datas/números passam por um helper que lê o idioma ativo e mantém as opções de hoje. Um script Node (`scripts/check-locales.mjs`) é o "teste": paridade de chaves, compilação das mensagens e varredura de texto fixo em português.

**Tech Stack:** Vue 3 `<script setup>`, Vuetify 4.1.4, Pinia, Vite 8, `vue-i18n@^11` (11.4.22 na data do plano).

**Spec:** `docs/superpowers/specs/2026-11-18-idioma-pt-en-design.md` — leia antes de qualquer tarefa.

## Global Constraints

- Node: rode `source ~/.nvm/nvm.sh && nvm use 22.14.0` antes de `npm`/`node` (Node 18 padrão quebra o build).
- Trabalho direto em `main`, um commit por tarefa, mensagem em português no padrão `feat(i18n): …`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Idiomas: exatamente `pt-BR` e `en`. `fallbackLocale: 'pt-BR'`. Chave de storage: `upITSM.locale`.
- **PT-BR idêntico ao atual:** o texto em `pt-BR.json` é copiado byte a byte do código atual (acentos, maiúsculas, pontuação, `—`). A única mudança visível em PT-BR aprovada é o texto interno do Vuetify (rodapé de tabela, "No data available") passar a português.
- **Datas idênticas em PT-BR:** cada ponto mantém as opções de formatação que usa hoje; só o locale passa a ser o ativo.
- EN: inglês americano, direto, mesmo tom curto do PT.
- **Não traduzir** o que vem da API: `message`/`errors` do Laravel, `rotulo`/`titulo` de relatórios, nomes cadastrados, títulos de chamados, planilhas.
- Sintaxe do vue-i18n: `{ } @ $ |` são especiais em mensagens. Literal desses caracteres usa interpolação literal: `{'@'}`, `{'{'}`, `{'|'}`. Interpolação: `{nome}`. Plural: `"um | muitos"` com `t(key, n)` (o vue-i18n injeta `{n}`).
- Chaves: camelCase, agrupadas por área — `common.*`, `nav.*`, `locale.*`, `auth.*`, `notFound.*`, `incidents.*`, `portal.*`, `reports.*`, `admin.<entidade>.*`, `labels.*`, `errors.*`, `duration.*`, `attachments.*`. Texto repetido em várias telas (Salvar, Cancelar, Fechar, Excluir, Editar, Ações, Filtrar, Limpar filtros…) vai em `common.*`, não duplicado.
- Reatividade: em template use `$t(...)`/`t(...)` direto. Em `<script setup>`, qualquer constante com texto (headers de `v-data-table`, `items` de select, títulos de gráfico, regras de validação montadas como array) vira `computed(() => …)` usando `const { t } = useI18n()`. Mensagens guardadas em `ref` no momento de um evento (snackbar, `errorMessage`) podem ficar no idioma em que foram geradas — aceito.
- Fallbacks de `extractErrorMessage(error, '…')` viram `extractErrorMessage(error, t('…'))`.
- Toda tarefa termina com `node scripts/check-locales.mjs` (paridade + compilação) **e** `node scripts/check-locales.mjs --scan <arquivos da tarefa>` sem achados **e** `npm run build` OK.

## Review Focus

1. **Troca de idioma com tela aberta** — cabeçalhos de tabela, opções de select e títulos de gráfico devem mudar na hora. Constante não-`computed` é o bug mais provável. Cada tarefa de tela tem o passo "trocar idioma com a tela aberta e conferir".
2. **Mensagem com `@`, `{` ou `|` literal** (ex.: placeholder `nome@empresa.com`) quebra a compilação ou some em runtime. Coberto pela compilação de todas as mensagens no script (Task 1).
3. **Storage indisponível** (aba anônima/bloqueio) — app deve abrir pela detecção do navegador e a troca deve funcionar na sessão. Teste manual na Task 1.
4. **Chave faltando em um dos idiomas** mostraria a chave crua. Coberto pela paridade no script; `missingWarn` em dev.
5. **Data/número em PT-BR mudando de formato** sem querer (perder segundos, vírgula, casas decimais). Cada tarefa que toca data compara a saída em PT-BR com a anterior.

---

### Task 1: Infraestrutura, seletor e layouts

**Files:**
- Modify: `package.json` (dep `vue-i18n`)
- Create: `src/plugins/i18n.js`
- Create: `src/locales/pt-BR.json`, `src/locales/en.json`
- Create: `src/utils/format.js`
- Create: `src/components/LocaleSwitcher.vue`
- Create: `scripts/check-locales.mjs`
- Modify: `src/main.js`, `src/plugins/vuetify.js`, `vite.config.js`
- Modify: `src/layouts/AppLayout.vue`, `src/layouts/AuthLayout.vue`, `src/layouts/AdminLayout.vue` (seletor + traduzir todo texto fixo dos três layouts)

**Interfaces:**
- Produces (`src/plugins/i18n.js`):
  - `export const SUPPORTED_LOCALES = ['pt-BR', 'en']`
  - `export function detectInitialLocale(): 'pt-BR' | 'en'` — storage válido → ele; senão `navigator.language` começando com `pt` (case-insensitive) → `'pt-BR'`; senão `'en'`. Leitura do storage em try/catch.
  - `export function setLocale(locale: 'pt-BR' | 'en'): void` — ignora valor fora de `SUPPORTED_LOCALES`; atualiza `i18n.global.locale.value`, grava storage (try/catch), seta `document.documentElement.lang`.
  - `export function currentLocale(): 'pt-BR' | 'en'` — lê `i18n.global.locale.value` (leitura reativa).
  - `export function t(...args)` — repasse para `i18n.global.t`, para uso em `src/utils` e services.
  - `export default i18n` — `createI18n({ legacy: false, globalInjection: true, locale: detectInitialLocale(), fallbackLocale: 'pt-BR', messages, missingWarn: import.meta.env.DEV, fallbackWarn: import.meta.env.DEV })`; `messages` = JSON de cada idioma mesclado com `$vuetify: pt` / `$vuetify: en` de `vuetify/locale`. Na carga do módulo, seta `document.documentElement.lang` para o locale inicial.
- Produces (`src/utils/format.js`), todas usam `currentLocale()` e repassam `options` sem alterar:
  - `formatDateTime(value: string | Date, options?: Intl.DateTimeFormatOptions): string` = `new Date(value).toLocaleString(locale, options)`
  - `formatDate(value: string | Date, options?): string` = `toLocaleDateString`
  - `formatNumber(value: number, options?: Intl.NumberFormatOptions): string` = `Number(value).toLocaleString`
  - Não tratam null — quem chama mantém o `iso ? … : '—'` de hoje.
- Produces: `<LocaleSwitcher />` sem props.
- Produces: `scripts/check-locales.mjs` (contrato abaixo).

- [ ] **Step 1: Instalar dependência**

Run: `npm install vue-i18n@^11`
Expected: `vue-i18n` em `dependencies` do `package.json`.

- [ ] **Step 2: Escrever `scripts/check-locales.mjs`**

Contrato (Node ESM, sem dependências além das já instaladas):
- Sem argumentos: carrega `src/locales/pt-BR.json` e `src/locales/en.json`, achata as chaves (`a.b.c`), imprime `faltando em en: <chave>` / `faltando em pt-BR: <chave>`; compila cada mensagem com `baseCompile` de `@intlify/message-compiler` (dependência transitiva do vue-i18n; se não resolver, `npm ls @intlify/message-compiler` e importar pelo caminho que existir) passando `onError`, imprimindo `erro de compilação [<locale>] <chave>: <mensagem>`. Sai com código 1 se houver qualquer achado; senão imprime `locales OK (<n> chaves)`.
- `--scan <arquivo|pasta>...`: percorre `.vue` e `.js` dos caminhos e imprime `<arquivo>:<linha>: <trecho>` para:
  1. Em `<template>` de `.vue`: depois de remover `<!-- … -->` e `{{ … }}`, todo trecho de texto entre tags (tag = `<(?:[^>"']|"[^"]*"|'[^']*')*>`) que tenha letra (`[A-Za-zÀ-ÿ]`).
  2. Em `<template>`: atributos **estáticos** (precedidos de espaço, não de `:`) `title|label|placeholder|text|hint|subtitle|no-data-text|loading-text|alt|aria-label|prefix|suffix|prepend-text|append-text|confirm-text` com valor contendo letra.
  3. Em `<script>` de `.vue` e em `.js`: depois de remover comentários, literais de string (`'…'`, `"…"`, `` `…` ``) contendo `[À-ÿ]`.
  4. Qualquer `'pt-BR'` literal fora de `src/plugins/i18n.js`.
  - Ignora a linha que contém `i18n-ignore` e textos exatamente iguais a `upITSM`.
  - Sai com código 1 se houver achado; senão `scan OK`.

- [ ] **Step 3: Rodar o script contra o estado atual**

Run: `node scripts/check-locales.mjs --scan src/layouts`
Expected: FAIL, listando os textos fixos dos três layouts (ex.: `src/layouts/AppLayout.vue:47: Incidentes`, `…: Sair de todos os dispositivos`, `src/layouts/AuthLayout.vue:18: Gestão de chamados, sem enrolação.`).

(Sem argumentos falha também, pois os JSON ainda não existem — esperado.)

- [ ] **Step 4: Criar `src/plugins/i18n.js`, os JSON e `src/utils/format.js`**

JSON começam com `common.*` básicos, `locale.ptBR = "Português (BR)"` e `locale.en = "English"` nos **dois** arquivos (nome sempre no próprio idioma), `locale.label` ("Idioma" / "Language", usado no aria-label/tooltip do botão).

`vite.config.js`: adicionar `define: { __VUE_I18N_FULL_INSTALL__: true, __VUE_I18N_LEGACY_API__: false, __INTLIFY_PROD_DEVTOOLS__: false }`.

`src/main.js`: `app.use(i18n)` antes de `app.use(vuetify)`.

`src/plugins/vuetify.js`: `locale: { adapter: createVueI18nAdapter({ i18n, useI18n }) }` com `createVueI18nAdapter` de `vuetify/locale/adapters/vue-i18n` e `useI18n` de `vue-i18n`.

- [ ] **Step 5: Criar `LocaleSwitcher.vue`**

`v-menu` com ativador `v-btn variant="text" class="text-none"` contendo `v-icon icon="mdi-translate"` + sigla (`PT` para `pt-BR`, `EN` para `en`), `aria-label` = `t('locale.label')`. Lista com os dois itens (títulos `t('locale.ptBR')`, `t('locale.en')`), item ativo marcado com `:active`, clique chama `setLocale`.

- [ ] **Step 6: Layouts**

- `AppLayout.vue`: `<LocaleSwitcher class="mr-1" />` imediatamente antes do `v-menu` do avatar (depois do `v-spacer`). Traduzir abas, chip "Portal do Cliente" e itens do menu do avatar.
- `AuthLayout.vue`: seletor no canto superior direito da coluna do formulário (`.auth-layout__form` vira `position: relative`; seletor `position: absolute; top: 16px; right: 16px`). Traduzir o painel da marca (título, parágrafo, `alt` da imagem).
- `AdminLayout.vue`: traduzir subheaders e itens do menu lateral.

- [ ] **Step 7: Verificar**

Run: `node scripts/check-locales.mjs && node scripts/check-locales.mjs --scan src/layouts src/components/LocaleSwitcher.vue src/plugins src/utils/format.js && npm run build`
Expected: `locales OK (…)`, `scan OK`, build sem erros.

- [ ] **Step 8: Conferência manual (`npm run dev`)**

- Navegador em português, storage limpo → abre em PT; `<html lang="pt-BR">`; layouts com o texto de antes; rodapé das tabelas agora "Itens por página".
- Trocar para English → abas, menu do avatar, menu admin e rodapé de tabela mudam na hora; `<html lang="en">`; recarregar mantém EN.
- `localStorage.removeItem('upITSM.locale')` + navegador em inglês → abre em EN.
- Aba anônima com storage bloqueado (ou `localStorage` sobrescrito para lançar) → abre sem erro e a troca funciona na sessão.
- Tela de login: seletor visível no canto, não cobre o card em largura de celular (360px).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.js scripts/check-locales.mjs src/plugins src/locales src/utils/format.js src/components/LocaleSwitcher.vue src/main.js src/layouts
git commit -m "feat(i18n): infraestrutura vue-i18n, seletor de idioma e layouts traduzidos"
```

---

### Task 2: Utilitários e rótulos compartilhados

**Files:**
- Modify: `src/utils/incidentLabels.js`, `src/utils/duration.js`, `src/utils/reportPeriod.js`, `src/utils/attachmentRules.js`, `src/utils/errors.js`, `src/services/reportService.js`
- Modify (só os pontos de uso dessas APIs, não o resto do texto da tela): `src/components/IncidentViewModal.vue`, `src/views/IncidentFormView.vue`, `src/views/PortalView.vue`, `src/components/PortalIncidentModal.vue`, `src/components/IncidentCreateModal.vue`, `src/components/reports/ReportTicketListDialog.vue`, `src/components/admin/ItemFormModal.vue`, `src/components/reports/AdvancedReportPanel.vue`, `src/views/admin/SlasView.vue`, `src/views/DashboardView.vue`, `src/components/IncidentAdvancedFilterModal.vue`, `src/components/reports/ReportResultTable.vue`, `src/components/reports/IndicadoresPanel.vue`, `src/components/reports/ReportPeriodControls.vue` e qualquer outro que `grep` encontrar importando os nomes removidos.

**Interfaces:**
- Consumes: `t` de `@/plugins/i18n`.
- Produces (`src/utils/incidentLabels.js`) — os `*_COLORS` ficam como estão; os `*_LABELS` são **removidos** e substituídos por:
  - `prioridadeLabel(code)`, `statusLabel(code)`, `origemLabel(code)`, `tipoLabel(code)`, `slaStatusLabel(code)`: `string` — tradução de `labels.<grupo>.<code>`, ou o próprio `code` se não houver chave (mesmo comportamento do `?? code` atual). Grupos: `prioridade`, `status`, `origem`, `tipo`, `slaStatus`.
  - `prioridadeOptions()`, `statusOptions()`, `origemOptions()`, `tipoOptions()`: `Array<{ value, title }>` na ordem atual dos mapas.
  - `formatRemainingMinutes(minutes)` — mesma assinatura; usa `labels.remaining.late` ("Atrasado {duration}") e `labels.remaining.left` ("{duration} restantes").
- Produces (`src/utils/duration.js`): `formatDurationMinutes(minutes)` — mesma assinatura; plurais `duration.days` ("{n} dia | {n} dias"), `duration.hours`, `duration.minutes`; junção final `duration.list` ("{rest} e {last}" / "{rest} and {last}"), separador entre os demais continua `', '`.
- Produces (`src/utils/reportPeriod.js`): `QUEBRA_OPTIONS`/`PERIODO_OPTIONS`/`QUEBRA_NOMES` removidos → `quebraOptions()`, `periodoOptions()`: `Array<{ value, title }>`; `validarQuebra(...)` mesma assinatura, mensagens em `reports.quebra.*` com `{nome}`/`{limite}`. `QUEBRA_LIMITES`, `contarColunas`, `parseDia`, `paramsPeriodo` intactos.
- Produces (`src/utils/attachmentRules.js`): `attachmentError(file)` mesma assinatura, mensagens `attachments.invalidType` (`{name}`, `{types}`) e `attachments.tooLarge` (`{name}`).
- Produces (`src/utils/errors.js`): `extractErrorMessage(error, fallback?)` — `fallback` default vira `t('errors.generic')` resolvido na chamada; 429 → `t('errors.tooManyAttempts')`. Texto da API passa intacto.
- Produces (`src/services/reportService.js`): `AGRUPAMENTO_LABELS` removido → `agrupamentoLabel(code): string` (fallback `code`), chaves `reports.agrupamento.<code>`.
- Regra nos pontos de uso: `Object.entries(X_LABELS).map(...)` → `const xOptions = computed(() => xOptionsFn())`; `X_LABELS[c] ?? c` → `xLabel(c)`; o mapa local `PRIORIDADE_LABELS` de `SlasView.vue` some em favor de `prioridadeLabel`.

- [ ] **Step 1: Mostrar o que precisa mudar**

Run: `node scripts/check-locales.mjs --scan src/utils src/services`
Expected: FAIL listando os rótulos acentuados de `incidentLabels.js`, `reportPeriod.js`, `attachmentRules.js`, `errors.js` e `reportService.js`. Os textos sem acento (`'dia'`, `'hora'` em `duration.js`, `'Baixa'`, `'Aberto'`) o scan não pega — entram pela leitura dos arquivos.

- [ ] **Step 2: Reescrever os utilitários e as chaves `labels.*`, `duration.*`, `reports.quebra.*`, `reports.periodo.*`, `reports.agrupamento.*`, `attachments.*`, `errors.*` nos dois JSON**

- [ ] **Step 3: Atualizar todos os pontos de uso**

Run: `grep -rnE "(PRIORIDADE|STATUS|ORIGEM|TIPO|SLA_STATUS)_LABELS|QUEBRA_OPTIONS|PERIODO_OPTIONS|QUEBRA_NOMES|AGRUPAMENTO_LABELS" src`
Expected depois da mudança: nenhuma linha.

- [ ] **Step 4: Verificar**

Run: `node scripts/check-locales.mjs && node scripts/check-locales.mjs --scan src/utils src/services && npm run build`
Expected: `locales OK`, `scan OK`, build OK.

- [ ] **Step 5: Conferência manual**

- PT: `formatDurationMinutes(1501)` → `1 dia, 1 hora e 1 minuto`; `formatDurationMinutes(0)` → `0 minutos`; `formatRemainingMinutes(-90)` → `Atrasado 1 hora e 30 minutos` (iguais ao atual — conferir pelo console do dev com `import('/src/utils/duration.js')`).
- EN: `1 day, 1 hour and 1 minute`; `0 minutes`; `Late 1 hour and 30 minutes`.
- Dashboard: chips de status/prioridade/SLA e opções do filtro avançado trocam ao mudar idioma com a tela aberta.

- [ ] **Step 6: Commit**

```bash
git add -A src scripts
git commit -m "feat(i18n): rótulos, durações, período e erros compartilhados traduzidos"
```

---

### Tarefas de tela (Tasks 3–9) — passos comuns

Cada uma destas tarefas segue os mesmos passos, sobre a lista de arquivos dela:

- [ ] **Step 1:** `node scripts/check-locales.mjs --scan <arquivos>` → FAIL com os textos fixos (registrar a contagem no commit).
- [ ] **Step 2:** Mover todo texto fixo para os dois JSON sob a área indicada, aplicando as regras das Global Constraints (`computed` para listas/headers, `t()` nos fallbacks de erro, `common.*` para repetidos). Ler também os textos **sem acento** que o scan não pega (`'Nome'`, `'Salvar'`, `title: 'Cliente'`) — o scan pega só acentuados no script.
- [ ] **Step 3:** Trocar todo `toLocaleString('pt-BR'…)`, `toLocaleDateString('pt-BR'…)`, `Number(...).toLocaleString('pt-BR', …)` por `formatDateTime`/`formatDate`/`formatNumber` com **as mesmas opções**.
- [ ] **Step 4:** `node scripts/check-locales.mjs && node scripts/check-locales.mjs --scan <arquivos> && npm run build` → `locales OK`, `scan OK`, build OK.
- [ ] **Step 5:** Manual: abrir cada tela/modal da tarefa em PT e comparar com a versão anterior (texto e datas idênticos); trocar para EN **com a tela aberta** — cabeçalhos, selects, placeholders, botões e datas mudam; nenhum `chave.crua` visível; voltar para PT.
- [ ] **Step 6:** Commit `feat(i18n): <área> traduzida`.

### Task 3: Autenticação e 404

**Files:** `src/views/LoginView.vue`, `src/views/CustomerLoginView.vue`, `src/views/ForgotPasswordView.vue`, `src/views/ResetPasswordView.vue`, `src/views/NotFoundView.vue`
**Áreas:** `auth.*` (`auth.staffLogin`, `auth.customerLogin`, `auth.forgot`, `auth.reset`), `notFound.*`. Títulos/subtítulos passados como prop ao `AuthLayout` vêm de `t()`.
**Atenção:** placeholders de e-mail com `@` usam `{'@'}`.

### Task 4: Painel de incidentes

**Files:** `src/views/DashboardView.vue`, `src/components/IncidentAdvancedFilterModal.vue`, `src/components/IncidentViewModal.vue`, `src/components/IncidentFeed.vue`, `src/components/IncidentFeedPanel.vue`, `src/components/IncidentAttachments.vue`
**Áreas:** `incidents.dashboard.*`, `incidents.filters.*`, `incidents.view.*`, `incidents.feed.*`, `incidents.attachments.*`.
**Datas:** `DashboardView`, `IncidentViewModal`, `IncidentFeed` usam `toLocaleString('pt-BR')` sem opções → `formatDateTime(iso)`.

### Task 5: Abertura e edição de incidente

**Files:** `src/views/IncidentFormView.vue`, `src/components/IncidentCreateModal.vue`
**Áreas:** `incidents.form.*` (compartilhada pelos dois arquivos — mesmos campos usam as mesmas chaves).

### Task 6: Portal do Cliente

**Files:** `src/views/PortalView.vue`, `src/components/PortalIncidentModal.vue`, `src/components/PortalIncidentCreateModal.vue`
**Áreas:** `portal.*`.
**Datas:** `PortalIncidentModal.vue:50` usa `toLocaleDateString('pt-BR')` → `formatDate(iso)`; os demais `formatDateTime(iso)`.

### Task 7: Relatórios — indicadores

**Files:** `src/views/ReportsView.vue`, `src/components/reports/ReportPeriodControls.vue`, `src/components/reports/IndicadoresPanel.vue`, `src/components/reports/IndicadoresTable.vue`, `src/components/reports/ReportResultTable.vue`, `src/components/reports/ReportTicketListDialog.vue`
**Áreas:** `reports.*` (`reports.tabs`, `reports.indicadores`, `reports.result`, `reports.ticketList`).
**Datas/números:** `ReportTicketListDialog.vue:141` mantém o objeto de opções atual em `formatDateTime(iso, opções)`; `ReportResultTable.vue:24` → `formatNumber(valor, { minimumFractionDigits: 1, maximumFractionDigits: 1 })` + `%`.
**Não traduzir:** `rotulo`/`titulo` vindos da API. O `'Chamados'` de `dados?.titulo ?? 'Chamados'` é do front e traduz. `'Linha: '` em `ReportTicketListDialog.vue:53` é do front e traduz (`reports.ticketList.row` com `{rotulo}`).
**Gráficos:** títulos/legendas montados no front entram no `computed` que gera os dados do Chart.js, para o gráfico remontar ao trocar idioma.

### Task 8: Relatórios — avançado e fluxos

**Files:** `src/components/reports/AdvancedReportPanel.vue`, `src/components/reports/FluxosPanel.vue`, `src/components/reports/FluxosMapa.vue`
**Áreas:** `reports.advanced.*`, `reports.fluxos.*`.
**Não traduzir:** nomes de nós do mapa que vêm da API ("Sem grupo", "Origem desconhecida", "Outros grupos" — conferir no payload; se forem montados no front, traduzir). Nomes de arquivo de download montados no front traduzem.

### Task 9: Administração — cadastros de pessoas

**Files:** `src/views/admin/ClientsView.vue`, `src/views/admin/CustomersView.vue`, `src/views/admin/UsersView.vue`, `src/components/admin/ClientFormModal.vue`, `src/components/admin/ClientAdvancedFilterModal.vue`, `src/components/admin/CustomerFormModal.vue`, `src/components/admin/CustomerAdvancedFilterModal.vue`, `src/components/admin/UserFormModal.vue`, `src/components/admin/UserAdvancedFilterModal.vue`, `src/components/admin/UserVisibilityModal.vue`, `src/components/admin/ConfirmDeleteDialog.vue`
**Áreas:** `admin.common.*` (padrões das telas de CRUD: "Novo", "Filtro avançado", "Nenhum registro"…, mais `ConfirmDeleteDialog`), `admin.clients.*`, `admin.customers.*`, `admin.users.*`.

### Task 10: Administração — estrutura, SLA e auditoria

**Files:** `src/views/admin/SolutionGroupsView.vue`, `src/views/admin/CategoriesView.vue`, `src/views/admin/SubcategoriesView.vue`, `src/views/admin/ItemsView.vue`, `src/views/admin/SlasView.vue`, `src/views/admin/AuditLogsView.vue`, `src/components/admin/SolutionGroupFormModal.vue`, `src/components/admin/SolutionGroupAdvancedFilterModal.vue`, `src/components/admin/SolutionGroupPermissionsModal.vue`, `src/components/admin/CategoryFormModal.vue`, `src/components/admin/CategoryAdvancedFilterModal.vue`, `src/components/admin/SubcategoryFormModal.vue`, `src/components/admin/SubcategoryAdvancedFilterModal.vue`, `src/components/admin/ItemFormModal.vue`, `src/components/admin/ItemAdvancedFilterModal.vue`, `src/components/admin/SlaFormModal.vue`, `src/components/admin/SlaAdvancedFilterModal.vue`
**Áreas:** reutiliza `admin.common.*` da Task 9; `admin.solutionGroups.*`, `admin.categories.*`, `admin.subcategories.*`, `admin.items.*`, `admin.slas.*`, `admin.auditLogs.*`.
**Datas:** `AuditLogsView.vue:136` → `formatDateTime(iso)`.
**Permissões:** nomes de permissão exibidos em `SolutionGroupPermissionsModal` — se vierem da API como texto, não traduzir; se forem mapa no front, traduzir.

---

### Task 11: Varredura final

**Files:** qualquer arquivo com achado; `src/App.vue`.

- [ ] **Step 1: Varredura completa**

Run: `node scripts/check-locales.mjs && node scripts/check-locales.mjs --scan src`
Expected: `locales OK`, `scan OK`. Qualquer achado legítimo restante (ex.: texto sem tradução esquecido) é corrigido; falso-positivo recebe `// i18n-ignore` (ou `<!-- i18n-ignore -->` na mesma linha) com motivo.

- [ ] **Step 2: Texto sem acento esquecido**

Run: `grep -rnE "(title|label|text|placeholder|hint|subtitle): '[A-Z][a-z]" src --include='*.vue' --include='*.js'`
Expected: nenhuma linha (todo texto desse tipo já veio de `t()`).

- [ ] **Step 3: Build e passada manual nos dois idiomas**

Run: `npm run build` → OK. Manual: percorrer login (staff e customer), painel, abrir/editar incidente, portal, relatórios (três abas, exportar PNG de um gráfico em EN), cada tela de admin; em EN nenhuma frase do front em português (exceto o que vem da API, listado no spec como não-objetivo).

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "feat(i18n): varredura final de textos fixos"
```
