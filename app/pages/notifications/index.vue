<script setup lang="ts">
import { notificationsService, staffNotificationsService } from '~/services'
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from '~/utils/pagination'
import type { Column } from '~/components/DataTable.vue'
import type { AppNotification, StaffNotification } from '~/types/api'
import { NOTIFICATION_STATUS_TONE } from '~/utils/statusMeta'
import { ApiError } from '~/utils/apiError'

definePageMeta({ permission: 'notifications.view' })

const { t } = useI18n()
const app = useAppStore()
const hotelCtx = useHotelContextStore()
const route = useRoute()
const router = useRouter()

// ---------------------------------------------------------------------
// Tabs — "mine" is the signed-in user's own inbox (fed by operational
// events); "guests" is the hotel's guest-notification delivery log.
// ---------------------------------------------------------------------

type TabKey = 'mine' | 'guests'
const tab = ref<TabKey>(route.query.tab === 'guests' ? 'guests' : 'mine')
const staffStore = useStaffNotificationsStore()

const tabs = computed(() => [
  { key: 'mine' as const, label: t('staffNotifications.myTab'), count: staffStore.unreadCount || null },
  { key: 'guests' as const, label: t('staffNotifications.guestsTab') },
])

watch(tab, (v) => {
  router.replace({ query: { ...route.query, tab: v === 'mine' ? undefined : v } })
  if (v === 'guests' && hotelId.value != null && !list.data.value) list.reload()
})

// ---------------------------------------------------------------------
// My notifications
// ---------------------------------------------------------------------

const { open: openNotification } = useOpenStaffNotification()
const inboxUnreadOnly = ref(false)
const inboxPage = ref(1)
const inboxPerPage = ref(DEFAULT_PER_PAGE)
const markingAll = ref(false)

const inbox = useResource(() => staffNotificationsService.list({
  unread: inboxUnreadOnly.value,
  page: inboxPage.value,
  per_page: inboxPerPage.value,
}))

watch(() => inbox.data.value?.meta?.unread_count, (n) => {
  if (n != null) staffStore.setCount(Number(n))
})

watch([inboxUnreadOnly, inboxPerPage], () => {
  inboxPage.value = 1
  inbox.reload()
})

// The bell (or a poll) changed the inbox — keep this list in sync.
watch(() => staffStore.version, () => inbox.reload())

function changeInboxPage(n: number) {
  inboxPage.value = n
  inbox.reload()
}

async function markAllInbox() {
  if (markingAll.value) return
  markingAll.value = true
  try {
    await staffNotificationsService.markAllRead()
    staffStore.setCount(0)
    staffStore.changed()
  } catch (e) {
    app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  } finally {
    markingAll.value = false
  }
}

async function openInboxItem(n: StaffNotification) {
  await openNotification(n)
}

// ---------------------------------------------------------------------
// Guest notifications (hotel delivery log)
// ---------------------------------------------------------------------

onMounted(() => {
  const q = Number(route.query.hotel)
  if (Number.isFinite(q) && q > 0) hotelCtx.setScope(q)
})

const hotelId = computed(() => hotelCtx.currentHotelId)
const unreadOnly = ref(false)
const page = ref(1)
const perPage = ref(DEFAULT_PER_PAGE)

const list = useResource(async () => {
  if (hotelId.value == null) return null
  return notificationsService.forHotel(hotelId.value, { unread: unreadOnly.value, page: page.value, per_page: perPage.value })
}, { immediate: false })

watch(hotelId, () => {
  if (hotelId.value != null && tab.value === 'guests') { page.value = 1; list.reload() }
}, { immediate: true })

watch(unreadOnly, () => {
  page.value = 1
  list.reload()
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
  { key: 'subject', label: t('notificationsPage.type') },
  { key: 'notificationStatus', label: t('notificationsPage.notificationStatus') },
  { key: 'created_at', label: t('notificationsPage.created') },
  { key: 'read', label: t('notificationsPage.read') },
  { key: 'actions', label: t('common.actions'), align: 'end' },
])

