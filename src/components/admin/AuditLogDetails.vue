<script setup>
// Detalhes de um log de auditoria (diff, campos alterados ou parâmetros).
// Usado na linha expandida da tabela e no card do modo mobile.
defineProps({
  item: { type: Object, required: true },
  details: { type: Object, required: true },
})
</script>

<template>
  <template v-if="details.tipo === 'diff'">
    <v-table density="compact" class="bg-transparent">
      <thead>
        <tr><th>{{ $t('admin.auditLogs.field') }}</th><th>{{ $t('admin.auditLogs.from') }}</th><th>{{ $t('admin.auditLogs.to') }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="linha in details.linhas" :key="linha.campo">
          <td class="font-weight-medium">{{ linha.campo }}</td>
          <td class="text-medium-emphasis">{{ linha.de }}</td>
          <td>{{ linha.para }}</td>
        </tr>
      </tbody>
    </v-table>
  </template>
  <div v-else-if="details.tipo === 'campos'" class="text-body-2">
    {{ $t('admin.auditLogs.changedFields') }} <strong>{{ details.campos.join(', ') }}</strong>
    <span class="text-medium-emphasis">{{ $t('admin.auditLogs.changedFieldsHint') }}</span>
  </div>
  <v-table v-else-if="details.tipo === 'parametros'" density="compact" class="bg-transparent">
    <thead>
      <tr><th>{{ $t('admin.auditLogs.parameter') }}</th><th>{{ $t('admin.auditLogs.value') }}</th></tr>
    </thead>
    <tbody>
      <tr v-for="linha in details.linhas" :key="linha.campo">
        <td class="font-weight-medium">{{ linha.campo }}</td>
        <td>{{ linha.valor }}</td>
      </tr>
    </tbody>
  </v-table>
  <div v-else class="text-body-2 text-medium-emphasis">{{ $t('admin.auditLogs.noDetails') }}</div>

  <div v-if="item.user_agent" class="text-caption text-medium-emphasis mt-2">{{ $t('admin.auditLogs.browser', { agent: item.user_agent }) }}</div>
</template>
