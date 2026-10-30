<script setup>
import { useSite } from '../composables/useSite.js'
import PageHero from '../components/PageHero.vue'
import BookingSteps from '../sections/BookingSteps.vue'
import ContactSection from '../sections/ContactSection.vue'
import img from '../assets/interior-corridor.webp'

const { t } = useSite()
</script>

<template>
  <PageHero :title="t.nav.booking" index="JZ Barbershop" :image="img" />
  <BookingSteps index="" :heading="false" />
  <ContactSection index="" :map="false" />
</template>
