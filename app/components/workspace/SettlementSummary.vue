<script setup lang="ts">
import type { FolioSettlement } from '~/types/api'
import { money } from '~/utils/format'

// The guest's full financial settlement (backend `folio.settlement`):
// accommodation, services, fee, tax, discount → total; then what is paid,
// what the deposit hold covers, what the guest still owes and what is
// released back to them. Display only — every figure is the server's.
const props = defineProps<{ settlement: FolioSettlement, currency: string | null }>()
const { t } = useI18n()

const s = computed(() => props.settlement)
const positive = (v: string) => Number(v) > 0
const taxRate = computed(() => Number(s.value.tax_rate))
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">
        {{ t('settlement.title') }}
      </h3>
      <StatusBadge
        :label="s.is_final ? t('settlement.final') : t('settlement.projected')"
        :tone="s.is_final ? 'success' : 'info'"
      />
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <!-- What the stay costs -->
      <dl class="space-y-1.5 rounded-lg border border-border p-4 text-sm [&_dd]:whitespace-nowrap">
        <div class="flex justify-between gap-3">
          <dt>{{ t('settlement.accommodation') }}</dt>
          <dd>{{ money(s.accommodation, currency) }}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt>{{ t('settlement.services') }}</dt>
          <dd>{{ money(s.services, currency) }}</dd>
        </div>
        <div v-if="positive(s.service_fee)" class="flex justify-between gap-3">
          <dt>{{ t('settlement.serviceFee') }}</dt>
          <dd>{{ money(s.service_fee, currency) }}</dd>
        </div>
        <div v-if="positive(s.tax)" class="flex justify-between gap-3">
          <dt>{{ t('settlement.tax', { rate: taxRate }) }}</dt>
          <dd>{{ money(s.tax, currency) }}</dd>
        </div>
        <div v-if="positive(s.loyalty_discount)" class="flex justify-between gap-3 text-success">
          <dt>{{ t('settlement.loyaltyDiscount') }}</dt>
          <dd>− {{ money(s.loyalty_discount, currency) }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
          <dt>{{ t('settlement.total') }}</dt>
          <dd>{{ money(s.total, currency) }}</dd>
        </div>
      </dl>

      <!-- How it is settled -->
      <dl class="space-y-1.5 rounded-lg border border-border p-4 text-sm [&_dd]:whitespace-nowrap">
        <div class="flex justify-between gap-3">
          <dt>{{ t('settlement.paid') }}</dt>
          <dd class="text-success">
            {{ money(s.paid, currency) }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="flex items-center gap-2">
            {{ t('settlement.deposit') }}
            <StatusBadge
              :label="t(`settlement.depositState.${s.deposit.state}`)"
              :tone="s.deposit.state === 'held' ? 'warning' : s.deposit.state === 'none' ? 'neutral' : 'success'"
            />
          </dt>
          <dd>{{ money(s.deposit.amount, currency) }}</dd>
        </div>
        <div v-if="positive(s.deposit.applied)" class="flex justify-between gap-3 text-muted-foreground">
          <dt class="ps-3">
            {{ s.deposit.state === 'held' ? t('settlement.depositWillApply') : t('settlement.depositApplied') }}
          </dt>
          <dd>{{ money(s.deposit.applied, currency) }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
          <dt>{{ t('settlement.balanceDue') }}</dt>
          <dd :class="positive(s.balance_due) ? 'text-warning' : ''">
            {{ money(s.balance_due, currency) }}
          </dd>
        </div>
        <div class="flex justify-between gap-3 font-semibold">
          <dt>
            {{ s.deposit.state === 'held' ? t('settlement.depositToRelease') : t('settlement.depositReleased') }}
          </dt>
          <dd :class="positive(s.deposit.released) ? 'text-success' : ''">
            {{ money(s.deposit.released, currency) }}
          </dd>
        </div>
        <div v-if="positive(s.credit)" class="flex justify-between gap-3 font-semibold text-success">
          <dt>{{ t('settlement.credit') }}</dt>
          <dd>{{ money(s.credit, currency) }}</dd>
        </div>
      </dl>
    </div>

    <p v-if="!s.is_final" class="text-2xs text-muted-foreground">
      {{ t('settlement.projectedNote') }}
    </p>
  </div>
</template>
