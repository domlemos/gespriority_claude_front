# Seletor de idioma PT-BR / EN — Design

Data: 2026-11-18
Escopo: só o frontend (`gespriority_claude_front`). Backend fica para uma etapa posterior.

## Intenção

O upITSM tem usuários em quatro continentes, mas ~95% estão no Brasil. Hoje a
interface é toda em português, com texto fixo nos templates. Os ~5% de fora
precisam de uma interface em inglês. O português continua sendo o idioma
principal e quem usa em português não deve perceber nenhuma mudança além do
novo seletor.

## Objetivos

- Seletor de idioma (Português (BR) / English) no menu superior do `AppLayout`
  (equipe interna e Portal do Cliente) e nas telas do `AuthLayout` (login,
  esqueci a senha, redefinir senha — tanto `web` quanto `customer`).
- Toda a interface escrita no front traduzida: templates, títulos, botões,
  rótulos de formulário, regras de validação do front, mensagens de snackbar,
  diálogos, rótulos de status/prioridade/origem e demais mapas em `src/utils`,
  opções de período/quebra dos relatórios, durações (`formatDurationMinutes`),
  textos internos dos componentes do Vuetify (rodapé das tabelas "Items per
  page" / "1-10 of 50", "No data available", aria-labels).
- Datas e números formatados conforme o idioma. Substitui os
  `toLocaleString('pt-BR')` fixos (ver "Datas e números").
- Troca de idioma instantânea, sem recarregar a página.

## Não-objetivos (ficam em português nesta etapa — aceito pelo usuário)

- Mensagens vindas da API: erros 422 de validação do Laravel, `message` dos
  controllers ("Não é possível excluir…"), 401/403 com texto do backend.
- E-mails (convite, chamado fechado, comentário do cliente).
- Rótulos de relatório gerados pelo backend (`rotulo`/`titulo` de indicadores,
  linhas, colunas, filtros do mapa de fluxos) e planilhas exportadas pela API.
- Dados cadastrados (nomes de categorias, itens, grupos, SLAs, títulos de
  chamados) — nunca são traduzidos.
- Guardar a preferência de idioma no usuário (servidor).

## Anti-objetivos

- Qualquer mudança perceptível para quem usa em português nos textos do
  próprio app, formatos de data e comportamento: devem ficar idênticos aos
  atuais em PT-BR. **Única exceção aprovada:** os textos internos do Vuetify,
  que hoje aparecem em inglês (o plugin não define `locale`, então o Vuetify
  usa `en`), passam a aparecer em português no modo PT-BR.
- Chaves de tradução aparecendo na tela (`incidents.title`) por chave faltando.
- Duplicar lógica: rótulos de status etc. continuam centralizados num lugar só.

## Decisões

### Abordagem (escolhida: A)

- **A. `vue-i18n` + arquivos JSON por idioma** — escolhida. Biblioteca oficial,
  plural/interpolação/formatação de data e número prontos, e o Vuetify 4 tem
  adaptador oficial (`vuetify/locale/adapters/vue-i18n`), então os textos
  internos dos componentes trocam junto.
- B. Store Pinia caseira com `t()` — descartada: reimplementaria plural,
  interpolação e integração com Vuetify.
- C. A com carregamento sob demanda do `en` — descartada: economia de poucos kB
  não paga a complexidade e o atraso na primeira troca.

### Idioma inicial e persistência

1. Se houver escolha salva em `localStorage` (`upITSM.locale`), usa ela.
2. Senão, se `navigator.language` começa com `pt` → `pt-BR`; qualquer outra
   coisa → `en`.
3. A escolha manual grava em `localStorage`. Acesso ao storage em try/catch
   (modo privado etc.), caindo na detecção pelo navegador.
4. Na inicialização e a cada troca, atualizar `<html lang>` (`pt-BR` / `en`);
   o `lang="pt-BR"` fixo do `index.html` fica como valor antes do JS carregar.

Idiomas suportados: exatamente `pt-BR` e `en`. Fallback de chave: `pt-BR`.

### Estrutura

- `src/plugins/i18n.js` — cria a instância (`legacy: false`, `globalInjection`),
  com `messages`, `datetimeFormats` e `numberFormats` para os dois idiomas, e
  exporta helpers de leitura/gravação do idioma.
- `src/locales/pt-BR.json` e `src/locales/en.json` — mesmas chaves, agrupadas
  por área: `common.*` (Salvar, Cancelar, Fechar, Excluir…), `nav.*`, `auth.*`,
  `incidents.*`, `portal.*`, `reports.*`, `admin.<entidade>.*`, `labels.*`
  (status, prioridade, origem, período, quebra), `errors.*`, `duration.*`.
- `src/plugins/vuetify.js` — usa `createVueI18nAdapter({ i18n, useI18n })`;
  as mensagens do Vuetify (`vuetify/locale` `pt` e `en`) são mescladas nos JSON
  sob a chave `$vuetify`.
- `src/components/LocaleSwitcher.vue` — botão com `mdi-translate` + sigla
  (`PT` / `EN`) abrindo `v-menu` com "Português (BR)" e "English" (nomes
  sempre no próprio idioma). Usado no `AppLayout` (à esquerda do menu do
  avatar) e no `AuthLayout` (canto superior direito da área do formulário).
- `src/main.js` — registra o i18n antes do Vuetify.

Esboço do menu superior:

```
[🛡 upITSM]  Incidentes  Relatórios  Administração      [🌐 PT ▾]  [DL Daniel ▾]
                                                          ├ Português (BR)
                                                          └ English
```

### Textos fora de componentes (`src/utils`)

Os mapas `PRIORIDADE_LABELS`, `STATUS_LABELS`, `ORIGEM_LABELS`,
`QUEBRA_OPTIONS`, `PERIODO_OPTIONS`, `QUEBRA_NOMES` etc. hoje são objetos com
texto fixo. Passam a guardar só os códigos/chaves; o texto vem do i18n. Onde
houver uso reativo em template, expor funções (`statusLabel(code)`) ou
`computed` que chamam `i18n.global.t(...)`, para que a troca de idioma
re-renderize. `formatDurationMinutes` usa plural do vue-i18n
(`duration.days`: "{n} dia | {n} dias") e o conector final traduzido (" e " /
" and "). `extractErrorMessage` traduz só os textos próprios do front
(fallback genérico, 429); o texto vindo da API passa como está.

### Datas e números

Todo `new Date(iso).toLocaleString('pt-BR')` / `toLocaleDateString('pt-BR')`
e `Number(...).toLocaleString('pt-BR', …)` passa a usar o idioma ativo — via
um helper central em `src/utils` que lê `i18n.global.locale` e repassa as
**mesmas opções usadas hoje em cada ponto** (decisão do usuário: manter
exatamente os formatos atuais em PT-BR, sem padronizar). Hoje coexistem pelo
menos três formatos:

- `toLocaleString` sem opções → `18/11/2026, 14:30:45` (PT) /
  `11/18/2026, 2:30:45 PM` (EN) — `PortalView`, `DashboardView`,
  `AuditLogsView`, `IncidentViewModal`, `PortalIncidentModal`, `IncidentFeed`;
- `toLocaleDateString` sem opções → `18/11/2026` / `11/18/2026` —
  `PortalIncidentModal`;
- opções próprias em `ReportTicketListDialog` e o percentual com 1 casa em
  `ReportResultTable` — mantêm as opções, só trocam o locale.

Em PT-BR a saída deve ser byte a byte igual à atual.

Campos de data (`<v-text-field type="date">` em `ReportPeriodControls` e
`AuditLogsView`) são nativos do navegador e seguem o idioma do navegador/SO,
não o do app. Ficam como estão (decisão do implementador: trocar por
`v-date-picker` mudaria o comportamento em PT-BR).

### Títulos e textos que vão para imagens exportadas

Títulos de gráficos montados no front e exportados como PNG usam o idioma
ativo no momento da exportação. Nomes de arquivo de download gerados no
front também são traduzidos.

## Organização do trabalho

Projeto grande e mecânico (~90 arquivos). Dividir por área, cada uma
entregando a app funcionando:

1. Infraestrutura: dependência, plugin, JSON vazios com `common`, adaptador do
   Vuetify, `LocaleSwitcher` nos dois layouts, detecção/persistência, `<html
   lang>`, helpers de data/número.
2. `src/utils` (rótulos, duração, erros, período) + layouts.
3. Autenticação (login, esqueci/redefinir senha, web e customer) + 404.
4. Incidentes (dashboard, formulário, modais, feed, anexos, filtros).
5. Portal do Cliente.
6. Relatórios.
7. Administração (views, modais de formulário/filtro/permissões, auditoria).

## Verificação

- Sem suíte de testes no projeto: cada etapa verificada com `npm run build`
  (Node 22.14.0 via `nvm use 22.14.0`) e conferência manual nos dois idiomas.
- Ao final: varredura (`grep`) por texto em português ainda fixo em `src/`
  e por `'pt-BR'` fixo; checar que as chaves dos dois JSON são as mesmas
  (script simples comparando chaves); `missingWarn` ligado em dev para pegar
  chaves faltando.

## Deixado para quem implementar

- Nomes exatos das chaves dentro de cada área.
- Tradução em inglês dos textos (tom: direto, inglês americano).
- Posicionamento fino do seletor no `AuthLayout` em telas pequenas.

## Próxima etapa (fora deste escopo)

Backend: front envia `Accept-Language`, middleware chama `App::setLocale()`,
`lang/en` (via `laravel-lang`), mensagens fixas dos controllers e rótulos de
relatório com `__()`. Depois, coluna `locale` em `users`/`customers` para os
e-mails.
