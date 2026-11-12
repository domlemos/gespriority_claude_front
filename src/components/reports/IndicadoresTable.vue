<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Resposta de `GET /relatorios/indicadores`.
  resultado: { type: Object, required: true },
})

// `coluna` = null no Total do indicador (todos os períodos da linha).
const emit = defineEmits(['abrir-chamados'])

const comQuebra = computed(() => props.resultado.quebra !== 'nenhuma')
// Sem quebra a única coluna de período é o próprio Total; só o Total aparece.
const periodos = computed(() => (comQuebra.value ? props.resultado.colunas : []))
const cabecalhoLinha = computed(() => (props.resultado.por_integrante ? 'Integrante' : 'Grupo'))

function abrir(linha, indicador, coluna) {
  emit('abrir-chamados', { chave: linha.chave, indicador: indicador.chave, coluna, rotulo: linha.rotulo })
}
</script>

<template>
  <v-table density="compact" class="indicadores-table">
    <thead>
      <tr>
        <th rowspan="2">{{ cabecalhoLinha }}</th>
        <th
          v-for="ind in resultado.indicadores"
          :key="ind.chave"
          :colspan="periodos.length + 1"
          class="text-center bloco"
        >
          {{ ind.rotulo }}
        </th>
      </tr>
      <tr>
        <template v-for="ind in resultado.indicadores" :key="ind.chave">
          <th
            v-for="(col, i) in periodos"
            :key="col.chave"
            class="text-right"
            :class="{ bloco: i === 0 }"
          >
            {{ col.rotulo }}
          </th>
          <th class="text-right" :class="{ bloco: !periodos.length }">Total</th>
        </template>
      </tr>
    </thead>
    <tbody>
      <tr v-for="linha in resultado.linhas" :key="linha.chave">
        <td>{{ linha.rotulo }}</td>
        <template v-for="ind in resultado.indicadores" :key="ind.chave">
          <td
            v-for="(col, i) in periodos"
            :key="col.chave"
            class="text-right"
            :class="{ bloco: i === 0 }"
          >
            <a
              v-if="linha.valores[ind.chave].celulas[col.chave] > 0"
              href="#"
              class="report-link"
              @click.prevent="abrir(linha, ind, col.chave)"
            >{{ linha.valores[ind.chave].celulas[col.chave] }}</a>
            <span v-else>{{ linha.valores[ind.chave].celulas[col.chave] ?? 0 }}</span>
          </td>
          <td class="text-right font-weight-medium" :class="{ bloco: !periodos.length }">
            <a
              v-if="linha.valores[ind.chave].total > 0"
              href="#"
              class="report-link"
              @click.prevent="abrir(linha, ind, null)"
            >{{ linha.valores[ind.chave].total }}</a>
            <span v-else>{{ linha.valores[ind.chave].total }}</span>
          </td>
        </template>
      </tr>
    </tbody>
    <tfoot>
      <tr class="font-weight-bold">
        <td>Total</td>
        <template v-for="ind in resultado.indicadores" :key="ind.chave">
          <td
            v-for="(col, i) in periodos"
            :key="col.chave"
            class="text-right"
            :class="{ bloco: i === 0 }"
          >
            {{ resultado.totais[ind.chave].celulas[col.chave] ?? 0 }}
          </td>
          <td class="text-right" :class="{ bloco: !periodos.length }">{{ resultado.totais[ind.chave].total }}</td>
        </template>
      </tr>
      <tr class="text-medium-emphasis">
        <td>Chamados distintos</td>
        <template v-for="ind in resultado.indicadores" :key="ind.chave">
          <td v-for="(col, i) in periodos" :key="col.chave" :class="{ bloco: i === 0 }" />
          <td class="text-right" :class="{ bloco: !periodos.length }">{{ resultado.distintos[ind.chave] }}</td>
        </template>
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
.indicadores-table .bloco {
  border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.indicadores-table tfoot tr:first-child td {
  border-top: 2px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.indicadores-table th,
.indicadores-table td {
  white-space: nowrap;
}
</style>
