<script setup>
import { useSite } from '../composables/useSite.js'
import PageHero from '../components/PageHero.vue'
import PriceMenu from '../sections/PriceMenu.vue'
import BookingSteps from '../sections/BookingSteps.vue'
import img from '../assets/interior-station.webp'

const { t } = useSite()
</script>

<template>
  <PageHero :title="t.nav.prices" index="JZ Barbershop" :image="img" />
  <PriceMenu index="" :heading="false" />
  <BookingSteps index="" />
</template>
