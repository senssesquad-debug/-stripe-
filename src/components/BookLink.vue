<script setup>
// Every booking action goes to the shop's existing online booking system
// (service → barber → date → SMS-verified phone), so appointments keep working.
import { useSite } from '../composables/useSite.js'
import Magnetic from './Magnetic.vue'
import Icon from './Icon.vue'

defineProps({ variant: { type: String, default: 'solid' }, label: { type: String, default: '' } })
const { t, bookingUrl } = useSite()
</script>

<template>
  <Magnetic>
    <a :href="bookingUrl" class="btn" :class="variant === 'solid' ? 'btn--solid' : ''" data-cursor>
      <span>{{ label || t.bookOnline }}</span>
      <Icon name="arrow" class="arrow" />
    </a>
  </Magnetic>
</template>
