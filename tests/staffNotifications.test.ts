import { describe, expect, it } from 'vitest'
import en from '../i18n/locales/en.json'
import ar from '../i18n/locales/ar.json'
import css from '../app/assets/keenicons/outline/style.css?raw'
import { iconName } from '../app/utils/iconName'
import { STAFF_NOTIFICATION_META, staffNotificationLink } from '../app/utils/staffNotifications'
import { relativeTime } from '../app/utils/format'
import type { StaffNotificationType } from '../app/types/api'

const glyphs = new Set([...css.matchAll(/\.ki-([a-z0-9-]+)\.ki-outline:before/g)].map(m => m[1]!))
const types = Object.keys(STAFF_NOTIFICATION_META) as StaffNotificationType[]

describe('staff notification presentation', () => {
  it('every type has a bundled icon and a title in both languages', () => {
    for (const type of types) {
      expect(glyphs.has(iconName(STAFF_NOTIFICATION_META[type].icon)), type).toBe(true)
      expect((en.staffNotifications.types as Record<string, string>)[type], type).toBeTruthy()
      expect((ar.staffNotifications.types as Record<string, string>)[type], type).toBeTruthy()
    }
  })

  it('links reservation events to the matching workspace tab', () => {
    expect(staffNotificationLink({ type: 'service_requested', reservation_id: 7 })).toBe('/reservations/7?tab=services')
    expect(staffNotificationLink({ type: 'payment_issue', reservation_id: 7 })).toBe('/reservations/7?tab=payment')
    expect(staffNotificationLink({ type: 'booking_created', reservation_id: 7 })).toBe('/reservations/7?tab=overview')
  })

  it('links non-reservation events to their list pages', () => {
    expect(staffNotificationLink({ type: 'problem_reported', reservation_id: null })).toBe('/problem-reports')
    expect(staffNotificationLink({ type: 'review_submitted', reservation_id: 3 })).toBe('/reviews')
    expect(staffNotificationLink({ type: 'booking_created', reservation_id: null })).toBeNull()
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-10-06T12:00:00Z')
  it('formats recent times relatively and falls back to a date', () => {
    expect(relativeTime('2026-10-06T11:55:00Z', 'en', now)).toBe('5 minutes ago')
    expect(relativeTime('2026-10-06T09:00:00Z', 'en', now)).toBe('3 hours ago')
    expect(relativeTime('2026-10-05T12:00:00Z', 'en', now)).toBe('yesterday')
    expect(relativeTime(null, 'en', now)).toBe('—')
  })
})
