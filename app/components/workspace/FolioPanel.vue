<script setup lang="ts">
import { folioService } from '~/services'
import { money } from '~/utils/format'
import { PAYMENT_STATUS_TONE } from '~/utils/statusMeta'

const props = defineProps<{ reservationId: number }>()
const { t } = useI18n()

const folio = useResource(() => folioService.get(props.reservationId))
</script>

<template>
  <WorkspacePanelShell
    :title="t('workspace.folio')"
    :pending="folio.pending.value"
    :error="folio.error.value"
    @retry="folio.reload"
  >
    <template #actions>
      <button type="button" class="btn btn-ghost px-2 py-1 text-2sm" @click="folio.reload">
        <KtIcon name="arrows-circle" /> {{ t('common.refresh') }}
      </button>
    </template>

    <div v-if="folio.data.value" class="space-y-4">
      <WorkspaceSettlementSummary
        :settlement="folio.data.value.settlement"
        :currency="folio.data.value.currency"
      />

      <div v-if="folio.data.value.payment_summary" class="flex flex-wrap items-center gap-2 text-2sm">
        <span class="text-muted-foreground">{{ t('workspace.paymentSummary') }}:</span>
        <StatusBadge
          :label="t(`status.${folio.data.value.payment_summary.status}`)"
          :tone="PAYMENT_STATUS_TONE[folio.data.value.payment_summary.status]"
        />
        <span class="font-medium">
          {{ money(folio.data.value.payment_summary.amount, folio.data.value.payment_summary.currency) }}
        </span>
        <span v-if="folio.data.value.payment_summary.is_captured" class="text-success">· {{ t('workspace.captured') }}</span>
      </div>

      <div class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th>{{ t('workspace.description') }}</th>
              <th>{{ t('workspace.source') }}</th>
              <th class="text-end">
                {{ t('workspace.qty') }}
              </th>
              <th class="text-end">
                {{ t('workspace.unit') }}
              </th>
              <th class="text-end">
                {{ t('workspace.total') }}
              </th>
              <th>{{ t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in folio.data.value.charges" :key="c.id">
              <td>{{ c.description }}</td>
              <td class="text-muted-foreground">
                {{ c.source_type }}
              </td>
              <td class="text-end">
                {{ c.quantity }}
              </td>
              <td class="text-end">
                {{ money(c.unit_amount, c.currency) }}
              </td>
              <td class="text-end font-medium">
                {{ money(c.total_amount, c.currency) }}
              </td>
              <td>
                <StatusBadge
                  :label="c.status === 'posted' ? t('status.issued') : t('status.cancelled')"
                  :tone="c.status === 'posted' ? 'success' : 'neutral'"
                />
              </td>
            </tr>
            <tr v-if="folio.data.value.charges.length === 0">
              <td colspan="6" class="text-center text-muted-foreground">
                {{ t('empty.body') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-2xs text-muted-foreground">
        {{ t('folio.authoritativeNote') }}
      </p>
    </div>
  </WorkspacePanelShell>
</template>
