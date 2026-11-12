// Posicionamento do mapa de fluxos (spec 5.2), sem dependência de Vue nem do DOM.
//
// Colunas: o Cliente fica na coluna 0 e cada nó na coluna da sua menor
// distância (BFS) a partir dele. "Sem grupo" e "Origem desconhecida" também
// ficam na coluna 0, e os nós sem caminho a partir do Cliente são posicionados
// por BFS a partir deles (coluna 1 em diante). O que ainda sobrar começa na
// coluna 1. "Outros grupos" fica sozinho na última coluna.
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
  espacoColunas: 150, // corredor entre colunas, onde passam as setas
  espacoLinhas: 28,
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

// BFS a partir de `sementes` ({chave: coluna}), só por nós ainda sem coluna.
function bfs(coluna, vizinhos, sementes) {
  const fila = []
  for (const [chave, col] of sementes) {
    if (coluna.has(chave)) continue
    coluna.set(chave, col)
    fila.push(chave)
  }
  while (fila.length) {
    const atual = fila.shift()
    for (const prox of vizinhos.get(atual) ?? []) {
      if (coluna.has(prox) || prox === 'outros') continue
      coluna.set(prox, coluna.get(atual) + 1)
      fila.push(prox)
    }
  }
}

function atribuirColunas(nos, arestas) {
  const chaves = nos.map((n) => n.chave)
  const existe = new Set(chaves)
  const vizinhos = new Map()
  for (const a of arestas) {
    if (a.origem === a.destino || !existe.has(a.origem) || !existe.has(a.destino)) continue
    if (!vizinhos.has(a.origem)) vizinhos.set(a.origem, [])
    vizinhos.get(a.origem).push(a.destino)
  }

  const coluna = new Map()
  if (existe.has('cliente')) bfs(coluna, vizinhos, [['cliente', 0]])
  bfs(
    coluna,
    vizinhos,
    ESPECIAIS_INICIAIS.filter((c) => existe.has(c)).map((c) => [c, 0]),
  )

  // Sobra: nós alcançáveis só a partir de "Outros grupos", ciclos ou nós sem
  // seta. Começa pelos que não recebem seta de outro nó da sobra (ou, num ciclo,
  // pelo primeiro na ordem da resposta) e segue por BFS a partir da coluna 1.
  for (;;) {
    const sobra = chaves.filter((c) => !coluna.has(c) && c !== 'outros')
    if (!sobra.length) break
    const naSobra = new Set(sobra)
    const recebe = new Set()
    for (const c of sobra) for (const d of vizinhos.get(c) ?? []) if (naSobra.has(d)) recebe.add(d)
    const raizes = sobra.filter((c) => !recebe.has(c))
    bfs(coluna, vizinhos, (raizes.length ? raizes : [sobra[0]]).map((c) => [c, 1]))
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

  // --- caixas: empilhadas em cada coluna, colunas centralizadas na vertical ---
  const alturaColuna = colunas.map(
    (col) => col.reduce((s, c) => s + tamanho(porChave.get(c)).altura, 0) + (col.length - 1) * m.espacoLinhas,
  )
  const alturaCaixas = Math.max(0, ...alturaColuna)
  const posicoes = {}
  colunas.forEach((col, i) => {
    const xColuna = m.margem + i * (m.largura + m.espacoColunas)
    let y = m.margem + (alturaCaixas - alturaColuna[i]) / 2
    for (const chave of col) {
      const t = tamanho(porChave.get(chave))
      posicoes[chave] = { x: xColuna + (m.largura - t.largura) / 2, y, largura: t.largura, altura: t.altura }
      y += t.altura + m.espacoLinhas
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
      return {
        ...base,
        d: `M ${ini.x} ${ini.y} C ${ini.x + dx} ${ini.y}, ${fim.x - dx} ${fim.y}, ${fim.x} ${fim.y}`,
        // Ponto médio da cúbica simétrica.
        rotuloX: (ini.x + fim.x) / 2,
        rotuloY: (ini.y + fim.y) / 2,
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
