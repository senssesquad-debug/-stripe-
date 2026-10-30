// Static hosts let browsers keep pages for a while (GitHub Pages: 10 min), so
// an open tab can run an older build than the one just deployed. Compare with
// version.json and reload once when a newer build is live.
const KEY = 'jz-reloaded-for'

async function check() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const { id } = await res.json()
    if (!id || id === __BUILD_ID__) return
    // never loop if the host is still serving the old page after a reload
    if (sessionStorage.getItem(KEY) === id) return
    sessionStorage.setItem(KEY, id)
    location.reload()
  } catch {}
}

export function watchForNewBuild() {
  if (!import.meta.env.PROD) return
  check()
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
}
