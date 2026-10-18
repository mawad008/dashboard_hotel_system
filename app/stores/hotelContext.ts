import { defineStore } from 'pinia'
import type { Hotel } from '~/types/api'
import { hotelsService } from '~/services'

// The special "all hotels" scope. Only meaningful for a Group Owner AND only
// where a backend endpoint actually serves group-wide data. Hotel-scoped
// endpoints (rooms, room types, services) require a concrete hotel and the
// UI forces a pick before calling them.
export const ALL_HOTELS = '__all__' as const
export type HotelScope = number | typeof ALL_HOTELS

interface HotelContextState {
  currentScope: HotelScope | null
  // A Group Owner has no user_hotel_access rows, so their session `hotels`
  // can be empty; the picker falls back to GET /hotels (their full scope).
  ownerHotels: Hotel[]
}

// Central hotel context. This is a QUERY convenience, never authorisation:
// every hotel-scoped API call is still validated server-side against
// user_hotel_access, so a tampered value just yields 403/404.
export const useHotelContextStore = defineStore('hotelContext', {
  state: (): HotelContextState => ({
    currentScope: null,
    ownerHotels: [],
  }),

  getters: {
    // Hotels the signed-in user may pick between.
    availableHotels(s): Hotel[] {
      const auth = useAuthStore()
      if (auth.isGroupOwner && s.ownerHotels.length > 0) return s.ownerHotels
      return auth.assignedHotels
    },

    canSelectAllHotels(): boolean {
      return useAuthStore().isGroupOwner
    },

    isAllHotels(s): boolean {
      return s.currentScope === ALL_HOTELS
    },

    // A concrete hotel id, or null when scope is "all" / unset.
    currentHotelId(s): number | null {
      return typeof s.currentScope === 'number' ? s.currentScope : null
    },

    currentHotel(): Hotel | null {
      const id = this.currentHotelId
      return id == null ? null : (this.availableHotels.find(h => h.id === id) ?? null)
    },
  },

  actions: {
    // Resolve a starting scope from persisted preference, falling back to a
    // safe default. Never trusts the persisted value beyond "is it still one
    // of my hotels".
    init() {
      const auth = useAuthStore()
      void this.loadOwnerHotels()
      const stored = this.readStored()

      if (stored === ALL_HOTELS && auth.isGroupOwner) {
        this.currentScope = ALL_HOTELS
        return
      }
      if (typeof stored === 'number' && (auth.isGroupOwner || auth.assignedHotels.some(h => h.id === stored))) {
        this.currentScope = stored
        return
      }
      if (auth.isGroupOwner) {
        this.currentScope = ALL_HOTELS
      } else if (auth.assignedHotels.length > 0) {
        this.currentScope = auth.assignedHotels[0]!.id
      } else {
        this.currentScope = null
      }
      this.writeStored(this.currentScope)
    },

    // Group Owner only: load every hotel in scope for the picker. Paged at
    // the server's max page size until exhausted.
    async loadOwnerHotels() {
      if (!useAuthStore().isGroupOwner) return
      try {
        const hotels: Hotel[] = []
        for (let page = 1; ; page++) {
          const res = await hotelsService.list({ page, per_page: 100 })
          hotels.push(...res.data)
          if (page >= (res.meta.last_page ?? 1)) break
        }
        this.ownerHotels = hotels
      } catch {
        // picker keeps the session hotels; "all hotels" still works
      }
    },

    setScope(scope: HotelScope) {
      const auth = useAuthStore()
      if (scope === ALL_HOTELS) {
        if (!auth.isGroupOwner) return // silently ignore an unauthorised pick
        this.currentScope = ALL_HOTELS
      } else {
        if (!auth.isGroupOwner && !auth.assignedHotels.some(h => h.id === scope)) return
        this.currentScope = scope
      }
      this.writeStored(this.currentScope)
    },

    reset() {
      this.currentScope = null
      this.ownerHotels = []
      if (import.meta.client) {
        try {
          localStorage.removeItem('hm_hotel_scope')
        } catch {
          // storage unavailable — nothing to clear
        }
      }
    },

    readStored(): HotelScope | null {
      if (!import.meta.client) return null
      try {
        const raw = localStorage.getItem('hm_hotel_scope')
        if (!raw) return null
        if (raw === ALL_HOTELS) return ALL_HOTELS
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
      } catch {
        return null
      }
    },

    writeStored(scope: HotelScope | null) {
      if (!import.meta.client || scope == null) return
      try {
        localStorage.setItem('hm_hotel_scope', String(scope))
      } catch {
        // storage unavailable — preference just won't persist
      }
    },
  },
})