const marking = ref<number | null>(null)
async function markRead(n: AppNotification) {
  if (marking.value) return
  marking.value = n.id
  try {
    await notificationsService.markRead(n.reservation_id, n.id)
    app.pushToast('success', t('notificationsPage.markRead'))
    list.reload()
  } catch (e) {
    app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  } finally {
    marking.value = null
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('nav.notifications')" :subtitle="t('staffNotifications.subtitle')" />

    <AppTabs v-model="tab" :tabs="tabs" class="mb-4" />

    <!-- My notifications -->
    <div v-if="tab === 'mine'" class="card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <label class="flex items-center gap-2 text-2sm text-foreground">
          <input v-model="inboxUnreadOnly" type="checkbox">
          {{ t('notificationsPage.unreadOnly') }}
        </label>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="markingAll || staffStore.unreadCount === 0"
          @click="markAllInbox"
        >
          <KtIcon name="check" />
          {{ t('staffNotifications.markAllRead') }}
        </button>
      </div>

      <LoadingState v-if="inbox.pending.value && !inbox.data.value" />
      <ErrorState v-else-if="inbox.error.value" :error="inbox.error.value" @retry="inbox.reload" />
      <EmptyState
        v-else-if="(inbox.data.value?.data ?? []).length === 0"
        icon="notification-on"
        :title="inboxUnreadOnly ? t('staffNotifications.emptyUnread') : t('staffNotifications.empty')"
        :body="t('staffNotifications.emptyHint')"
      />
      <div v-else class="divide-y divide-border p-1">
        <StaffNotificationItem
          v-for="n in inbox.data.value?.data ?? []"
          :key="n.id"
          :notification="n"
          @open="openInboxItem"
        />
      </div>

      <div v-if="inbox.data.value?.meta && inbox.data.value.data.length" class="border-t border-border px-4 py-3">
        <Pagination
          :meta="inbox.data.value.meta"
          :per-page-options="PER_PAGE_OPTIONS"
          :per-page="inboxPerPage"
          @page="changeInboxPage"
          @per-page="(n: number) => (inboxPerPage = n)"
        />
      </div>
    </div>

    <!-- Guest notifications -->
    <NeedHotelNotice v-else-if="hotelId == null" />

    <template v-else>
      <p class="mb-3 text-2sm text-muted-foreground">
        {{ t('notificationsPage.subtitle') }}
      </p>
      <FilterBar :active="unreadOnly" @clear="unreadOnly = false">
        <label class="flex items-center gap-2 text-2sm text-foreground">
          <input v-model="unreadOnly" type="checkbox">
          {{ t('notificationsPage.unreadOnly') }}
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
        :empty-title="t('notificationsPage.empty')"
        @retry="list.reload"
        @page="changePage"
        @per-page="(n: number) => (perPage = n)"
      >
        <template #cell-subject="{ row }">
          <div class="min-w-0">
            <div class="truncate font-medium text-foreground">
              {{ (row as AppNotification).subject }}
            </div>
            <NuxtLink
              :to="`/reservations/${(row as AppNotification).reservation_id}?tab=notifications`"
              class="text-2xs text-primary hover:underline"
            >
              #{{ (row as AppNotification).reservation_id }}
            </NuxtLink>
          </div>
        </template>
        <template #cell-notificationStatus="{ row }">
          <StatusBadge
            :label="t(`status.${(row as AppNotification).status}`)"
            :tone="NOTIFICATION_STATUS_TONE[(row as AppNotification).status]"
          />
        </template>
        <template #cell-created_at="{ row }">
          {{ dateTime((row as AppNotification).created_at) }}
        </template>
        <template #cell-read="{ row }">
          <span v-if="(row as AppNotification).is_read" class="text-2sm text-muted-foreground">
            {{ t('common.yes') }}
          </span>
          <span v-else class="text-2sm font-medium text-primary">
            {{ t('common.no') }}
          </span>
        </template>
        <template #cell-actions="{ row }">
          <button
            v-if="!(row as AppNotification).is_read"
            type="button"
            class="btn btn-ghost px-2 py-1 text-2sm"
            :disabled="marking === (row as AppNotification).id"
            @click="markRead(row as AppNotification)"
          >
            {{ t('notificationsPage.markRead') }}
          </button>
        </template>
      </DataTable>
    </template>
  </div>
</template>
