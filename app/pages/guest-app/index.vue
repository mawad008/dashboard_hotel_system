<script setup lang="ts">
import { guestAppContentService } from '~/services'
import type { GuestAppContent, GuestAppImageSlot, GuestAppSettings, LocalizedMap } from '~/types/api'
import { ApiError } from '~/utils/apiError'

// Guest App branding + entry content: the app name, logo, app icon and brand
// colour, the onboarding photo / headline / body / button, the support
// contacts, legal links and FAQ. Every field is optional — a blank field
// falls back to the copy/artwork bundled in the app (or hides the action).
definePageMeta({ permission: 'app-content.manage' })

const { t, locale } = useI18n()
const app = useAppStore()

const content = useResource(() => guestAppContentService.get())

// ---- text --------------------------------------------------------------
type TextField = 'app_name_i18n' | 'onboarding_title_i18n' | 'onboarding_body_i18n' | 'onboarding_cta_i18n'

const FIELDS: Array<{ key: TextField, label: string, max: number, multiline?: boolean }> = [
  { key: 'app_name_i18n', label: 'guestApp.appName', max: 60 },
  { key: 'onboarding_title_i18n', label: 'guestApp.onboardingTitle', max: 120 },
  { key: 'onboarding_body_i18n', label: 'guestApp.onboardingBody', max: 300, multiline: true },
  { key: 'onboarding_cta_i18n', label: 'guestApp.onboardingCta', max: 40 },
]

const form = reactive<Record<TextField, { en: string, ar: string }>>({
  app_name_i18n: { en: '', ar: '' },
  onboarding_title_i18n: { en: '', ar: '' },
  onboarding_body_i18n: { en: '', ar: '' },
  onboarding_cta_i18n: { en: '', ar: '' },
})
const errors = ref<Record<string, string[]>>({})
const saving = ref(false)

function fill(c: GuestAppContent | null | undefined) {
  if (!c) return
  for (const f of FIELDS) {
    const map: LocalizedMap | null = c[f.key]
    form[f.key].en = map?.en ?? ''
    form[f.key].ar = map?.ar ?? ''
  }
}

watch(() => content.data.value, fill, { immediate: true })

async function save() {
  if (saving.value) return
  saving.value = true
  errors.value = {}
  try {
    const body = Object.fromEntries(FIELDS.map(f => [f.key, { en: form[f.key].en, ar: form[f.key].ar }]))
    content.data.value = await guestAppContentService.update(body)
    app.pushToast('success', t('guestApp.saved'))
  }
  catch (e) {
    if (e instanceof ApiError && e.kind === 'validation' && e.errors) errors.value = e.errors
    else app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  }
  finally {
    saving.value = false
  }
}

// ---- brand colour, support contacts, legal links ------------------------
type SettingField = keyof GuestAppSettings
const DEFAULT_PRIMARY = '#0E0C0A' // the app's built-in primary (v2 ink)
const settings = reactive<Record<SettingField, string>>({
  primary_color: '',
  support_phone: '',
  support_whatsapp: '',
  support_email: '',
  website_url: '',
  terms_url: '',
  privacy_url: '',
})
const CONTACT_FIELDS: Array<{ key: SettingField, label: string, type: string, placeholder: string }> = [
  { key: 'support_phone', label: 'guestApp.supportPhone', type: 'tel', placeholder: '+20 100 000 0000' },
  { key: 'support_whatsapp', label: 'guestApp.supportWhatsapp', type: 'tel', placeholder: '+201000000000' },
  { key: 'support_email', label: 'guestApp.supportEmail', type: 'email', placeholder: 'support@example.com' },
  { key: 'website_url', label: 'guestApp.website', type: 'url', placeholder: 'https://example.com' },
]
const LEGAL_FIELDS: Array<{ key: SettingField, label: string }> = [
  { key: 'terms_url', label: 'guestApp.termsUrl' },
  { key: 'privacy_url', label: 'guestApp.privacyUrl' },
]
const settingsErrors = ref<Record<string, string[]>>({})
const savingSettings = ref(false)

