// Espelho das regras de `AnexoController::store()` no backend (lista branca
// de extensões + 10 MB) — checagem antecipada pra avisar o usuário antes do
// upload. O backend continua sendo a fonte da verdade (inclusive checando o
// conteúdo real do arquivo, que aqui não dá pra fazer).
export const ATTACHMENT_ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'xls', 'xlsx', 'csv']

export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024

export const ATTACHMENT_ACCEPT = ATTACHMENT_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')

// Mensagem de erro do arquivo, ou `null` se ele pode ser enviado.
export function attachmentError(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(extension)) {
    return `"${file.name}": tipo de arquivo não permitido. Use ${ATTACHMENT_ALLOWED_EXTENSIONS.join(', ')}.`
  }

  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return `"${file.name}": excede o tamanho máximo de 10 MB.`
  }

  return null
}
