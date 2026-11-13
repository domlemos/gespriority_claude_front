// Posicionamento do mapa de fluxos (spec 5.2), sem dependência de Vue nem do DOM.
//
// Colunas: o Cliente, "Sem grupo" e "Origem desconhecida" ficam na coluna 0.
// As setas, da maior quantidade para a menor, viram restrições "origem antes do
// destino" quando não fecham ciclo com as já aceitas; cada nó fica na coluna do
// caminho mais longo até ele por essas restrições (o fluxo principal corre da
// esquerda para a direita e cadeias N1 → N2 → N3 não se amontoam numa coluna).
// Nó sem restrição de entrada começa na coluna 1. "Outros grupos" fica sozinho
// na última coluna.
//
// Altura: todas as colunas ocupam a mesma faixa vertical (no mínimo
// `alturaMinima`). As caixas começam distribuídas por igual nessa faixa e depois
// se aproximam da altura média dos nós com que trocam chamados (ponderada pela
// quantidade), mantendo a ordem e o espaçamento mínimo na coluna.
//
// Setas: para a frente, uma curva cúbica da borda direita da origem à borda
// esquerda do destino. Para trás ou na mesma coluna (`retorno: true`), um arco
// que sai pela esquerda da origem, desce pelo corredor entre as colunas até uma
// faixa abaixo de todas as caixas e sobe pelo corredor à direita do destino,
// sem cruzar nenhuma caixa.

export const MEDIDAS = {
  margem: 32,
  largura: 196, // caixa de grupo e largura da coluna
  alturaCabecalho: 28,
  alturaLinha: 22,
  alturaEspecial: 44, // caixa tracejada só com o nome
  diametroCliente: 104,
  espacoColunas: 200, // corredor entre colunas, onde passam as setas
  espacoLinhas: 56, // distância mínima entre caixas na mesma coluna
  alturaMinima: 560, // faixa vertical mínima das caixas (espalha mapas pequenos)
  folgaVertical: 1.2, // a faixa é pelo menos esta fração da coluna mais alta empilhada
  faixaRetorno: 24, // distância entre as faixas dos arcos de retorno
  corredorRetorno: 10, // distância entre arcos de retorno no mesmo corredor
  raio: 10, // raio dos cantos do arco de retorno
}

const ESPECIAIS_INICIAIS = ['sem_grupo', 'origem_desconhecida']

// Nó desenhado como caixa com as quatro métricas (grupo que não é vizinho).
export function temMetricas(no) {
  return no.tipo === 'grupo' && !no.vizinho
}

function tamanho(no) {
  const m = MEDIDAS
  if (no.tipo === 'cliente') return { largura: m.diametroCliente, altura: m.diametroCliente }
  if (temMetricas(no)) return { largura: m.largura, altura: m.alturaCabecalho + 4 * m.alturaLinha + 8 }
  return { largura: m.largura, altura: m.alturaEspecial }
}

// Colunas pelo caminho mais longo num grafo sem ciclos montado com as setas
// mais volumosas primeiro (uma seta que fecharia ciclo vira retorno).
function atribuirColunas(nos, arestas) {
  const chaves = nos.map((n) => n.chave)
  const existe = new Set(chaves)
  const iniciais = new Set(['cliente', ...ESPECIAIS_INICIAIS].filter((c) => existe.has(c)))

  const depois = new Map(chaves.map((c) => [c, new Set()]))
  const alcanca = (de, ate) => {
    const visto = new Set([de])
    const pilha = [de]
    while (pilha.length) {
      const atual = pilha.pop()
      if (atual === ate) return true
      for (const prox of depois.get(atual)) {
        if (visto.has(prox)) continue
        visto.add(prox)
        pilha.push(prox)
      }
    }
    return false
  }
  const ordenadas = arestas
    .map((a, i) => ({ ...a, i }))
    .sort((a, b) => b.quantidade - a.quantidade || a.i - b.i)
  for (const a of ordenadas) {
    if (a.origem === 'outros' || a.destino === 'outros' || iniciais.has(a.destino)) continue
    if (depois.get(a.origem).has(a.destino) || alcanca(a.destino, a.origem)) continue
    depois.get(a.origem).add(a.destino)
  }

  // Caminho mais longo (Kahn, na ordem da resposta para ser estável).
  const entrada = new Map(chaves.map((c) => [c, 0]))
  for (const destinos of depois.values()) for (const d of destinos) entrada.set(d, entrada.get(d) + 1)
  const coluna = new Map()
  for (const c of chaves) {
    if (c !== 'outros' && entrada.get(c) === 0) coluna.set(c, iniciais.has(c) ? 0 : 1)
  }
  const fila = chaves.filter((c) => coluna.has(c))
  while (fila.length) {
    const atual = fila.shift()
    for (const prox of depois.get(atual)) {
      coluna.set(prox, Math.max(coluna.get(prox) ?? 0, coluna.get(atual) + 1))
      entrada.set(prox, entrada.get(prox) - 1)
      if (entrada.get(prox) === 0) fila.push(prox)
    }
  }

  if (existe.has('outros')) {
    const ultima = Math.max(0, ...coluna.values())
    coluna.set('outros', ultima + 1)
  }
  return coluna
}

