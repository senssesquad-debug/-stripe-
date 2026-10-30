<script setup>
import { computed } from 'vue'
import { useSite } from '../composables/useSite.js'
import PageHero from '../components/PageHero.vue'

const { info, lang } = useSite()
const LOCALES = { lv: 'lv-LV', en: 'en-US', ru: 'ru-RU' }

// The policy is stored as <title>…</title><text>…</text> pairs.
const blocks = computed(() => {
  const out = []
  const re = /<(title|text)>([\s\S]*?)<\/\1>/g
  let m
  while ((m = re.exec(info.value.policyText || ''))) out.push({ kind: m[1], body: m[2].trim() })
  return out
})
const updated = computed(() => (info.value.policyLastSave ? new Date(info.value.policyLastSave).toLocaleDateString(LOCALES[lang.value] || 'lv-LV') : ''))
</script>

<template>
  <PageHero :title="info.policyTitle" index="JZ Barbershop">
    <p class="label faint">{{ updated }}</p>
  </PageHero>
  <section class="policy section">
    <div class="policy__body wrap">
      <template v-for="(b, i) in blocks" :key="i">
        <h2 v-if="b.kind === 'title'" class="policy__h serif">{{ b.body }}</h2>
        <p v-else class="policy__p muted">{{ b.body }}</p>
      </template>

      <address class="policy__dept">
        <p class="serif">{{ info.title }}</p>
        <a :href="info.map" target="_blank" rel="noopener" class="link-line">{{ info.address }}</a>
        <a :href="`mailto:${info.email}`" class="link-line">{{ info.email }}</a>
        <a :href="`tel:${info.phone}`" class="link-line">{{ info.phoneDisplay }}</a>
      </address>
    </div>
  </section>
</template>

<style scoped>
.policy {
  z-index: 2;
  padding-top: 40px;
}
.policy__body {
  max-width: 880px;
  margin-left: auto;
  margin-right: max(var(--gutter), 8vw);
  display: grid;
  gap: 18px;
}
.policy__h {
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  line-height: 1.1;
  margin-top: 36px;
  padding-top: 26px;
  border-top: 1px solid var(--hair);
}
.policy__p {
  font-size: 1.02rem;
  line-height: 1.8;
}
.policy__dept {
  display: grid;
  gap: 6px;
  margin-top: 48px;
  padding: 28px;
  border: 1px solid var(--hair);
  font-style: normal;
}
.policy__dept .serif {
  font-size: 2rem;
}
@media (max-width: 760px) {
  .policy__body {
    margin-right: auto;
  }
}
</style>