watch(() => content.data.value, (c) => {
  if (!c) return
  settings.primary_color = c.primary_color ?? ''
  settings.support_phone = c.support?.phone ?? ''
  settings.support_whatsapp = c.support?.whatsapp ?? ''
  settings.support_email = c.support?.email ?? ''
  settings.website_url = c.support?.website ?? ''
  settings.terms_url = c.legal?.terms_url ?? ''
  settings.privacy_url = c.legal?.privacy_url ?? ''
}, { immediate: true })

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v)
// <input type="color"> needs a valid hex; blank shows the built-in colour.
const colorPicker = computed({
  get: () => (isHex(settings.primary_color) ? settings.primary_color : DEFAULT_PRIMARY),
  set: (v: string) => { settings.primary_color = v.toUpperCase() },
})
const previewPrimary = computed(() => (isHex(settings.primary_color) ? settings.primary_color : DEFAULT_PRIMARY))
// Same rule as the app: dark text on a light brand colour, white otherwise.
const previewOnPrimary = computed(() => {
  const hex = previewPrimary.value.slice(1)
  const [r, g, b] = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!)
  return luminance > 0.4 ? '#0E0C0A' : '#FFFFFF'
})

async function saveSettings() {
  if (savingSettings.value) return
  savingSettings.value = true
  settingsErrors.value = {}
  try {
    const body = Object.fromEntries(
      (Object.keys(settings) as SettingField[]).map(k => [k, settings[k].trim() || null]),
    ) as unknown as GuestAppSettings
    content.data.value = await guestAppContentService.update(body)
    app.pushToast('success', t('guestApp.saved'))
  }
  catch (e) {
    if (e instanceof ApiError && e.kind === 'validation' && e.errors) settingsErrors.value = e.errors
    else app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  }
  finally {
    savingSettings.value = false
  }
}

// ---- FAQ (guest app Support → "الأسئلة الشائعة") -------------------------
// Mirrors GuestAppContent::FAQ_MAX_ITEMS; incomplete rows are dropped by the
// server, so the guest only ever sees full question + answer pairs.
const FAQ_MAX = 20
interface FaqRow { question_en: string, question_ar: string, answer_en: string, answer_ar: string }
const faq = ref<FaqRow[]>([])
const faqErrors = ref<Record<string, string[]>>({})
const savingFaq = ref(false)

watch(() => content.data.value, (c) => {
  if (!c) return
  faq.value = (c.faq ?? []).map(item => ({
    question_en: item.question_i18n?.en ?? '',
    question_ar: item.question_i18n?.ar ?? '',
    answer_en: item.answer_i18n?.en ?? '',
    answer_ar: item.answer_i18n?.ar ?? '',
  }))
}, { immediate: true })

function addFaq() {
  if (faq.value.length < FAQ_MAX) faq.value.push({ question_en: '', question_ar: '', answer_en: '', answer_ar: '' })
}
function removeFaq(index: number) {
  faq.value.splice(index, 1)
}
function moveFaq(index: number, delta: number) {
  const to = index + delta
  if (to < 0 || to >= faq.value.length) return
  const [row] = faq.value.splice(index, 1)
  faq.value.splice(to, 0, row!)
}

async function saveFaq() {
  if (savingFaq.value) return
  savingFaq.value = true
  faqErrors.value = {}
  try {
    content.data.value = await guestAppContentService.update({
      faq: faq.value.map(r => ({
        question_i18n: { en: r.question_en, ar: r.question_ar },
        answer_i18n: { en: r.answer_en, ar: r.answer_ar },
      })),
    })
    app.pushToast('success', t('guestApp.saved'))
  }
  catch (e) {
    if (e instanceof ApiError && e.kind === 'validation' && e.errors) faqErrors.value = e.errors
    else app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  }
  finally {
    savingFaq.value = false
  }
}

// ---- images ------------------------------------------------------------
// Mirrors config/hotel_media.php — a soft client check; the server decides.
const MAX_FILE_MB = 5
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
const SLOTS: Array<{ slot: GuestAppImageSlot, label: string, hint: string }> = [
  { slot: 'logo', label: 'guestApp.logo', hint: 'guestApp.logoHint' },
  { slot: 'app_icon', label: 'guestApp.appIcon', hint: 'guestApp.appIconHint' },
  { slot: 'onboarding_image', label: 'guestApp.onboardingImage', hint: 'guestApp.onboardingImageHint' },
]

const busySlot = ref<GuestAppImageSlot | null>(null)
const removeTarget = ref<GuestAppImageSlot | null>(null)

function imageUrl(slot: GuestAppImageSlot): string | null {
  const c = content.data.value
  if (!c) return null
  if (slot === 'logo') return c.logo_url
  if (slot === 'app_icon') return c.app_icon_url
  return c.onboarding_image_url
}