// Agrupa por coluna e ordena cada coluna pela posição média dos antecessores já
// posicionados (menos cruzamentos); empate mantém a ordem da resposta.
function montarColunas(nos, arestas, coluna) {
  const total = Math.max(0, ...coluna.values()) + 1
  const colunas = Array.from({ length: total }, () => [])
  nos.forEach((n) => colunas[coluna.get(n.chave)].push(n.chave))

  const ordemResposta = new Map(nos.map((n, i) => [n.chave, i]))
  const indiceNaColuna = new Map()
  colunas.forEach((col, c) => {
    if (c > 0) {
      const peso = new Map()
      for (const chave of col) {
        const antes = arestas
          .filter((a) => a.destino === chave && indiceNaColuna.has(a.origem) && coluna.get(a.origem) < c)
          .map((a) => indiceNaColuna.get(a.origem))
        peso.set(chave, antes.length ? antes.reduce((s, v) => s + v, 0) / antes.length : Infinity)
      }
      col.sort((a, b) => peso.get(a) - peso.get(b) || ordemResposta.get(a) - ordemResposta.get(b))
    }
    col.forEach((chave, i) => indiceNaColuna.set(chave, i))
  })
  return colunas.filter((col) => col.length)
}

// Caminho com cantos arredondados passando pelos pontos (segmentos retos).
function caminhoArredondado(pontos, raio) {
  let d = `M ${pontos[0].x} ${pontos[0].y}`
  for (let i = 1; i < pontos.length - 1; i++) {
    const [a, b, c] = [pontos[i - 1], pontos[i], pontos[i + 1]]
    const r = Math.min(raio, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2)
    const entra = { x: b.x - (Math.sign(b.x - a.x) * r), y: b.y - (Math.sign(b.y - a.y) * r) }
    const sai = { x: b.x + (Math.sign(c.x - b.x) * r), y: b.y + (Math.sign(c.y - b.y) * r) }
    d += ` L ${entra.x} ${entra.y} Q ${b.x} ${b.y} ${sai.x} ${sai.y}`
  }
  const ultimo = pontos[pontos.length - 1]
  return `${d} L ${ultimo.x} ${ultimo.y}`
}

// Ponto da cúbica (x crescente) na abscissa `x`, por bisseção em t.
function pontoNaCubica(p0, p1, p2, p3, x) {
  const em = (t, k) => {
    const u = 1 - t
    return u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]
  }
  let [lo, hi] = [0, 1]
  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2
    if (em(t, 'x') < x) lo = t
    else hi = t
  }
  const t = (lo + hi) / 2
  return { x: em(t, 'x'), y: em(t, 'y') }
}

// Ponto na borda esquerda/direita de um nó, na altura `y`. No círculo do
// Cliente, o ponto fica sobre a circunferência.
function pontoNaBorda(pos, tipo, lado, y) {
  if (tipo === 'cliente') {
    const r = pos.largura / 2
    const cx = pos.x + r
    const dy = Math.min(Math.abs(y - (pos.y + r)), r)
    const dx = Math.sqrt(r * r - dy * dy)
    return { x: lado === 'direita' ? cx + dx : cx - dx, y }
  }
  return { x: lado === 'direita' ? pos.x + pos.largura : pos.x, y }
}

