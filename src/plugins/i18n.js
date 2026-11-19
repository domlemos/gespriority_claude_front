import { createI18n } from 'vue-i18n'
import { pt, en } from 'vuetify/locale'

import ptBR from '@/locales/pt-BR.json'
import enUS from '@/locales/en.json'

export const SUPPORTED_LOCALES = ['pt-BR', 'en']
// Metadados de exibição (sigla e chave do nome) usados pelo seletor.
export const LOCALE_OPTIONS = [
  { code: 'pt-BR', short: 'PT', nameKey: 'locale.ptBR' },
  { code: 'en', short: 'EN', nameKey: 'locale.en' },
]
const STORAGE_KEY = 'upITSM.locale'

export function detectInitialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (SUPPORTED_LOCALES.includes(saved)) return saved
  } catch {
    // storage indisponível (modo privado etc.): cai na detecção pelo navegador
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  return String(nav || '').toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectInitialLocale(),
  fallbackLocale: 'pt-BR',
  messages: {
    'pt-BR': { ...ptBR, $vuetify: pt },
    en: { ...enUS, $vuetify: en },
  },
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
})

document.documentElement.lang = i18n.global.locale.value

// `persist: false` aplica o idioma sem gravá-lo como escolha explícita do navegador.
export function setLocale(locale, { persist = true } = {}) {
  if (!SUPPORTED_LOCALES.includes(locale)) return
  i18n.global.locale.value = locale
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // sem persistência: a troca vale só para a sessão
    }
  }
  document.documentElement.lang = locale
}

// Códigos: front 'pt-BR' | 'en' <-> backend 'pt_BR' | 'en'.
export function toBackendLocale(locale) {
  return locale === 'en' ? 'en' : 'pt_BR'
}

export function fromBackendLocale(locale) {
  return locale === 'en' ? 'en' : 'pt-BR'
}

// Há escolha explícita (valor válido) salva neste navegador?
export function hasExplicitLocale() {
  try {
    return SUPPORTED_LOCALES.includes(localStorage.getItem(STORAGE_KEY))
  } catch {
    return false
  }
}

export function currentLocale() {
  return i18n.global.locale.value
}

// Rótulo traduzido de `key`; sem a chave (em qualquer idioma), devolve o próprio `code`.
// null/undefined passam direto. Usa `te` para não gerar aviso de chave ausente.
export function labelOr(key, code) {
  if (code === null || code === undefined) return code
  return i18n.global.te(key, 'pt-BR') || i18n.global.te(key) ? i18n.global.t(key) : code
}

export function t(...args) {
  return i18n.global.t(...args)
}

export default i18n
