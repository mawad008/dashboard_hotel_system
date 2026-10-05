<script setup lang="ts">
import type { ApiMeta } from '~/types/api'

const props = defineProps<{
  meta: ApiMeta | null
  // When set, a page-size picker is shown; the parent owns the value.
  perPageOptions?: number[]
  perPage?: number
}>()
const emit = defineEmits<{ page: [n: number], perPage: [n: number] }>()
const { t } = useI18n()

const current = computed(() => props.meta?.current_page ?? 1)
const last = computed(() => props.meta?.last_page ?? 1)
const total = computed(() => props.meta?.total ?? 0)
const from = computed(() => props.meta?.from ?? 0)
const to = computed(() => props.meta?.to ?? 0)

function go(n: number) {
  if (n >= 1 && n <= last.value && n !== current.value) emit('page', n)
}
</script>

<template>
  <div class="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
    <div class="flex items-center gap-3">
      <span>{{ t('common.showing', { from, to, total }) }}</span>
      <label v-if="perPageOptions?.length" class="flex items-center gap-2">
        <span class="whitespace-nowrap">{{ t('common.perPage') }}</span>
        <select
          class="input w-auto py-1"
          :value="perPage ?? meta?.per_page"
          @change="emit('perPage', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="n in perPageOptions" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
    </div>
    <div v-if="last > 1" class="flex items-center gap-1">
      <button
        type="button"
        class="btn btn-ghost px-2 py-1"
        :disabled="current <= 1"
        @click="go(current - 1)"
      >
        <KtIcon name="left" />
      </button>
      <span class="px-2">{{ t('common.page') }} {{ current }} {{ t('common.of') }} {{ last }}</span>
      <button
        type="button"
        class="btn btn-ghost px-2 py-1"
        :disabled="current >= last"
        @click="go(current + 1)"
      >
        <KtIcon name="right" />
      </button>
    </div>
  </div>
</template>
