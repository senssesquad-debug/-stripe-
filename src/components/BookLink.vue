<script setup>
// Every booking action opens the shop's existing online booking system
// (service → barber → date → SMS-verified phone) in the booking sheet.
import { useSite } from '../composables/useSite.js'
import { useBooking } from '../composables/useBooking.js'
import Magnetic from './Magnetic.vue'
import Icon from './Icon.vue'

defineProps({ variant: { type: String, default: 'solid' }, label: { type: String, default: '' } })
const { t, bookingUrl } = useSite()
const { openBooking } = useBooking()
</script>

<template>
  <Magnetic>
    <a :href="bookingUrl" class="btn" :class="variant === 'solid' ? 'btn--solid' : ''" data-cursor @click="openBooking">
      <span>{{ label || t.bookOnline }}</span>
      <Icon name="arrow" class="arrow" />
    </a>
  </Magnetic>
</template>
