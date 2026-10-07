<script setup lang="ts">
import type { StaffNotification } from '~/types/api'
import { STAFF_NOTIFICATION_META } from '~/utils/staffNotifications'
import { dateTime, relativeTime } from '~/utils/format'

const props = defineProps<{ notification: StaffNotification, compact?: boolean }>()
defineEmits<{ open: [StaffNotification] }>()

const { t, locale } = useI18n()
const hotelName = useHotelName()

const meta = computed(() => STAFF_NOTIFICATION_META[props.notification.type] ?? { icon: 'notification' })
const unread = computed(() => props.notification.read_at == null)
const hotel = computed(() => hotelName({
  name: props.notification.hotel_name,
  name_i18n: props.notification.hotel_name_i18n,
}))
</script>

<template>
  <button
    type="button"
    class="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-secondary"
    :class="unread ? 'bg-primary/5' : ''"
    @click="$emit('open', notification)"
  >
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-lg"
      :class="notification.needs_attention ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'"
    >
      <KtIcon :name="meta.icon" />
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-2">
        <span class="truncate text-2sm text-foreground" :class="unread ? 'font-semibold' : 'font-medium'">
          {{ t(`staffNotifications.types.${notification.type}`) }}
        </span>
        <span
          v-if="notification.needs_attention && !compact"
          class="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-2xs font-medium text-destructive"
        >
          {{ t('staffNotifications.needsAttention') }}
        </span>
      </span>
      <span class="mt-0.5 block truncate text-xs text-muted-foreground">
        <template v-if="notification.reservation_id">
          {{ t('staffNotifications.reservationRef', { id: notification.reservation_id }) }} ·
        </template>
        {{ hotel }}
      </span>
      <span class="mt-0.5 block text-2xs text-muted-foreground" :title="dateTime(notification.created_at)">
        {{ relativeTime(notification.created_at, locale) }}
      </span>
    </span>

    <span
      v-if="unread"
      class="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
      :aria-label="t('staffNotifications.unread')"
    />
  </button>
</template>