async function onPick(slot: GuestAppImageSlot, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busySlot.value) return
  if (!ACCEPTED.includes(file.type)) return app.pushToast('error', t('hotels.media.invalidType'))
  if (file.size > MAX_FILE_MB * 1024 * 1024) return app.pushToast('error', t('hotels.media.tooLarge', { max: MAX_FILE_MB }))

  busySlot.value = slot
  try {
    content.data.value = await guestAppContentService.uploadImage(slot, file)
    app.pushToast('success', t('hotels.media.uploaded'))
  }
  catch (e) {
    const msg = e instanceof ApiError && e.kind === 'validation' && e.errors
      ? Object.values(e.errors).flat()[0]
      : e instanceof ApiError ? e.message : undefined
    app.pushToast('error', msg ?? t('errors.genericBody'))
  }
  finally {
    busySlot.value = null
  }
}

async function confirmRemove() {
  const slot = removeTarget.value
  if (!slot || busySlot.value) return
  busySlot.value = slot
  try {
    content.data.value = await guestAppContentService.removeImage(slot)
    app.pushToast('success', t('hotels.media.removed'))
    removeTarget.value = null
  }
  catch (e) {
    app.pushToast('error', e instanceof ApiError ? e.message : t('errors.genericBody'))
  }
  finally {
    busySlot.value = null
  }
}

// ---- preview (current dashboard language, falls back to the other) -------
function pick(key: TextField): string {
  const lang = locale.value === 'ar' ? 'ar' : 'en'
  const other = lang === 'ar' ? 'en' : 'ar'
  return form[key][lang] || form[key][other] || ''
}
const previewDir = computed(() => (locale.value === 'ar' ? 'rtl' : 'ltr'))
</script>

