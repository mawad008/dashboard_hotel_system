<script setup lang="ts">
import { staffNotificationsService } from '~/services'
import type { StaffNotification } from '~/types/api'
import { ApiError } from '~/utils/apiError'

// Header bell: unread badge (polled via the shared store) and a panel with
// the latest entries. Only rendered for users with `notifications.view`.
const PANEL_SIZE = 8

const { t } = useI18n()
const store = useStaffNotificationsStore()
const { open: openNotification } = useOpenStaffNotification()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const items = ref<StaffNotification[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const markingAll = ref(false)

const badge = computed(() => (store.unreadCount > 99 ? '99+' : String(store.unreadCount)))

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await staffNotificationsService.list({ per_page: PANEL_SIZE })
    items.value = res.data
    store.setCount(Number(res.meta.unread_count ?? 0))
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('errors.genericBody')
  } finally {
    loading.value = false
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) load()
}

async function markAll() {
  if (markingAll.value) return
  markingAll.value = true
  try {
    await staffNotificationsService.markAllRead()
    const now = new Date().toISOString()
    items.value.forEach((n) => { n.read_at ??= now })
    store.setCount(0)
    store.changed()
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : t('errors.genericBody')
  } finally {
    markingAll.value = false
  }
}

async function onOpen(n: StaffNotification) {
  open.value = false
  await openNotification(n)
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  store.startPolling()
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  store.stopPolling()
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="btn btn-ghost relative rounded-lg border border-transparent px-2 py-1.5 hover:border-border"
      :aria-label="store.unreadCount ? t('staffNotifications.bellUnread', { count: store.unreadCount }) : t('staffNotifications.title')"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <KtIcon name="notification" class="text-lg" />
      <span
        v-if="store.unreadCount > 0"
        class="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
      >
        {{ badge }}
      </span>
    </button>

    <Transition name="dd">
      <div
        v-if="open"
        class="card absolute end-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden shadow-lg"
        role="dialog"
        :aria-label="t('staffNotifications.title')"
      >
        <div class="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span class="text-sm font-semibold text-foreground">{{ t('staffNotifications.title') }}</span>
          <button
            v-if="store.unreadCount > 0"
            type="button"
            class="text-xs font-medium text-primary hover:underline disabled:opacity-60"
            :disabled="markingAll"
            @click="markAll"
          >
            {{ t('staffNotifications.markAllRead') }}
          </button>
        </div>

        <div class="max-h-[26rem] overflow-y-auto p-1">
          <div v-if="loading && items.length === 0" class="px-3 py-6 text-center text-2sm text-muted-foreground">
            <KtIcon name="loading" class="animate-spin" /> {{ t('common.loading') }}
          </div>
          <div v-else-if="error" class="px-3 py-6 text-center text-2sm">
            <p class="text-destructive">{{ error }}</p>
            <button type="button" class="btn btn-ghost mt-1 px-2 py-1 text-2xs" @click="load">
              {{ t('common.retry') }}
            </button>
          </div>
          <div v-else-if="items.length === 0" class="px-3 py-8 text-center">
            <KtIcon name="notification-on" class="text-2xl text-muted-foreground" />
            <p class="mt-2 text-2sm text-muted-foreground">{{ t('staffNotifications.empty') }}</p>
          </div>
          <StaffNotificationItem
            v-for="n in items"
            v-else
            :key="n.id"
            :notification="n"
            compact
            @open="onOpen"
          />
        </div>

        <NuxtLink
          to="/notifications"
          class="block border-t border-border px-4 py-2.5 text-center text-2sm font-medium text-primary hover:bg-secondary"
          @click="open = false"
        >
          {{ t('staffNotifications.viewAll') }}
        </NuxtLink>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dd-enter-active,
.dd-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.dd-enter-from,
.dd-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
