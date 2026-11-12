<script setup>
import { computed, ref, useId } from 'vue'
import { layoutFluxos, MEDIDAS, temMetricas } from '@/utils/fluxosLayout'

// Mapa de fluxos em SVG: Cliente (círculo), grupos (caixa com os quatro
// números), nós especiais e vizinhos (caixa tracejada só com o nome) e setas
// com a quantidade. Clicar num número ou numa seta emite `abrir-chamados`.
const props = defineProps({
  nos: { type: Array, required: true },
  arestas: { type: Array, required: true },
})
const emit = defineEmits(['abrir-chamados'])

const METRICAS = [
  { chave: 'abertos', rotulo: 'Abertos pelo grupo', curto: 'Abertos' },
  { chave: 'recebidos', rotulo: 'Recebidos', curto: 'Recebidos' },
  { chave: 'encaminhados', rotulo: 'Encaminhados', curto: 'Encaminhados' },
  { chave: 'resolvidos', rotulo: 'Resolvidos', curto: 'Resolvidos' },
]

const svg = ref(null)
defineExpose({ svg })

// Ids únicos por instância (o marcador é referenciado por url(#id)).
const marcador = `seta-${useId()}`

const layout = computed(() => layoutFluxos(props.nos, props.arestas))
const porChave = computed(() => new Map(props.nos.map((n) => [n.chave, n])))

const maiorQuantidade = computed(() => Math.max(1, ...props.arestas.map((a) => a.quantidade)))
const espessura = (quantidade) => 1.5 + 2.5 * (quantidade / maiorQuantidade.value)

const MAX_NOME = 24
const nomeCurto = (nome) => (nome.length > MAX_NOME ? `${nome.slice(0, MAX_NOME - 1)}…` : nome)

const clicavel = (valor) => valor !== null && valor !== undefined && valor > 0

function abrirNo(no, metrica) {
  if (!clicavel(no[metrica.chave])) return
  emit('abrir-chamados', { modo: 'no', no: no.chave, metrica: metrica.chave, rotulo: `${no.rotulo} · ${metrica.curto}` })
}

function abrirSeta(curva) {
  const origem = porChave.value.get(curva.origem)?.rotulo ?? curva.origem
  const destino = porChave.value.get(curva.destino)?.rotulo ?? curva.destino
  emit('abrir-chamados', { modo: 'seta', origem: curva.origem, destino: curva.destino, rotulo: `${origem} → ${destino}` })
}

const larguraRotulo = (quantidade) => String(quantidade).length * 8 + 14

// Nós com posição pronta para o template.
const caixas = computed(() =>
  props.nos.map((no) => ({ no, pos: layout.value.posicoes[no.chave], comMetricas: temMetricas(no) })),
)
</script>

