import { defineStore } from 'pinia'
import { staffNotificationsService } from '~/services'

// The header bell's unread badge, shared with the notifications page so
// marking read in one place updates the other. Polls while the tab is
// visible — there is no push channel to the dashboard.
const POLL_MS = 30_000

let timer: ReturnType<typeof setInterval> | null = null
let subscribers = 0

export const useStaffNotificationsStore = defineStore('staffNotifications', {
  state: () => ({
    unreadCount: 0,
    // Bumped whenever the inbox changes, so open lists know to reload.
    version: 0,
  }),
  actions: {
    async refreshCount() {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const res = await staffNotificationsService.unreadCount()
        if (res.unread_count !== this.unreadCount) this.version++
        this.unreadCount = res.unread_count
      } catch {
        // Best effort — the badge just keeps its last value.
      }
    },
    setCount(n: number) {
      this.unreadCount = Math.max(0, n)
    },
    changed() {
      this.version++
    },
    startPolling() {
      subscribers++
      if (timer) return
      this.refreshCount()
      timer = setInterval(() => this.refreshCount(), POLL_MS)
    },
    stopPolling() {
      subscribers = Math.max(0, subscribers - 1)
      if (subscribers === 0 && timer) {
        clearInterval(timer)
        timer = null
      }
    },
  },
})
