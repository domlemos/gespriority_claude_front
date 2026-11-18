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

export function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // sem persistência: a troca vale só para a sessão
  }
  document.documentElement.lang = locale
}

export function currentLocale() {
  return i18n.global.locale.value
}

export function t(...args) {
  return i18n.global.t(...args)
}

export default i18n
