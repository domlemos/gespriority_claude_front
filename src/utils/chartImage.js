// Exportação de gráficos como PNG.

// Quebra um texto em linhas de até `max` caracteres (sem cortar palavras) para
// caber no canvas e na imagem exportada.
export function quebrarTitulo(texto, max = 90) {
  const linhas = []
  let atual = ''
  for (const palavra of (texto ?? '').split(' ')) {
    if (atual && `${atual} ${palavra}`.length > max) {
      linhas.push(atual)
      atual = palavra
    } else {
      atual = atual ? `${atual} ${palavra}` : palavra
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

// Quebra um parágrafo em linhas que cabem em `largura` pixels no `ctx.font` atual.
function quebrarPorLargura(ctx, texto, largura) {
  const linhas = []
  let atual = ''
  for (const palavra of texto.split(' ')) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (atual && ctx.measureText(tentativa).width > largura) {
      linhas.push(atual)
      atual = palavra
    } else {
      atual = tentativa
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

// `chart.toBase64Image()` exporta só o canvas — sem preenchimento, ele é
// transparente por padrão (nenhum problema dentro do card branco da tela,
// mas some/vira ilegível se a imagem for aberta sobre um fundo escuro fora
// do app). Compõe num canvas novo com fundo branco antes de exportar, com os
// gráficos empilhados e, opcionalmente, um título acima e parágrafos abaixo
// (legenda, aviso), quebrados na largura da imagem. Sem título nem rodapé, a
// imagem é o próprio canvas do gráfico sobre fundo branco.
export function baixarImagemGraficos(canvases, nomeArquivo, { titulo = '', rodape = [] } = {}) {
  if (!canvases.length) return

  // Os canvases do Chart.js estão em pixels do dispositivo; o texto acompanha a escala.
  const escala = canvases[0].clientWidth ? canvases[0].width / canvases[0].clientWidth : 1
  const temTexto = !!titulo || rodape.length > 0
  const margem = temTexto ? Math.round(16 * escala) : 0
  const fonteTitulo = `bold ${Math.round(14 * escala)}px sans-serif`
  const fonteRodape = `${Math.round(11 * escala)}px sans-serif`
  const alturaTitulo = Math.round(20 * escala)
  const alturaRodape = Math.round(16 * escala)
  const largura = Math.max(...canvases.map((c) => c.width))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // Mede antes de dimensionar o canvas (redimensionar zera o contexto).
  ctx.font = fonteTitulo
  const linhasTitulo = titulo ? quebrarPorLargura(ctx, titulo, largura - 2 * margem) : []
  ctx.font = fonteRodape
  const linhasRodape = rodape.flatMap((texto) => quebrarPorLargura(ctx, texto, largura - 2 * margem))

  const topo = linhasTitulo.length ? margem + linhasTitulo.length * alturaTitulo + margem : 0
  const alturaGraficos = canvases.reduce((soma, c) => soma + c.height, 0)
  const base = linhasRodape.length ? margem + linhasRodape.length * alturaRodape + margem : 0

  canvas.width = largura
  canvas.height = topo + alturaGraficos + base

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#3A3A3A'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
  ctx.font = fonteTitulo
  linhasTitulo.forEach((linha, i) => ctx.fillText(linha, largura / 2, margem + i * alturaTitulo))

  let y = topo
  for (const source of canvases) {
    ctx.drawImage(source, 0, y)
    y += source.height
  }

  ctx.textAlign = 'left'
  ctx.font = fonteRodape
  linhasRodape.forEach((linha, i) => ctx.fillText(linha, margem, y + margem + i * alturaRodape))

  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png', 1)
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
}
