<script setup lang="ts">
import { checkoutService } from '~/services'
import type { InvoiceItem } from '~/types/api'
import { date, dateTime, money } from '~/utils/format'

// Standalone, print-ready invoice (no dashboard shell). Opened in a new tab
// from the reservation workspace's Invoice panel; prints itself once loaded.
// Every figure is the backend invoice's own — nothing is computed here.
definePageMeta({ layout: false, permission: 'invoice.view' })

const route = useRoute()
const { t, locale } = useI18n()

const reservationId = Number(route.params.reservationId)
const invoice = useResource(() => checkoutService.invoice(reservationId))

const doc = computed(() => invoice.data.value?.document ?? null)
const currency = computed(() => invoice.data.value?.currency ?? null)

const pick = (map: { en?: string, ar?: string } | Record<string, string> | null | undefined, fallback = '') =>
  (map && ((map as Record<string, string>)[locale.value] || (map as Record<string, string>).en)) || fallback

const hotelName = computed(() => pick(doc.value?.hotel?.name_i18n, doc.value?.hotel?.name ?? ''))
const hotelPlace = computed(() =>
  [pick(doc.value?.hotel?.city), pick(doc.value?.hotel?.country)].filter(Boolean).join('، '),
)

// System-generated lines (accommodation, fee, tax…) carry an English
// description; label them by source in the printout's language. Service
// orders keep their own (service) name.
const LINE_LABEL: Record<string, string> = {
  accommodation: 'invoicePrint.lines.accommodation',
  stay_extension: 'invoicePrint.lines.stayExtension',
  service_fee: 'invoicePrint.lines.serviceFee',
  tax: 'invoicePrint.lines.tax',
  loyalty_redemption: 'invoicePrint.lines.loyaltyRedemption',
}

function lineLabel(item: InvoiceItem): string {
  const key = LINE_LABEL[item.source_type]
  if (!key) return item.description
  if (item.source_type === 'tax' && doc.value?.stay?.tax_rate) {
    return t('invoicePrint.lines.taxWithRate', { rate: Number(doc.value.stay.tax_rate) })
  }
  return t(key)
}

const isDraft = computed(() => invoice.data.value?.status === 'draft')

useHead({ title: computed(() => `${t('invoicePrint.title')} ${invoice.data.value?.invoice_number ?? ''}`) })

function printNow() {
  window.print()
}

// Print as soon as the invoice (and the hotel logo, if any) is on screen.
watch(
  () => invoice.data.value,
  async (value) => {
    if (!value) return
    await nextTick()
    const logo = document.querySelector<HTMLImageElement>('.invoice-logo')
    if (logo && !logo.complete) {
      await new Promise<void>((resolve) => {
        logo.addEventListener('load', () => resolve(), { once: true })
        logo.addEventListener('error', () => resolve(), { once: true })
      })
    }
    printNow()
  },
)
</script>

