<script setup>
import { useSite } from '../composables/useSite.js'
import PageHero from '../components/PageHero.vue'
import TeamGallery from '../sections/TeamGallery.vue'
import BookingSteps from '../sections/BookingSteps.vue'
import img from '../assets/interior-posters.webp'

const { t } = useSite()
</script>

<template>
  <PageHero :title="t.nav.team" index="JZ Barbershop" :image="img" />
  <TeamGallery full :heading="false" />
  <BookingSteps index="" />
</template>
