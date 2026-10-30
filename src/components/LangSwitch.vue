<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSite } from '../composables/useSite.js'

const route = useRoute()
const { t, lang, languages } = useSite()

const items = computed(() =>
  languages.value.map((l) => ({
    ...l,
    href: route.path.replace(/^\/[a-z]{2}\//, `/${l.code}/`),
  })),
)
</script>

<template>
  <nav class="lang" :aria-label="t.ui.language">
    <RouterLink
      v-for="l in items"
      :key="l.code"
      :to="l.href"
      class="lang__item"
      :class="{ 'is-current': l.code === lang }"
      :lang="l.code"
      :hreflang="l.code"
      :aria-current="l.code === lang ? 'true' : undefined"
      :title="l.title"
    >
      <span class="visually-hidden">{{ l.title }}</span>
      <span aria-hidden="true">{{ l.code.toUpperCase() }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.lang {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.18em;
}
.lang__item {
  position: relative;
  padding: 10px 8px;
  color: var(--ink-faint);
  transition: color 0.4s;
}
.lang__item:hover,
.lang__item.is-current {
  color: var(--ink);
}
.lang__item.is-current::after {
  content: '';
  position: absolute;
  left: 8px;
  right: calc(8px + 0.18em);
  bottom: 5px;
  height: 1px;
  background: var(--bronze);
}
</style>
