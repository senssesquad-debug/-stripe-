// Keeps <html lang>, title, canonical and og tags in step with the route.
// The home page keeps the original title and description verbatim.
const ORIGIN = 'https://www.jzbarbershop.com'
const BASE_TITLE = 'JZ Cuts&Shave Barbershop - frizētava un bārdas kopšana'

function setMeta(selector, attr, value) {
  const el = document.head.querySelector(selector)
  if (el) el.setAttribute(attr, value)
}

export function applyHead(route, t) {
  const page = route.meta.page
  const lang = route.params.lang || document.documentElement.lang || 'lv'
  document.documentElement.lang = lang

  const label = page === 'privacy-policy' ? t.privacy : t.nav[page]
  const title = !page || page === 'root' || page === 'home' ? BASE_TITLE : `${label} — JZ Cuts&Shave Barbershop`
  document.title = title
  setMeta('meta[property="og:title"]', 'content', title)

  const url = ORIGIN + (route.path === '/' ? '/' : route.path)
  setMeta('link[rel="canonical"]', 'href', url)
}
