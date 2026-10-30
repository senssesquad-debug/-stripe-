<script setup>
import { useSite } from '../composables/useSite.js'

defineProps({ compact: Boolean })
const { hours, t } = useSite()
</script>

<template>
  <dl class="hours" :class="{ 'hours--compact': compact }">
    <div v-for="h in hours" :key="h.day" class="hours__row" :class="{ 'is-today': h.today, 'is-closed': h.closed }">
      <dt>
        {{ h.day }}
        <span v-if="h.today" class="hours__today">{{ t.ui.today }}</span>
      </dt>
      <span class="hours__dots" aria-hidden="true"></span>
      <dd>{{ h.value }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.hours {
  display: grid;
  gap: 2px;
}
.hours__row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: baseline;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--hair);
  transition: color 0.4s;
}
.hours--compact .hours__row {
  padding: 5px 0;
  border: 0;
  font-size: 0.9rem;
}
.hours__dots {
  border-bottom: 1px dotted var(--hair-strong);
  transform: translateY(-4px);
}
.hours dd {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.is-closed dd {
  color: var(--ink-faint);
}
.is-today {
  color: var(--champagne);
}
.hours__today {
  margin-left: 8px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--black);
  background: var(--bronze);
  padding: 2px 6px;
  vertical-align: 2px;
}
</style>
