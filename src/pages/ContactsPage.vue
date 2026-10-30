<script setup>
import { useSite } from '../composables/useSite.js'
import PageHero from '../components/PageHero.vue'
import ContactSection from '../sections/ContactSection.vue'

const { t, info } = useSite()
</script>

<template>
  <PageHero :title="t.contactsTitle" :index="info.title" :image="info.imageContacts?.src" />
  <ContactSection index="" :heading="false" />
</template>