export function layoutFluxos(nos, arestas) {
  const m = MEDIDAS
  const porChave = new Map(nos.map((n) => [n.chave, n]))
  const validas = arestas.filter(
    (a) => a.origem !== a.destino && porChave.has(a.origem) && porChave.has(a.destino),
  )
  const coluna = atribuirColunas(nos, validas)
  const colunas = montarColunas(nos, validas, coluna)
  // Índice compacto da coluna (montarColunas descarta colunas vazias).
  const indiceColuna = new Map()
  colunas.forEach((col, i) => col.forEach((chave) => indiceColuna.set(chave, i)))

  // --- caixas: faixa vertical comum, distribuição uniforme e depois atração
  // pela altura média dos vizinhos ---
  const alturas = new Map(nos.map((n) => [n.chave, tamanho(n).altura]))
  const empilhada = colunas.map(
    (col) => col.reduce((s, c) => s + alturas.get(c), 0) + (col.length - 1) * m.espacoLinhas,
  )
  const alturaCaixas = Math.max(nos.length > 2 ? m.alturaMinima : 0, ...empilhada.map((h) => h * m.folgaVertical))

  const centro = new Map()
  colunas.forEach((col) => {
    const livre = alturaCaixas - col.reduce((s, c) => s + alturas.get(c), 0)
    const vao = livre / col.length
    let y = vao / 2
    for (const chave of col) {
      centro.set(chave, y + alturas.get(chave) / 2)
      y += alturas.get(chave) + vao
    }
  })

  const pesos = new Map(nos.map((n) => [n.chave, []]))
  for (const a of validas) {
    pesos.get(a.origem).push([a.destino, a.quantidade])
    pesos.get(a.destino).push([a.origem, a.quantidade])
  }
  // Mantém a ordem da coluna, garante o espaço mínimo e cabe na faixa.
  const acomodar = (col) => {
    const topo = (c) => centro.get(c) - alturas.get(c) / 2
    for (let i = 1; i < col.length; i++) {
      const minimo = topo(col[i - 1]) + alturas.get(col[i - 1]) + m.espacoLinhas
      if (topo(col[i]) < minimo) centro.set(col[i], minimo + alturas.get(col[i]) / 2)
    }
    const ultimo = col[col.length - 1]
    const excesso = topo(ultimo) + alturas.get(ultimo) - alturaCaixas
    if (excesso > 0) for (const c of col) centro.set(c, centro.get(c) - excesso)
    for (let i = 0; i < col.length; i++) {
      const minimo = i === 0 ? 0 : topo(col[i - 1]) + alturas.get(col[i - 1]) + m.espacoLinhas
      if (topo(col[i]) < minimo) centro.set(col[i], minimo + alturas.get(col[i]) / 2)
    }
  }
  for (let rodada = 0; rodada < 6; rodada++) {
    for (const col of colunas) {
      for (const chave of col) {
        const lista = pesos.get(chave)
        if (!lista.length) continue
        const total = lista.reduce((s, [, q]) => s + q, 0)
        const media = lista.reduce((s, [outro, q]) => s + centro.get(outro) * q, 0) / total
        // Meio caminho: aproxima sem colar todo mundo na mesma altura.
        centro.set(chave, (centro.get(chave) + media) / 2)
      }
      acomodar(col)
    }
  }

  const posicoes = {}
  colunas.forEach((col, i) => {
    const xColuna = m.margem + i * (m.largura + m.espacoColunas)
    for (const chave of col) {
      const t = tamanho(porChave.get(chave))
      posicoes[chave] = {
        x: xColuna + (m.largura - t.largura) / 2,
        y: m.margem + centro.get(chave) - t.altura / 2,
        largura: t.largura,
        altura: t.altura,
      }
    }
  })
  const baseCaixas = m.margem + alturaCaixas

  const centroY = (chave) => posicoes[chave].y + posicoes[chave].altura / 2
  const retorno = (a) => indiceColuna.get(a.destino) <= indiceColuna.get(a.origem)

  // --- portas: as setas de um lado de um nó se distribuem na altura dele,
  // ordenadas pela altura da outra ponta; os retornos ficam por último (embaixo).
  const portas = new Map() // `${i}:origem|destino` → y
  const lados = new Map() // `${chave}:esquerda|direita` → [{ id, ordem }]
  const adicionar = (chave, lado, id, ordem) => {
    const k = `${chave}:${lado}`
    if (!lados.has(k)) lados.set(k, [])
    lados.get(k).push({ id, ordem })
  }
  validas.forEach((a, i) => {
    if (retorno(a)) {
      // Sai pela esquerda da origem e entra pela direita do destino.
      adicionar(a.origem, 'esquerda', `${i}:origem`, Infinity)
      adicionar(a.destino, 'direita', `${i}:destino`, Infinity)
    } else {
      adicionar(a.origem, 'direita', `${i}:origem`, centroY(a.destino))
      adicionar(a.destino, 'esquerda', `${i}:destino`, centroY(a.origem))
    }
  })
  for (const [k, lista] of lados) {
    const chave = k.slice(0, k.lastIndexOf(':'))
    const p = posicoes[chave]
    lista.sort((a, b) => (a.ordem === b.ordem ? 0 : a.ordem - b.ordem))
    // Caixa de grupo: as portas evitam o cabeçalho. Demais: o meio da altura.
    const topo = p.y + (temMetricas(porChave.get(chave)) ? m.alturaCabecalho : p.altura * 0.25)
    const fundo = p.y + p.altura * (temMetricas(porChave.get(chave)) ? 0.92 : 0.75)
    lista.forEach((porta, j) => {
      portas.set(porta.id, topo + ((j + 1) * (fundo - topo)) / (lista.length + 1))
    })
  }

  // --- setas ---
  const corredores = new Map() // `${coluna}:esquerda|direita` → quantos retornos já usam
  const corredor = (col, lado) => {
    const k = `${col}:${lado}`
    const n = corredores.get(k) ?? 0
    corredores.set(k, n + 1)
    return n
  }
  let faixas = 0
  const curvas = validas.map((a, i) => {
    const po = posicoes[a.origem]
    const pd = posicoes[a.destino]
    const tipoO = porChave.get(a.origem).tipo
    const tipoD = porChave.get(a.destino).tipo
    const base = { origem: a.origem, destino: a.destino, quantidade: a.quantidade }

    if (!retorno(a)) {
      const ini = pontoNaBorda(po, tipoO, 'direita', portas.get(`${i}:origem`))
      const fim = pontoNaBorda(pd, tipoD, 'esquerda', portas.get(`${i}:destino`))
      const dx = (fim.x - ini.x) / 2
      // Rótulo no meio do corredor logo depois da origem: numa seta que pula
      // colunas, o ponto médio cairia em cima de uma caixa do caminho.
      const xCorredor = m.margem + indiceColuna.get(a.origem) * (m.largura + m.espacoColunas) + m.largura + m.espacoColunas / 2
      const rotulo = pontoNaCubica(ini, { x: ini.x + dx, y: ini.y }, { x: fim.x - dx, y: fim.y }, fim, xCorredor)
      return {
        ...base,
        d: `M ${ini.x} ${ini.y} C ${ini.x + dx} ${ini.y}, ${fim.x - dx} ${fim.y}, ${fim.x} ${fim.y}`,
        rotuloX: rotulo.x,
        rotuloY: rotulo.y,
        retorno: false,
      }
    }

    const ini = pontoNaBorda(po, tipoO, 'esquerda', portas.get(`${i}:origem`))
    const fim = pontoNaBorda(pd, tipoD, 'direita', portas.get(`${i}:destino`))
    const colO = indiceColuna.get(a.origem)
    const colD = indiceColuna.get(a.destino)
    const xEsquerda = m.margem + colO * (m.largura + m.espacoColunas) - 16 - corredor(colO, 'esquerda') * m.corredorRetorno
    const xDireita = m.margem + colD * (m.largura + m.espacoColunas) + m.largura + 16 + corredor(colD, 'direita') * m.corredorRetorno
    faixas += 1
    const yFaixa = baseCaixas + faixas * m.faixaRetorno
    return {
      ...base,
      d: caminhoArredondado(
        [ini, { x: xEsquerda, y: ini.y }, { x: xEsquerda, y: yFaixa }, { x: xDireita, y: yFaixa }, { x: xDireita, y: fim.y }, fim],
        m.raio,
      ),
      rotuloX: (xEsquerda + xDireita) / 2,
      rotuloY: yFaixa,
      retorno: true,
    }
  })

  const largura = m.margem * 2 + colunas.length * m.largura + Math.max(0, colunas.length - 1) * m.espacoColunas
  const altura = baseCaixas + faixas * m.faixaRetorno + m.margem

  return { colunas, posicoes, curvas, largura, altura }
}
