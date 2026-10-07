import type { StaffNotification, StaffNotificationType } from '~/types/api'

// Presentation for each staff-inbox event: its icon and where opening it
// leads. `tab` deep-links the reservation workspace (`?tab=`).
export const STAFF_NOTIFICATION_META: Record<StaffNotificationType, { icon: string, tab?: string }> = {
  booking_created: { icon: 'calendar-add', tab: 'overview' },
  booking_cancelled: { icon: 'calendar-remove', tab: 'overview' },
  deposit_received: { icon: 'wallet', tab: 'payment' },
  payment_issue: { icon: 'cross-circle', tab: 'payment' },
  identity_review_required: { icon: 'shield-search', tab: 'identity' },
  guest_verified: { icon: 'shield-tick', tab: 'identity' },
  access_issued: { icon: 'key', tab: 'access' },
  access_issue_failed: { icon: 'key-square', tab: 'access' },
  checkout_completed: { icon: 'exit-right', tab: 'checkout' },
  invoice_issued: { icon: 'document', tab: 'invoice' },
  service_requested: { icon: 'basket', tab: 'services' },
  problem_reported: { icon: 'message-question' },
  review_submitted: { icon: 'star' },
}

/** Where opening a notification navigates, or null when it has no target. */
export function staffNotificationLink(n: Pick<StaffNotification, 'type' | 'reservation_id'>): string | null {
  if (n.type === 'problem_reported') return '/problem-reports'
  if (n.type === 'review_submitted') return '/reviews'
  if (n.reservation_id == null) return null
  const tab = STAFF_NOTIFICATION_META[n.type]?.tab
  return `/reservations/${n.reservation_id}${tab ? `?tab=${tab}` : ''}`
}
