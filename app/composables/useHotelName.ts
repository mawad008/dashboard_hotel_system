import type { LocalizedMap } from '~/types/api'

interface Named {
  name?: string | null
  name_i18n?: LocalizedMap | null
}

// Display name in the dashboard's current language. `name_i18n` holds the
// per-language names; `name` is the base (English) fallback for hotels not
// yet localized. Display only — forms keep editing the raw fields.
export function useHotelName() {
  const { locale } = useI18n()

  return (h: Named | null | undefined): string => {
    if (!h) return ''
    const map = h.name_i18n
    const lang = locale.value as keyof LocalizedMap
    return map?.[lang] || h.name || map?.en || map?.ar || ''
  }
}