<template>
  <div>
    <PageHeader :title="t('guestApp.title')" :subtitle="t('guestApp.subtitle')" />

    <LoadingState v-if="content.pending.value && !content.data.value" :rows="5" />
    <ErrorState v-else-if="content.error.value && !content.data.value" :error="content.error.value" @retry="content.reload" />
    <div v-else class="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div class="space-y-6">
        <DataCard :title="t('guestApp.images')">
          <div class="grid gap-4 sm:grid-cols-2">
            <div v-for="s in SLOTS" :key="s.slot">
              <p class="mb-1.5 text-2sm font-medium text-foreground">
                {{ t(s.label) }}
              </p>
              <div class="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                <div class="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  <img
                    v-if="imageUrl(s.slot)"
                    :src="imageUrl(s.slot)!"
                    :alt="t(s.label)"
                    class="size-full"
                    :class="s.slot === 'onboarding_image' ? 'object-cover' : 'object-contain'"
                  >
                  <KtIcon v-else name="picture" class="text-muted-foreground" />
                  <div v-if="busySlot === s.slot" class="absolute inset-0 flex items-center justify-center bg-background/60">
                    <KtIcon name="loading" class="animate-spin text-primary" />
                  </div>
                </div>
                <div class="flex flex-1 flex-col gap-2">
                  <div class="flex flex-wrap gap-2">
                    <label class="btn btn-secondary btn-sm cursor-pointer">
                      <input type="file" :accept="ACCEPTED.join(',')" class="hidden" :disabled="!!busySlot" @change="onPick(s.slot, $event)">
                      {{ imageUrl(s.slot) ? t('hotels.media.replace') : t('hotels.media.upload') }}
                    </label>
                    <button
                      v-if="imageUrl(s.slot)"
                      type="button"
                      class="btn btn-secondary btn-sm text-destructive"
                      :disabled="!!busySlot"
                      @click="removeTarget = s.slot"
                    >
                      {{ t('common.remove') }}
                    </button>
                  </div>
                  <span class="text-2xs text-muted-foreground">{{ t(s.hint) }}</span>
                </div>
              </div>
            </div>
          </div>
        </DataCard>

        <DataCard :title="t('guestApp.texts')">
          <InfoNote class="mb-4">
            {{ t('guestApp.defaultsNote') }}
          </InfoNote>
          <form class="space-y-4" novalidate @submit.prevent="save">
            <div v-for="f in FIELDS" :key="f.key" class="grid gap-3 sm:grid-cols-2">
              <FormField :for-id="`${f.key}-en`" :label="`${t(f.label)} (${t('guestApp.english')})`" :error="errors[`${f.key}.en`] || errors[f.key]">
                <textarea v-if="f.multiline" :id="`${f.key}-en`" v-model="form[f.key].en" class="input min-h-20" rows="2" dir="ltr" :maxlength="f.max" />
                <input v-else :id="`${f.key}-en`" v-model="form[f.key].en" class="input" dir="ltr" :maxlength="f.max" autocomplete="off">
              </FormField>
              <FormField :for-id="`${f.key}-ar`" :label="`${t(f.label)} (${t('guestApp.arabic')})`" :error="errors[`${f.key}.ar`]">
                <textarea v-if="f.multiline" :id="`${f.key}-ar`" v-model="form[f.key].ar" class="input min-h-20" rows="2" dir="rtl" :maxlength="f.max" />
                <input v-else :id="`${f.key}-ar`" v-model="form[f.key].ar" class="input" dir="rtl" :maxlength="f.max" autocomplete="off">
              </FormField>
            </div>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? t('common.saving') : t('common.save') }}
            </button>
          </form>
        </DataCard>

        <DataCard :title="t('guestApp.brandingTitle')">
          <InfoNote class="mb-4">
            {{ t('guestApp.brandingNote') }}
          </InfoNote>
          <form class="space-y-5" novalidate @submit.prevent="saveSettings">
            <FormField for-id="primary-color" :label="t('guestApp.primaryColor')" :error="settingsErrors.primary_color" :hint="t('guestApp.primaryColorHint')">
              <div class="flex flex-wrap items-center gap-2">
                <input v-model="colorPicker" type="color" class="h-10 w-14 cursor-pointer rounded-md border border-border bg-background p-1" :aria-label="t('guestApp.primaryColor')">
                <input id="primary-color" v-model="settings.primary_color" class="input w-36 font-mono uppercase" dir="ltr" maxlength="7" :placeholder="DEFAULT_PRIMARY" autocomplete="off">
                <button v-if="settings.primary_color" type="button" class="btn btn-secondary btn-sm" @click="settings.primary_color = ''">
                  {{ t('guestApp.useBuiltIn') }}
                </button>
              </div>
            </FormField>

            <div>
              <p class="mb-2 text-2sm font-semibold text-foreground">
                {{ t('guestApp.contactTitle') }}
              </p>
              <div class="grid gap-3 sm:grid-cols-2">
                <FormField v-for="f in CONTACT_FIELDS" :key="f.key" :for-id="f.key" :label="t(f.label)" :error="settingsErrors[f.key]">
                  <input :id="f.key" v-model="settings[f.key]" :type="f.type" class="input" dir="ltr" :placeholder="f.placeholder" autocomplete="off">
                </FormField>
              </div>
              <p class="mt-1.5 text-2xs text-muted-foreground">
                {{ t('guestApp.contactNote') }}
              </p>
            </div>

            <div>
              <p class="mb-2 text-2sm font-semibold text-foreground">
                {{ t('guestApp.legalTitle') }}
              </p>
              <div class="grid gap-3 sm:grid-cols-2">
                <FormField v-for="f in LEGAL_FIELDS" :key="f.key" :for-id="f.key" :label="t(f.label)" :error="settingsErrors[f.key]">
                  <input :id="f.key" v-model="settings[f.key]" type="url" class="input" dir="ltr" placeholder="https://" autocomplete="off">
                </FormField>
              </div>
              <p class="mt-1.5 text-2xs text-muted-foreground">
                {{ t('guestApp.legalNote') }}
              </p>
            </div>

            <button type="submit" class="btn btn-primary" :disabled="savingSettings">
              {{ savingSettings ? t('common.saving') : t('common.save') }}
            </button>
          </form>
        </DataCard>

        <DataCard :title="t('guestApp.faqTitle')">
          <InfoNote class="mb-4">
            {{ t('guestApp.faqNote') }}
          </InfoNote>
          <form class="space-y-4" novalidate @submit.prevent="saveFaq">
            <p v-if="!faq.length" class="text-sm text-muted-foreground">
              {{ t('guestApp.faqEmpty') }}
            </p>
            <div
              v-for="(row, i) in faq"
              :key="i"
              class="space-y-3 rounded-lg border border-border p-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-2sm font-medium text-foreground">{{ t('guestApp.faqItem', { n: i + 1 }) }}</span>
                <div class="flex gap-1">
                  <button type="button" class="btn btn-secondary btn-sm" :disabled="i === 0" :aria-label="t('guestApp.faqMoveUp')" @click="moveFaq(i, -1)">
                    <KtIcon name="arrow-up" />
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" :disabled="i === faq.length - 1" :aria-label="t('guestApp.faqMoveDown')" @click="moveFaq(i, 1)">
                    <KtIcon name="arrow-down" />
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm text-destructive" @click="removeFaq(i)">
                    {{ t('common.remove') }}
                  </button>
                </div>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <FormField :for-id="`faq-${i}-q-en`" :label="`${t('guestApp.faqQuestion')} (${t('guestApp.english')})`" :error="faqErrors[`faq.${i}.question_i18n.en`]">
                  <input :id="`faq-${i}-q-en`" v-model="row.question_en" class="input" dir="ltr" maxlength="200" autocomplete="off">
                </FormField>
                <FormField :for-id="`faq-${i}-q-ar`" :label="`${t('guestApp.faqQuestion')} (${t('guestApp.arabic')})`" :error="faqErrors[`faq.${i}.question_i18n.ar`]">
                  <input :id="`faq-${i}-q-ar`" v-model="row.question_ar" class="input" dir="rtl" maxlength="200" autocomplete="off">
                </FormField>
                <FormField :for-id="`faq-${i}-a-en`" :label="`${t('guestApp.faqAnswer')} (${t('guestApp.english')})`" :error="faqErrors[`faq.${i}.answer_i18n.en`]">
                  <textarea :id="`faq-${i}-a-en`" v-model="row.answer_en" class="input min-h-20" rows="3" dir="ltr" maxlength="1000" />
                </FormField>
                <FormField :for-id="`faq-${i}-a-ar`" :label="`${t('guestApp.faqAnswer')} (${t('guestApp.arabic')})`" :error="faqErrors[`faq.${i}.answer_i18n.ar`]">
                  <textarea :id="`faq-${i}-a-ar`" v-model="row.answer_ar" class="input min-h-20" rows="3" dir="rtl" maxlength="1000" />
                </FormField>
              </div>
            </div>
            <p v-if="faqErrors.faq" class="text-2sm text-destructive">
              {{ faqErrors.faq[0] }}
            </p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-secondary" :disabled="faq.length >= FAQ_MAX" @click="addFaq">
                <KtIcon name="plus" /> {{ t('guestApp.faqAdd') }}
              </button>
              <button type="submit" class="btn btn-primary" :disabled="savingFaq">
                {{ savingFaq ? t('common.saving') : t('common.save') }}
              </button>
            </div>
          </form>
        </DataCard>
      </div>

      <!-- Onboarding preview: a rough phone-frame rendition of the app screen. -->
      <DataCard :title="t('guestApp.preview')">
        <div
          class="relative mx-auto aspect-[9/19] w-full max-w-[280px] overflow-hidden rounded-[2rem] border-4 border-foreground/80 bg-muted"
          :dir="previewDir"
        >
          <img v-if="content.data.value?.onboarding_image_url" :src="content.data.value.onboarding_image_url" alt="" class="absolute inset-0 size-full object-cover">
          <div v-else class="absolute inset-0 flex items-center justify-center text-2xs text-muted-foreground">
            {{ t('guestApp.bundledImage') }}
          </div>
          <div class="absolute inset-x-2 bottom-3">
            <div class="relative mx-auto -mb-6 flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-white/60 bg-white shadow">
              <img v-if="content.data.value?.logo_url" :src="content.data.value.logo_url" alt="" class="size-9 object-contain">
              <KtIcon v-else name="picture" class="text-muted-foreground" />
            </div>
            <div class="rounded-3xl bg-white/20 px-3 pb-3 pt-8 text-center text-white backdrop-blur-md">
              <p class="text-sm font-bold leading-snug">
                {{ pick('onboarding_title_i18n') || t('guestApp.bundledText') }}
              </p>
              <p class="mt-1 text-2xs leading-snug">
                {{ pick('onboarding_body_i18n') || t('guestApp.bundledText') }}
              </p>
              <div class="mt-2 rounded-full py-1.5 text-2xs font-semibold" :style="{ backgroundColor: previewPrimary, color: previewOnPrimary }">
                {{ pick('onboarding_cta_i18n') || t('guestApp.bundledText') }}
              </div>
            </div>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-center gap-2 text-2xs text-muted-foreground">
          <span class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            <img v-if="content.data.value?.app_icon_url" :src="content.data.value.app_icon_url" :alt="t('guestApp.appIcon')" class="size-full object-cover">
            <KtIcon v-else name="picture" class="text-muted-foreground" />
          </span>
          <span>{{ t('guestApp.appName') }}: <strong>{{ pick('app_name_i18n') || t('guestApp.bundledText') }}</strong></span>
        </div>
      </DataCard>
    </div>

    <ConfirmDialog
      :open="removeTarget !== null"
      :title="t('common.remove')"
      :message="t('guestApp.removeConfirm')"
      tone="destructive"
      :busy="busySlot !== null"
      @update:open="(v: boolean) => !v && (removeTarget = null)"
      @confirm="confirmRemove"
    />
  </div>
</template>
