// Conversão de um <svg> da tela em canvas, para exportar como PNG.

// Propriedades que o SVG pega de classes/CSS (tokens do tema) e que se perdem
// ao serializar o elemento sozinho: são copiadas, já resolvidas, para atributos.
const PROPRIEDADES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-opacity',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
]

// Largura mínima do PNG: mapas pequenos ficam centralizados em fundo branco.
const LARGURA_MINIMA = 800

// Copia os estilos computados (com as cores do tema atual) para atributos
// inline, serializa e desenha num canvas de fundo branco com a altura do SVG e
// pelo menos LARGURA_MINIMA (800px) de largura, com o mapa centralizado.
export function svgParaCanvas(svgElement) {
  const clone = svgElement.cloneNode(true)
  const originais = [svgElement, ...svgElement.querySelectorAll('*')]
  const copias = [clone, ...clone.querySelectorAll('*')]
  originais.forEach((el, i) => {
    const estilo = getComputedStyle(el)
    for (const prop of PROPRIEDADES) {
      const valor = estilo.getPropertyValue(prop)
      if (valor) copias[i].setAttribute(prop, valor)
    }
    copias[i].removeAttribute('class')
  })

  const { width, height } = svgElement.viewBox.baseVal
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', width)
  clone.setAttribute('height', height)

  const texto = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }))

  return new Promise((resolve, reject) => {
    const imagem = new Image()
    imagem.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(width, LARGURA_MINIMA)
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, height)
      ctx.drawImage(imagem, Math.round((canvas.width - width) / 2), 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    imagem.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível gerar a imagem do mapa.'))
    }
    imagem.src = url
  })
}
