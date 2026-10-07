import { staffNotificationsService } from '~/services'
import type { StaffNotification } from '~/types/api'
import { staffNotificationLink } from '~/utils/staffNotifications'

// Opening an inbox entry: mark it read (best effort), switch the hotel
// scope to the notification's hotel — the target pages are hotel-scoped —
// then navigate to the related page.
export function useOpenStaffNotification() {
  const store = useStaffNotificationsStore()
  const hotelCtx = useHotelContextStore()

  async function markRead(n: StaffNotification) {
    if (n.read_at) return
    try {
      const updated = await staffNotificationsService.markRead(n.id)
      n.read_at = updated.read_at ?? new Date().toISOString()
      store.setCount(store.unreadCount - 1)
      store.changed()
    } catch {
      // Navigation still proceeds; the badge corrects itself on next poll.
    }
  }

  async function open(n: StaffNotification) {
    await markRead(n)
    const link = staffNotificationLink(n)
    if (!link) return
    hotelCtx.setScope(n.hotel_id)
    await navigateTo(link)
  }

  return { open, markRead }
}
