import { ref } from 'vue'

// One booking sheet for the whole site; any booking button opens it.
const open = ref(false)

export function useBooking() {
  return {
    bookingOpen: open,
    openBooking: (e) => {
      // let modified clicks (new tab / window) follow the link as usual
      if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return
      e?.preventDefault?.()
      open.value = true
    },
    closeBooking: () => (open.value = false),
  }
}
