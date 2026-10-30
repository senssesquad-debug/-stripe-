<script setup>
defineProps({ name: { type: String, required: true } })
</script>

<template>
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <template v-if="name === 'facebook'">
      <path fill="currentColor" d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z" />
    </template>
    <template v-else-if="name === 'instagram'">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.4" />
      <circle cx="12" cy="12" r="3.9" fill="none" stroke="currentColor" stroke-width="1.4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </template>
    <template v-else-if="name === 'whatsapp'">
      <path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" d="M4 20l1.2-4.1A8.3 8.3 0 1 1 8.4 19L4 20z" />
      <path fill="currentColor" d="M9.3 8.1c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.3.6 1.4 1.9 2.7 2.4.2.1.4 0 .5-.1l.7-.8c.1-.2.3-.2.5-.1l1.6.8c.2.1.3.2.3.4 0 .5-.2 1.3-.9 1.7-.6.4-1.7.6-3.4-.1-2-.9-3.4-2.9-3.7-3.4-.3-.4-.9-1.5-.9-2.5 0-1 .6-1.5.9-1.7z" />
    </template>
    <template v-else-if="name === 'phone'">
      <path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" d="M6.6 3.8l2.6-.4 1.4 4-1.8 1.3a11 11 0 0 0 6.5 6.5l1.3-1.8 4 1.4-.4 2.6c-.1.9-.9 1.6-1.8 1.6A15.7 15.7 0 0 1 5 5.6c0-.9.7-1.7 1.6-1.8z" />
    </template>
    <template v-else-if="name === 'mail'">
      <rect x="3.5" y="5.5" width="17" height="13" fill="none" stroke="currentColor" stroke-width="1.4" />
      <path d="M3.8 6l8.2 6.6L20.2 6" fill="none" stroke="currentColor" stroke-width="1.4" />
    </template>
    <template v-else-if="name === 'pin'">
      <path fill="none" stroke="currentColor" stroke-width="1.4" d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.8" r="2.3" fill="none" stroke="currentColor" stroke-width="1.4" />
    </template>
    <template v-else-if="name === 'arrow'">
      <path d="M3 12h17m-5.5-5.5L20 12l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'arrow-up-right'">
      <path d="M7 17L17 7M8.5 7H17v8.5" fill="none" stroke="currentColor" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'zoom'">
      <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M15 15l5 5M10.5 8v5M8 10.5h5" fill="none" stroke="currentColor" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="1.3" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
    </template>
  </svg>
</template>

<style scoped>
.icon {
  width: 1.2em;
  height: 1.2em;
  flex: none;
  display: inline-block;
}
</style>