<template>
  <div class="invoice-page min-h-screen bg-white text-black">
    <div class="mx-auto flex max-w-[210mm] justify-end gap-2 px-4 pt-4 print:hidden">
      <button type="button" class="btn btn-primary" :disabled="!invoice.data.value" @click="printNow">
        <KtIcon name="printer" /> {{ t('workspace.print') }}
      </button>
    </div>

    <p v-if="invoice.pending.value" class="p-10 text-center text-sm text-gray-500">
      {{ t('common.loading') }}
    </p>
    <p v-else-if="invoice.error.value" class="p-10 text-center text-sm text-red-600">
      {{ t('workspace.noInvoiceYet') }}
    </p>

    <article v-else-if="invoice.data.value" class="invoice-sheet relative mx-auto my-4 max-w-[210mm] bg-white p-10 print:my-0 print:p-0">
      <div v-if="isDraft" class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span class="-rotate-30 text-8xl font-black uppercase tracking-widest text-gray-200">
          {{ t('invoicePrint.draft') }}
        </span>
      </div>

      <!-- Header: issuing hotel + document title -->
      <header class="relative flex items-start justify-between gap-6 border-b-2 border-black pb-6">
        <div class="flex items-start gap-4">
          <img
            v-if="doc?.hotel?.logo_url"
            :src="doc.hotel.logo_url"
            alt=""
            class="invoice-logo size-20 object-contain"
          >
          <div class="space-y-0.5 text-sm">
            <div class="text-xl font-bold">
              {{ hotelName }}
            </div>
            <div v-if="doc?.hotel?.group_name" class="text-gray-600">
              {{ doc.hotel.group_name }}
            </div>
            <div v-if="hotelPlace" class="text-gray-600">
              {{ hotelPlace }}
            </div>
            <div v-if="doc?.hotel?.phone" class="text-gray-600">
              <span dir="ltr">{{ doc.hotel.phone }}</span>
            </div>
          </div>
        </div>
        <div class="text-end">
          <h1 class="text-3xl font-bold tracking-wide">
            {{ t('invoicePrint.title') }}
          </h1>
          <dl class="mt-3 grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-sm">
            <dt class="text-gray-600">
              {{ t('invoicePrint.number') }}
            </dt>
            <dd class="font-semibold">
              <span dir="ltr">{{ invoice.data.value.invoice_number }}</span>
            </dd>
            <dt class="text-gray-600">
              {{ t('invoicePrint.issuedAt') }}
            </dt>
            <dd>{{ dateTime(invoice.data.value.issued_at) }}</dd>
            <dt class="text-gray-600">
              {{ t('invoicePrint.reservation') }}
            </dt>
            <dd>
              <span dir="ltr">#{{ invoice.data.value.reservation_id }}</span>
            </dd>
          </dl>
        </div>
      </header>

      <!-- Billed to + stay -->
      <section class="relative mt-6 grid grid-cols-2 gap-6 text-sm">
        <div class="rounded-lg border border-gray-300 p-4">
          <h2 class="mb-2 text-xs font-bold uppercase text-gray-500">
            {{ t('invoicePrint.billedTo') }}
          </h2>
          <div class="font-semibold">
            {{ doc?.guest?.name || '—' }}
          </div>
          <div v-if="doc?.guest?.phone" class="text-gray-600">
            <span dir="ltr">{{ doc.guest.phone }}</span>
          </div>
          <div v-if="doc?.guest?.email" class="text-gray-600">
            {{ doc.guest.email }}
          </div>
        </div>
        <div class="rounded-lg border border-gray-300 p-4">
          <h2 class="mb-2 text-xs font-bold uppercase text-gray-500">
            {{ t('invoicePrint.stay') }}
          </h2>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt class="text-gray-600">
              {{ t('invoicePrint.checkIn') }}
            </dt>
            <dd>{{ date(doc?.stay?.check_in) }}</dd>
            <dt class="text-gray-600">
              {{ t('invoicePrint.checkOut') }}
            </dt>
            <dd>{{ date(doc?.stay?.check_out) }}</dd>
            <template v-if="doc?.stay?.nights">
              <dt class="text-gray-600">
                {{ t('invoicePrint.nights') }}
              </dt>
              <dd>{{ doc.stay.nights }}</dd>
            </template>
            <template v-if="doc?.stay?.room_type">
              <dt class="text-gray-600">
                {{ t('invoicePrint.room') }}
              </dt>
              <dd>
                {{ doc.stay.room_type }}<span v-if="doc.stay.room_number"> · {{ doc.stay.room_number }}</span>
              </dd>
            </template>
            <dt class="text-gray-600">
              {{ t('invoicePrint.guests') }}
            </dt>
            <dd>{{ t('invoicePrint.party', { adults: doc?.stay?.adults ?? 0, children: doc?.stay?.children ?? 0 }) }}</dd>
          </dl>
        </div>
      </section>

      <!-- Lines -->
      <table class="relative mt-8 w-full border-collapse text-sm">
        <thead>
          <tr class="border-y-2 border-black text-start">
            <th class="py-2 text-start">
              #
            </th>
            <th class="py-2 text-start">
              {{ t('workspace.description') }}
            </th>
            <th class="py-2 text-end">
              {{ t('workspace.qty') }}
            </th>
            <th class="py-2 text-end">
              {{ t('workspace.unit') }}
            </th>
            <th class="py-2 text-end">
              {{ t('workspace.total') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in invoice.data.value.items ?? []"
            :key="item.id"
            class="break-inside-avoid border-b border-gray-200"
          >
            <td class="py-2 text-gray-500">
              {{ index + 1 }}
            </td>
            <td class="py-2">
              {{ lineLabel(item) }}
            </td>
            <td class="py-2 text-end">
              {{ item.quantity }}
            </td>
            <td class="py-2 text-end">
              <span dir="ltr">{{ money(item.unit_amount, currency) }}</span>
            </td>
            <td class="py-2 text-end font-medium">
              <span dir="ltr">{{ money(item.total_amount, currency) }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Totals -->
      <dl class="relative ms-auto mt-6 w-full max-w-xs space-y-1.5 text-sm">
        <div class="flex justify-between">
          <dt>{{ t('workspace.subtotal') }}</dt>
          <dd>
            <span dir="ltr">{{ money(invoice.data.value.subtotal, currency) }}</span>
          </dd>
        </div>
        <div class="flex justify-between">
          <dt>{{ t('workspace.paymentsTotal') }}</dt>
          <dd>
            <span dir="ltr">{{ money(invoice.data.value.payments_total, currency) }}</span>
          </dd>
        </div>
        <div class="flex justify-between border-t-2 border-black pt-2 text-base font-bold">
          <dt>{{ t('workspace.outstanding') }}</dt>
          <dd>
            <span dir="ltr">{{ money(invoice.data.value.outstanding_total, currency) }}</span>
          </dd>
        </div>
      </dl>

      <footer class="relative mt-16 border-t border-gray-300 pt-4 text-center text-xs text-gray-500">
        <p>{{ t('invoicePrint.thanks', { hotel: hotelName }) }}</p>
        <p class="mt-1">
          {{ t('invoicePrint.generated') }}
        </p>
      </footer>
    </article>
  </div>
</template>

<style>
/* The dashboard body background would otherwise print below the sheet. */
@media print {
  html,
  body {
    background: #fff !important;
  }
}
</style>

<style scoped>
@page {
  size: A4;
  margin: 14mm;
}

@media print {
  .invoice-page {
    min-height: auto;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
