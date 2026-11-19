<script setup>
// Envolve `v-data-table-server` (ou `v-data-table`, com `server: false`) e,
// em telas pequenas, troca as linhas por cards. A tabela continua montada
// nos dois modos — só cabeçalho e corpo somem —, então paginação, rodapé e
// o `update:options` que as views usam pra carregar dados seguem iguais.
//
// No modo card, cada coluna vira um par rótulo/valor reaproveitando o slot
// `item.<key>` da view (ou o valor cru); a primeira coluna vira o título e a
// coluna `actions` vai pro rodapé do card. Uma view pode trocar o card
// inteiro pelo slot `card`, e acrescentar um bloco expansível com
// `card-details`.
import { computed, ref, useAttrs, useSlots } from 'vue'
import { useDisplay, useLocale } from 'vuetify'
import { VDataTable, VDataTableServer } from 'vuetify/components/VDataTable'
import { useI18n } from 'vue-i18n'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  headers: { type: Array, required: true },
  server: { type: Boolean, default: true },
  // Até qual breakpoint (inclusive) a lista vira cards: 'sm' (< 960px) ou
  // 'md' (< 1280px, pra tabelas largas demais até em tablet deitado).
  cardsUpTo: { type: String, default: 'sm' },
})

const { t } = useI18n()
const { t: vt } = useLocale()
const attrs = useAttrs()
const slots = useSlots()
const display = useDisplay()

const cardMode = computed(() => (props.cardsUpTo === 'md' ? display.mdAndDown.value : display.smAndDown.value))

const OWN_SLOTS = ['card', 'card-details', 'top']
const forwardedSlots = computed(() => Object.keys(slots).filter((name) => !OWN_SLOTS.includes(name)))

const sortBy = ref([])
const sortableHeaders = computed(() => props.headers.filter((header) => header.sortable === true))
const sortKey = computed({
  get: () => sortBy.value[0]?.key ?? null,
  set: (key) => {
    sortBy.value = key ? [{ key, order: sortBy.value[0]?.order ?? 'asc' }] : []
  },
})
function toggleSortOrder() {
  const [current] = sortBy.value
  if (!current) return
  sortBy.value = [{ key: current.key, order: current.order === 'asc' ? 'desc' : 'asc' }]
}

// Colunas internas do Vuetify (`data-table-expand`, `data-table-select`) não
// viram campo do card.
const dataColumns = computed(() =>
  props.headers.filter((header) => header.key !== 'actions' && !header.key?.startsWith('data-table-')),
)
const titleColumn = computed(() => dataColumns.value[0])
const fieldColumns = computed(() => dataColumns.value.slice(1))
const hasActions = computed(() => props.headers.some((header) => header.key === 'actions'))

const rowClickHandler = computed(() => attrs['onClick:row'])
function onCardClick(event, item, index) {
  rowClickHandler.value?.(event, { item, index })
}

const noDataText = computed(() => attrs['no-data-text'] ?? attrs.noDataText ?? vt('$vuetify.noDataText'))

const itemKey = (item, index) => item?.[attrs['item-value'] ?? attrs.itemValue ?? 'id'] ?? index

const openDetails = ref(new Set())
function toggleDetails(key) {
  const next = new Set(openDetails.value)
  next.has(key) ? next.delete(key) : next.add(key)
  openDetails.value = next
}

function cellScope(item, column, index) {
  return { item, column, index, value: item?.[column.key] }
}

function isEmpty(value) {
  return value === null || value === undefined || value === ''
}
</script>

