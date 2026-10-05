<script setup lang="ts">
import { hotelsService, reservationsService } from '~/services'
import type { Column } from '~/components/DataTable.vue'
import type { Reservation, ReservationStatus } from '~/types/api'
import { RESERVATION_STATUSES, RESERVATION_STATUS_TONE } from '~/utils/reservationStateMachine'
import { date, money } from '~/utils/format'

definePageMeta({ permission: 'reservations.view' })

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const { can } = useCan()

const PER_PAGE_OPTIONS = [10, 15, 20]

const page = ref(1)
const perPage = ref(15)
const statusFilter = ref<ReservationStatus | ''>('')
const hotelFilter = ref<number | ''>('')
const search = ref('')
const checkInFrom = ref('')
const checkInTo = ref('')

// All filtering is server-side, across every page.
const list = useResource(() => reservationsService.list({
  page: page.value,
  per_page: perPage.value,
  search: search.value.trim() || undefined,
  status: statusFilter.value || undefined,
  hotel_id: hotelFilter.value || undefined,
  check_in_from: checkInFrom.value || undefined,
  check_in_to: checkInTo.value || undefined,
}))

// Hotel names + filter options. A Group Owner has no assigned hotels, so
// load the (scoped) hotel list instead of relying on auth.assignedHotels.
const hotels = useResource(() => hotelsService.list({ per_page: 100, sort: 'name' }))
const hotelOptions = computed(() => hotels.data.value?.data ?? auth.assignedHotels)
const displayHotelName = useHotelName()
const hotelName = (hotelId: number) => {
  const h = hotelOptions.value.find(h => h.id === hotelId)
  return h ? displayHotelName(h) : `#${hotelId}`
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    page.value = 1
    list.reload()
  }, 300)
})

watch([statusFilter, hotelFilter, checkInFrom, checkInTo, perPage], () => {
  page.value = 1
  list.reload()
})

const filtersActive = computed(() =>
  search.value.trim() !== '' || !!statusFilter.value || !!hotelFilter.value
  || !!checkInFrom.value || !!checkInTo.value,
)

function clearFilters() {
  search.value = ''
  statusFilter.value = ''
  hotelFilter.value = ''
  checkInFrom.value = ''
  checkInTo.value = ''
}

const columns: Column[] = [
  { key: 'id', label: t('reservations.id') },
  { key: 'hotel_id', label: t('reservations.hotel') },
  { key: 'check_in', label: t('reservations.checkIn'), nowrap: true },
  { key: 'check_out', label: t('reservations.checkOut'), nowrap: true },
  { key: 'price_snapshot', label: t('reservations.price'), align: 'end' },
  { key: 'status', label: t('reservations.status') },
]

function changePage(n: number) {
  page.value = n
  list.reload()
}

</script>

<template>
  <div>
    <PageHeader :title="t('reservations.title')" :subtitle="t('reservations.subtitle')">
      <template v-if="can('reservations.manage')" #actions>
        <NuxtLink to="/reservations/new" class="btn btn-primary">
          <KtIcon name="plus" /> {{ t('reservations.new') }}
        </NuxtLink>
      </template>
    </PageHeader>

    <div class="mb-3 flex flex-wrap items-end gap-3">
      <div class="max-w-xs grow">
        <SearchField v-model="search" :placeholder="t('reservations.searchPlaceholder')" />
      </div>
      <FormField :label="t('reservations.filterStatus')">
        <select v-model="statusFilter" class="input min-w-44">
          <option value="">
            {{ t('common.all') }}
          </option>
          <option v-for="s in RESERVATION_STATUSES" :key="s" :value="s">
            {{ t(`status.${s}`) }}
          </option>
        </select>
      </FormField>
      <FormField v-if="hotelOptions.length > 1" :label="t('reservations.filterHotel')">
        <select v-model="hotelFilter" class="input min-w-44">
          <option value="">
            {{ t('common.all') }}
          </option>
          <option v-for="h in hotelOptions" :key="h.id" :value="h.id">
            {{ displayHotelName(h) }}
          </option>
        </select>
      </FormField>
      <FormField :label="`${t('reservations.checkIn')} — ${t('common.from')}`">
        <input v-model="checkInFrom" type="date" class="input" :max="checkInTo || undefined">
      </FormField>
      <FormField :label="`${t('reservations.checkIn')} — ${t('common.to')}`">
        <input v-model="checkInTo" type="date" class="input" :min="checkInFrom || undefined">
      </FormField>
      <button v-if="filtersActive" type="button" class="btn btn-secondary" @click="clearFilters">
        <KtIcon name="close" /> {{ t('common.clear') }}
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="list.data.value?.data ?? []"
      :loading="list.pending.value"
      :error="list.error.value"
      :meta="list.data.value?.meta ?? null"
      :per-page-options="PER_PAGE_OPTIONS"
      :per-page="perPage"
      clickable-rows
      @retry="list.reload"
      @page="changePage"
      @per-page="(n: number) => (perPage = n)"
      @row-click="(row: Reservation) => router.push(`/reservations/${row.id}`)"
    >
      <template #cell-id="{ row }">
        <span class="font-medium text-primary">#{{ (row as Reservation).id }}</span>
      </template>
      <template #cell-hotel_id="{ row }">
        {{ hotelName((row as Reservation).hotel_id) }}
      </template>
      <template #cell-check_in="{ row }">
        {{ date((row as Reservation).check_in) }}
      </template>
      <template #cell-check_out="{ row }">
        {{ date((row as Reservation).check_out) }}
      </template>
      <template #cell-price_snapshot="{ row }">
        {{ money((row as Reservation).price_snapshot) }}
      </template>
      <template #cell-status="{ row }">
        <StatusBadge
          :label="t(`status.${(row as Reservation).status}`)"
          :tone="RESERVATION_STATUS_TONE[(row as Reservation).status]"
        />
      </template>
    </DataTable>
  </div>
</template>
