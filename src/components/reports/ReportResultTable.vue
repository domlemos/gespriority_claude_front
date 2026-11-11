<script setup>
import { computed } from 'vue'
import { AGRUPAMENTO_LABELS } from '@/services/reportService'

const props = defineProps({
  resultado: { type: Object, required: true },
})

// `coluna` = null ao clicar no rótulo da linha (todos os períodos).
const emit = defineEmits(['abrir-chamados'])

const comQuebra = computed(() => props.resultado.quebra && props.resultado.quebra !== 'nenhuma')
const colunas = computed(() => (comQuebra.value ? props.resultado.colunas : []))
const cabecalho = computed(
  () => AGRUPAMENTO_LABELS[props.resultado.agrupar_por] ?? props.resultado.agrupar_por,
)
const mostrarDistintos = computed(
  () => props.resultado.chamados_distintos !== props.resultado.totais.total,
)

function formatPercentual(valor) {
  return `${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function abrir(linha, coluna) {
  emit('abrir-chamados', { chave: linha.chave, coluna })
}
</script>

<template>
  <v-table density="compact" class="report-table">
    <thead>
      <tr>
        <th>{{ cabecalho }}</th>
        <th v-for="col in colunas" :key="col.chave" class="text-right">{{ col.rotulo }}</th>
        <th class="text-right">Total</th>
        <th class="text-right">%</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="linha in resultado.linhas" :key="linha.chave">
        <td>
          <a
            v-if="linha.total > 0"
            href="#"
            class="report-link"
            @click.prevent="abrir(linha, null)"
          >{{ linha.rotulo }}</a>
          <span v-else>{{ linha.rotulo }}</span>
        </td>
        <td v-for="col in colunas" :key="col.chave" class="text-right">
          <a
            v-if="linha.celulas[col.chave] > 0"
            href="#"
            class="report-link"
            @click.prevent="abrir(linha, col.chave)"
          >{{ linha.celulas[col.chave] }}</a>
          <span v-else>{{ linha.celulas[col.chave] ?? 0 }}</span>
        </td>
        <td class="text-right font-weight-medium">
          <a
            v-if="linha.total > 0"
            href="#"
            class="report-link"
            @click.prevent="abrir(linha, null)"
          >{{ linha.total }}</a>
          <span v-else>{{ linha.total }}</span>
        </td>
        <td class="text-right">{{ formatPercentual(linha.percentual) }}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="font-weight-bold">
        <td>Total</td>
        <td v-for="col in colunas" :key="col.chave" class="text-right">
          {{ resultado.totais.celulas[col.chave] ?? 0 }}
        </td>
        <td class="text-right">{{ resultado.totais.total }}</td>
        <td class="text-right">{{ formatPercentual(resultado.totais.total > 0 ? 100 : 0) }}</td>
      </tr>
      <tr v-if="mostrarDistintos">
        <td :colspan="colunas.length + 3" class="text-caption text-medium-emphasis">
          Chamados distintos no resultado: {{ resultado.chamados_distintos }}
        </td>
      </tr>
    </tfoot>
  </v-table>
</template>

<style scoped>
.report-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.report-link:hover {
  text-decoration: underline;
}
.report-table tfoot td {
  border-top: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