<template>
  <div class="fluxos-mapa">
    <svg
      ref="svg"
      :width="layout.largura"
      :height="layout.altura"
      :viewBox="`0 0 ${layout.largura} ${layout.altura}`"
      role="img"
      aria-label="Mapa de fluxos"
      font-family="Roboto, sans-serif"
    >
      <defs>
        <marker
          :id="marcador"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" class="ponta" />
        </marker>
      </defs>

      <!-- setas (atrás das caixas) -->
      <g v-for="(curva, i) in layout.curvas" :key="`seta-${i}`" class="seta">
        <path
          :d="curva.d"
          class="linha"
          fill="none"
          :stroke-width="espessura(curva.quantidade)"
          :marker-end="`url(#${marcador})`"
        />
        <path :d="curva.d" class="alvo" fill="none" stroke-width="12" @click="abrirSeta(curva)" />
      </g>

      <!-- nós -->
      <g v-for="{ no, pos, comMetricas } in caixas" :key="no.chave">
        <title>{{ no.rotulo }}</title>

        <!-- Cliente: círculo com "Abertos" -->
        <template v-if="no.tipo === 'cliente'">
          <circle
            :cx="pos.x + pos.largura / 2"
            :cy="pos.y + pos.altura / 2"
            :r="pos.largura / 2"
            class="cliente"
          />
          <text
            :x="pos.x + pos.largura / 2"
            :y="pos.y + pos.altura / 2 - 18"
            class="nome"
            text-anchor="middle"
            dominant-baseline="central"
          >
            {{ no.rotulo }}
          </text>
          <text
            :x="pos.x + pos.largura / 2"
            :y="pos.y + pos.altura / 2 + 2"
            class="metrica"
            text-anchor="middle"
            dominant-baseline="central"
          >
            Abertos
          </text>
          <text
            :x="pos.x + pos.largura / 2"
            :y="pos.y + pos.altura / 2 + 22"
            :class="['valor', { clicavel: clicavel(no.abertos) }]"
            text-anchor="middle"
            dominant-baseline="central"
            :role="clicavel(no.abertos) ? 'button' : undefined"
            :tabindex="clicavel(no.abertos) ? 0 : undefined"
            @click="abrirNo(no, METRICAS[0])"
            @keydown.enter.prevent="abrirNo(no, METRICAS[0])"
            @keydown.space.prevent="abrirNo(no, METRICAS[0])"
          >
            {{ no.abertos ?? '—' }}
          </text>
        </template>

        <!-- Grupo: cabeçalho com o nome e quatro linhas rótulo/valor -->
        <template v-else-if="comMetricas">
          <rect :x="pos.x" :y="pos.y" :width="pos.largura" :height="pos.altura" rx="8" class="caixa" />
          <path
            :d="`M ${pos.x} ${pos.y + MEDIDAS.alturaCabecalho} V ${pos.y + 8} Q ${pos.x} ${pos.y} ${pos.x + 8} ${pos.y}
                 H ${pos.x + pos.largura - 8} Q ${pos.x + pos.largura} ${pos.y} ${pos.x + pos.largura} ${pos.y + 8}
                 V ${pos.y + MEDIDAS.alturaCabecalho} Z`"
            class="cabecalho"
          />
          <text
            :x="pos.x + pos.largura / 2"
            :y="pos.y + MEDIDAS.alturaCabecalho / 2"
            class="nome"
            text-anchor="middle"
            dominant-baseline="central"
          >
            {{ nomeCurto(no.rotulo) }}
          </text>
          <g
            v-for="(metrica, j) in METRICAS"
            :key="metrica.chave"
            :class="['linha-metrica', { clicavel: clicavel(no[metrica.chave]) }]"
            :role="clicavel(no[metrica.chave]) ? 'button' : undefined"
            :tabindex="clicavel(no[metrica.chave]) ? 0 : undefined"
            :aria-label="`${no.rotulo} · ${metrica.curto}: ${no[metrica.chave]}`"
            @click="abrirNo(no, metrica)"
            @keydown.enter.prevent="abrirNo(no, metrica)"
            @keydown.space.prevent="abrirNo(no, metrica)"
          >
            <rect
              :x="pos.x + 4"
              :y="pos.y + MEDIDAS.alturaCabecalho + 4 + j * MEDIDAS.alturaLinha"
              :width="pos.largura - 8"
              :height="MEDIDAS.alturaLinha"
              rx="4"
              class="fundo-linha"
            />
            <text
              :x="pos.x + 12"
              :y="pos.y + MEDIDAS.alturaCabecalho + 4 + (j + 0.5) * MEDIDAS.alturaLinha"
              class="metrica"
              dominant-baseline="central"
            >
              {{ metrica.rotulo }}
            </text>
            <text
              :x="pos.x + pos.largura - 12"
              :y="pos.y + MEDIDAS.alturaCabecalho + 4 + (j + 0.5) * MEDIDAS.alturaLinha"
              class="valor"
              text-anchor="end"
              dominant-baseline="central"
            >
              {{ no[metrica.chave] ?? '—' }}
            </text>
          </g>
        </template>

        <!-- Sem grupo, Origem desconhecida, Outros grupos e vizinhos: só o nome -->
        <template v-else>
          <rect
            :x="pos.x"
            :y="pos.y"
            :width="pos.largura"
            :height="pos.altura"
            rx="8"
            class="caixa especial"
            stroke-dasharray="6 4"
          />
          <text
            :x="pos.x + pos.largura / 2"
            :y="pos.y + pos.altura / 2"
            class="nome especial"
            text-anchor="middle"
            dominant-baseline="central"
          >
            {{ nomeCurto(no.rotulo) }}
          </text>
        </template>
      </g>

      <!-- quantidade de cada seta, por cima de tudo -->
      <g
        v-for="(curva, i) in layout.curvas"
        :key="`rotulo-${i}`"
        class="rotulo-seta clicavel"
        role="button"
        tabindex="0"
        :aria-label="`${porChave.get(curva.origem)?.rotulo} → ${porChave.get(curva.destino)?.rotulo}: ${curva.quantidade}`"
        @click="abrirSeta(curva)"
        @keydown.enter.prevent="abrirSeta(curva)"
        @keydown.space.prevent="abrirSeta(curva)"
      >
        <rect
          :x="curva.rotuloX - larguraRotulo(curva.quantidade) / 2"
          :y="curva.rotuloY - 10"
          :width="larguraRotulo(curva.quantidade)"
          height="20"
          rx="10"
          class="fundo-rotulo"
        />
        <text :x="curva.rotuloX" :y="curva.rotuloY" class="quantidade" text-anchor="middle" dominant-baseline="central">
          {{ curva.quantidade }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.fluxos-mapa {
  overflow-x: auto;
  max-width: 100%;
}

svg {
  display: block;
}

.caixa {
  fill: rgb(var(--v-theme-surface));
  stroke: rgba(var(--v-theme-on-surface), 0.35);
  stroke-width: 1px;
}

.cabecalho {
  fill: rgba(var(--v-theme-primary), 0.16);
}

.especial {
  stroke: rgba(var(--v-theme-on-surface), 0.5);
}

text.especial {
  fill: rgba(var(--v-theme-on-surface), 0.7);
  stroke: none;
  font-weight: 500;
}

.cliente {
  fill: rgba(var(--v-theme-secondary), 0.14);
  stroke: rgb(var(--v-theme-secondary));
  stroke-width: 1.5px;
}

.nome {
  fill: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  font-weight: 700;
}

.metrica {
  fill: rgba(var(--v-theme-on-surface), 0.7);
  font-size: 12px;
}

.valor {
  fill: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  font-weight: 700;
}

.fundo-linha {
  fill: transparent;
}

.clicavel {
  cursor: pointer;
  outline: none;
}

.clicavel .valor,
text.valor.clicavel {
  fill: rgb(var(--v-theme-primary));
  text-decoration: underline;
}

.linha-metrica.clicavel:hover .fundo-linha,
.linha-metrica.clicavel:focus-visible .fundo-linha {
  fill: rgba(var(--v-theme-primary), 0.1);
}

text.valor.clicavel:hover,
text.valor.clicavel:focus-visible {
  fill: rgb(var(--v-theme-primary-darken-1));
}

.linha {
  stroke: rgba(var(--v-theme-on-surface), 0.45);
}

.ponta {
  fill: rgba(var(--v-theme-on-surface), 0.6);
}

.alvo {
  stroke: transparent;
  cursor: pointer;
}

.seta:hover .linha {
  stroke: rgb(var(--v-theme-primary));
}

.fundo-rotulo {
  fill: rgb(var(--v-theme-surface));
  stroke: rgba(var(--v-theme-on-surface), 0.35);
  stroke-width: 1px;
}

.rotulo-seta:hover .fundo-rotulo,
.rotulo-seta:focus-visible .fundo-rotulo {
  stroke: rgb(var(--v-theme-primary));
}

.quantidade {
  fill: rgb(var(--v-theme-on-surface));
  font-size: 12px;
  font-weight: 700;
}
</style>