<template>
  <component
    :is="server ? VDataTableServer : VDataTable"
    v-bind="attrs"
    v-model:sort-by="sortBy"
    :headers="headers"
    :hide-default-header="cardMode"
    :hide-default-body="cardMode"
    :class="['responsive-data-table', { 'responsive-data-table--cards': cardMode }]"
  >
    <template v-for="name in forwardedSlots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}" />
    </template>

    <template #top="scope">
      <slot name="top" v-bind="scope" />

      <template v-if="cardMode">
        <div v-if="sortableHeaders.length" class="d-flex align-center ga-2 mb-3">
          <v-select
            v-model="sortKey"
            :items="sortableHeaders"
            item-title="title"
            item-value="key"
            :label="t('common.sortBy')"
            density="compact"
            variant="outlined"
            clearable
            hide-details
          />
          <v-btn
            :icon="sortBy[0]?.order === 'desc' ? 'mdi-sort-descending' : 'mdi-sort-ascending'"
            :aria-label="sortBy[0]?.order === 'desc' ? t('common.sortDesc') : t('common.sortAsc')"
            :disabled="!sortBy.length"
            variant="text"
            @click="toggleSortOrder"
          />
        </div>

        <v-progress-linear v-if="attrs.loading" indeterminate color="primary" class="mb-2" />

        <div v-if="!scope.items.length && !attrs.loading" class="text-body-2 text-medium-emphasis text-center py-8">
          {{ noDataText }}
        </div>

        <v-row density="comfortable">
          <v-col v-for="(item, index) in scope.items" :key="itemKey(item, index)" cols="12" sm="6" :md="cardsUpTo === 'md' ? 4 : undefined">
            <slot name="card" :item="item" :index="index" :click="(event) => onCardClick(event, item, index)">
              <v-card
                variant="outlined"
                class="h-100 d-flex flex-column"
                v-bind="rowClickHandler ? { onClick: (event) => onCardClick(event, item, index) } : {}"
              >
                <v-card-item v-if="titleColumn">
                  <div class="text-caption text-medium-emphasis">{{ titleColumn.title }}</div>
                  <div class="text-subtitle-1 font-weight-bold text-break">
                    <slot :name="`item.${titleColumn.key}`" v-bind="cellScope(item, titleColumn, index)">
                      {{ isEmpty(item[titleColumn.key]) ? '—' : item[titleColumn.key] }}
                    </slot>
                  </div>
                </v-card-item>

                <v-card-text v-if="fieldColumns.length" class="pt-0 flex-grow-1">
                  <div
                    v-for="column in fieldColumns"
                    :key="column.key"
                    class="d-flex justify-space-between align-start ga-4 py-1 card-field"
                  >
                    <span class="text-caption text-medium-emphasis flex-shrink-0">{{ column.title }}</span>
                    <div class="text-body-2 text-end text-break">
                      <slot :name="`item.${column.key}`" v-bind="cellScope(item, column, index)">
                        {{ isEmpty(item[column.key]) ? '—' : item[column.key] }}
                      </slot>
                    </div>
                  </div>
                </v-card-text>

                <template v-if="slots['card-details'] || hasActions">
                  <v-divider />
                  <v-card-actions>
                    <v-btn
                      v-if="slots['card-details']"
                      variant="text"
                      size="small"
                      :append-icon="openDetails.has(itemKey(item, index)) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                      @click="toggleDetails(itemKey(item, index))"
                    >
                      {{ t('common.details') }}
                    </v-btn>
                    <v-spacer />
                    <slot v-if="hasActions" name="item.actions" v-bind="cellScope(item, { key: 'actions' }, index)" />
                  </v-card-actions>
                  <v-expand-transition>
                    <div v-if="slots['card-details'] && openDetails.has(itemKey(item, index))">
                      <v-divider />
                      <div class="pa-3">
                        <slot name="card-details" :item="item" :index="index" />
                      </div>
                    </div>
                  </v-expand-transition>
                </template>
              </v-card>
            </slot>
          </v-col>
        </v-row>
      </template>
    </template>
  </component>
</template>

<style scoped>
.responsive-data-table--cards {
  background: transparent;
}

/* No modo card a <table> fica vazia; some com ela pra não sobrar borda. */
.responsive-data-table--cards :deep(.v-table__wrapper) {
  display: none;
}

.responsive-data-table--cards :deep(.v-data-table-footer) {
  flex-wrap: wrap;
  justify-content: center;
  padding-inline: 0;
}

.card-field + .card-field {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
