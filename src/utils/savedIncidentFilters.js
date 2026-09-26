// Filtro Avançado salvo do painel de incidentes — por usuário, só neste
// navegador (localStorage, não sessionStorage: precisa sobreviver a logout e
// ao fechar o navegador). É só conveniência de UI, então qualquer falha de
// storage (modo privado, cota, JSON corrompido) cai silenciosamente em "sem
// filtro salvo" em vez de quebrar o painel.
const KEY_PREFIX = 'upITSM.dashboard.filtroSalvo'

function storageKey(userId) {
  return `${KEY_PREFIX}.${userId}`
}

// Só os campos preenchidos — `{}` significa "sem filtro".
export function compactFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== ''),
  )
}

export function loadSavedFilters(userId) {
  if (!userId) return {}

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)) ?? 'null')
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  } catch {
    return {}
  }
}

export function saveFilters(userId, filters) {
  if (!userId) return

  const compact = compactFilters(filters)

  try {
    if (Object.keys(compact).length === 0) {
      localStorage.removeItem(storageKey(userId))
    } else {
      localStorage.setItem(storageKey(userId), JSON.stringify(compact))
    }
  } catch {
    // Ver comentário no topo do arquivo.
  }
}
