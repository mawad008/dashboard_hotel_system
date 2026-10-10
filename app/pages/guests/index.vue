<script setup lang="ts">
import { guestsService } from '~/services'
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from '~/utils/pagination'
import type { Column } from '~/components/DataTable.vue'
import type { Guest } from '~/types/api'

definePageMeta({ permission: 'guests.view' })

const { t } = useI18n()
const router = useRouter()

const page = ref(1)
const perPage = ref(DEFAULT_PER_PAGE)
const search = ref('')

function params() {
  return { page: page.value, per_page: perPage.value, search: search.value.trim() || undefined }
}

const list = useResource(() => guestsService.list(params()))

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

function changePage(n: number) {
  page.value = n
  list.reload()
}

const columns = computed<Column[]>(() => [
  { key: 'name', label: t('guestsPage.name') },
  { key: 'email', label: t('guestsPage.email') },
  { key: 'phone', label: t('guestsPage.phone') },
  { key: 'reservations_count', label: t('guestsPage.reservations'), align: 'end' as const },
])
</script>

<template>
  <div>
    <PageHeader :title="t('nav.guests')" :subtitle="t('guestsPage.subtitle')" />

    <div class="mb-3 max-w-xs">
      <SearchField v-model="search" :placeholder="t('guestsPage.searchPlaceholder')" />
    </div>

    <DataTable
      :columns="columns"
      :rows="list.data.value?.data ?? []"
      :loading="list.pending.value"
      :error="list.error.value"
      :meta="list.data.value?.meta ?? null"
      :per-page-options="PER_PAGE_OPTIONS"
      :per-page="perPage"
      :empty-title="t('guestsPage.empty')"
      clickable-rows
      @retry="list.reload"
      @page="changePage"
      @per-page="(n: number) => (perPage = n)"
      @row-click="(row: Guest) => router.push(`/guests/${row.id}`)"
    >
      <template #cell-name="{ row }">
        <span class="font-medium text-foreground">{{ (row as Guest).name || t('guestsPage.unnamed') }}</span>
      </template>
      <template #cell-email="{ row }">
        {{ (row as Guest).email || t('common.notAvailable') }}
      </template>
      <template #cell-reservations_count="{ row }">
        {{ (row as Guest).reservations_count ?? 0 }}
      </template>
    </DataTable>
  </div>
</template>
