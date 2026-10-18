<script setup lang="ts">
import { folioService } from '~/services'
import type { FolioSort } from '~/services'
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from '~/utils/pagination'
import type { Column } from '~/components/DataTable.vue'
import type { Folio } from '~/types/api'

definePageMeta({ permission: 'folio.view' })

const { t } = useI18n()
const hotelCtx = useHotelContextStore()
const route = useRoute()

onMounted(() => {
  const q = Number(route.query.hotel)
  if (Number.isFinite(q) && q > 0) hotelCtx.setScope(q)
})

const hotelId = computed(() => hotelCtx.currentHotelId)
const search = ref('')
const outstandingOnly = ref(false)
const sort = ref<FolioSort>('-id')
const SORTS: FolioSort[] = ['-id', 'id', '-check_in', 'check_in', '-check_out', 'check_out']
const page = ref(1)
const perPage = ref(DEFAULT_PER_PAGE)

const list = useResource(async () => {
  if (hotelId.value == null) return null
  return folioService.listForHotel(hotelId.value, {
    search: search.value.trim() || undefined,
    outstanding: outstandingOnly.value,
    sort: sort.value,
    page: page.value,
    per_page: perPage.value,
  })
}, { immediate: false })

watch(hotelId, () => {
  if (hotelId.value != null) { page.value = 1; list.reload() }
}, { immediate: true })

watch([outstandingOnly, sort], () => {
  page.value = 1
  list.reload()
})

let debounce: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    page.value = 1
    list.reload()
  }, 300)
})

watch(perPage, () => {
  page.value = 1
  list.reload()
})

// Row figures come from the settlement summary, not `totals`: before
// checkout `totals` holds only service/loyalty lines (accommodation, fee and
// tax are posted at checkout), so it understates — or negates — the bill.
function unpaid(f: Folio): number {
  return Math.max(Number(f.settlement.total) - Number(f.settlement.paid), 0)
}

function changePage(n: number) {
  page.value = n
  list.reload()
}

const columns = computed<Column[]>(() => [
  { key: 'reservation', label: t('folioPage.reservation') },
  { key: 'guest', label: t('folioPage.guest') },
  { key: 'charges', label: t('folioPage.charges'), align: 'end' },
  { key: 'payments', label: t('folioPage.payments'), align: 'end' },
  { key: 'outstanding', label: t('folioPage.outstanding'), align: 'end' },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])
</script>

<template>
  <div>
    <PageHeader :title="t('nav.folio')" :subtitle="t('folioPage.subtitle')" />

    <NeedHotelNotice v-if="hotelId == null" />

    <template v-else>
      <FilterBar :active="outstandingOnly || !!search.trim() || sort !== '-id'" @clear="() => { outstandingOnly = false; search = ''; sort = '-id' }">
        <div class="w-full max-w-xs">
          <SearchField v-model="search" :placeholder="t('folioPage.searchPlaceholder')" />
        </div>
        <select v-model="sort" class="input w-full min-w-44 sm:w-auto" :aria-label="t('folioPage.sortBy')">
          <option v-for="s in SORTS" :key="s" :value="s">
            {{ t(`folioPage.sorts.${s}`) }}
          </option>
        </select>
        <label class="flex items-center gap-2 text-2sm text-foreground">
          <input v-model="outstandingOnly" type="checkbox">
          {{ t('folioPage.outstandingOnly') }}
        </label>
      </FilterBar>

      <DataTable
        :columns="columns"
        :rows="list.data.value?.data ?? []"
        :loading="list.pending.value"
        :error="list.error.value"
        :meta="list.data.value?.meta ?? null"
        :per-page-options="PER_PAGE_OPTIONS"
        :per-page="perPage"
        :empty-title="t('folioPage.empty')"
        @retry="list.reload"
        @page="changePage"
        @per-page="(n: number) => (perPage = n)"
      >
        <template #cell-reservation="{ row }">
          <NuxtLink :to="`/reservations/${(row as Folio).reservation.id}`" class="font-medium text-primary hover:underline">
            #{{ (row as Folio).reservation.id }}
          </NuxtLink>
        </template>
        <template #cell-guest="{ row }">
          <NuxtLink v-if="(row as Folio).reservation.guest_id" :to="`/guests/${(row as Folio).reservation.guest_id}`" class="text-primary hover:underline">
            #{{ (row as Folio).reservation.guest_id }}
          </NuxtLink>
          <span v-else class="text-muted-foreground">{{ t('common.notAvailable') }}</span>
        </template>
        <template #cell-charges="{ row }">
          <div>{{ money((row as Folio).settlement.total, (row as Folio).currency) }}</div>
          <div class="text-2xs text-muted-foreground">
            {{ (row as Folio).settlement.is_final ? t('settlement.final') : t('settlement.projected') }}
          </div>
        </template>
        <template #cell-payments="{ row }">
          {{ money((row as Folio).settlement.paid, (row as Folio).currency) }}
        </template>
        <template #cell-outstanding="{ row }">
          <span
            class="font-medium"
            :class="unpaid(row as Folio) > 0 ? 'text-warning' : 'text-foreground'"
          >
            {{ money(unpaid(row as Folio).toFixed(2), (row as Folio).currency) }}
          </span>
          <div
            v-if="(row as Folio).settlement.deposit.state === 'held' && Number((row as Folio).settlement.deposit.applied) > 0"
            class="text-2xs text-muted-foreground"
          >
            {{ t('folioPage.coveredByDeposit', { amount: money((row as Folio).settlement.deposit.applied, (row as Folio).currency) }) }}
          </div>
        </template>
        <template #cell-actions="{ row }">
          <NuxtLink :to="`/reservations/${(row as Folio).reservation.id}?tab=folio`" class="btn btn-ghost px-2 py-1 text-2sm">
            {{ t('folioPage.openWorkspace') }}
          </NuxtLink>
        </template>
      </DataTable>
    </template>
  </div>
</template>
