import { reactive, computed } from 'vue'
import snapshot from '../data/snapshot.json'
import { messages, DEFAULT_LANG, LANGS } from '../data/i18n.js'

// Same public API and file storage the original site uses. When this frontend
// is served from jzbarbershop.com (or through the dev proxy) content is read
// live; anywhere else the synced snapshot is used.
const API = import.meta.env.VITE_API_URL || '/api/'
const FILES_CDN = import.meta.env.VITE_FILES_CDN || '/storage/jz-public/'
const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'https://www.jzbarbershop.com/{lang}/{dept}/booking'

const state = reactive({
  lang: DEFAULT_LANG,
  dept: snapshot.departmentCodes[0],
  departments: { ...snapshot.departments },
  feeds: { ...snapshot.feeds },
  mainPageInfo: snapshot.mainPageInfo,
  live: false,
})

const STORAGE_KEY = 'jz-site'

export function rememberChoice(lang, dept) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang, dept }))
  } catch {}
}

export function storedChoice() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export function preferredLang() {
  const stored = storedChoice()?.lang
  if (LANGS.includes(stored)) return stored
  const nav = (navigator.languages || [navigator.language || '']).map((l) => l.slice(0, 2).toLowerCase())
  return nav.find((l) => LANGS.includes(l)) || DEFAULT_LANG
}

async function getJson(endpoint, timeout = 3500) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(API + endpoint, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

let refreshed = false
export async function refreshLive() {
  // static previews (VITE_PREVIEW) have no API next to them: snapshot only
  if (refreshed || import.meta.env.VITE_PREVIEW) return
  refreshed = true
  const code = state.dept
  const [dept, feed] = await Promise.all([
    getJson(`Public/DepartmentDataByCode?departmentCode=${encodeURIComponent(code)}`),
    getJson(`Public/FacebookFeed?siteKey=${encodeURIComponent(code)}&limit=10`),
  ])
  if (dept && Array.isArray(dept.services)) {
    state.departments[code] = dept
    state.live = true
  }
  if (feed && Array.isArray(feed.data)) {
    state.feeds[code] = feed.data.map((p) => {
      const att = p.attachments?.data?.[0]
      return {
        id: p.id,
        message: p.message || '',
        created_time: p.created_time,
        permalink_url: p.permalink_url,
        type: att?.type || null,
        image: att?.media?.image?.src || p.full_picture || null,
      }
    })
  }
}

export function setRoute(lang, dept) {
  state.lang = LANGS.includes(lang) ? lang : DEFAULT_LANG
  if (dept && state.departments[dept]) state.dept = dept
}

function pickText(list, lang, field) {
  if (!Array.isArray(list)) return ''
  const hit = list.find((x) => x.code === lang) || list.find((x) => x.code === DEFAULT_LANG) || list[0]
  return hit ? hit[field] ?? '' : ''
}

/** Resolves an API file path (or a Facebook image URL) to something loadable. */
export function media(key) {
  if (!key) return null
  const local = snapshot.media[key]
  // snapshot paths are root-relative; prefix the deploy base (sub-folder hosting)
  if (local) return { ...local, src: import.meta.env.BASE_URL + local.src.replace(/^\//, '') }
  if (/^https?:/.test(key)) return { src: key }
  return { src: FILES_CDN + key }
}

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function useSite() {
  const dept = computed(() => state.departments[state.dept])
  const t = computed(() => messages(state.lang))
  const lang = computed(() => state.lang)

  const info = computed(() => {
    const d = dept.value
    return {
      title: d.title,
      address: d.address,
      email: d.email,
      phone: d.phone,
      phoneDisplay: d.phone.replace(/^\+371(\d+)/, '+371 $1'),
      fb: d.socialFb,
      ig: d.socialIg,
      whatsapp: `https://wa.me/${d.phone}`,
      map: `https://maps.google.com/?q=${encodeURI(d.address)}`,
      description: pickText(d.descriptions, state.lang, 'description'),
      homeTitle: pickText(d.descriptions, state.lang, 'homeTitle'),
      homeDesc: pickText(d.descriptions, state.lang, 'homeDesc').trim(),
      policyTitle: pickText(d.descriptions, state.lang, 'policyTitle'),
      policyText: pickText(d.descriptions, state.lang, 'policyText'),
      policyLastSave: pickText(d.descriptions, state.lang, 'policyLastSave'),
      imageMain: media(d.imageMain),
      imageContacts: media(d.imageContacts),
      gallery: (d.gallery || []).slice().sort((a, b) => a.sortOrder - b.sortOrder).map((g) => media(g.path)),
      bookingEnabled: d.isBookingEnabled !== false,
    }
  })

  const services = computed(() =>
    (dept.value.services || []).map((s, i) => ({
      id: s.id,
      index: i + 1,
      title: pickText(s.texts, state.lang, 'title'),
      description: pickText(s.texts, state.lang, 'description'),
      price: s.price,
      image: media(s.imageUrl),
    })),
  )

  const serviceTitle = (id) => services.value.find((s) => s.id === id)?.title

  const team = computed(() =>
    (dept.value.teamMembers || []).map((m) => ({
      id: m.id,
      name: m.firstName,
      description: pickText(m.descriptions, state.lang, 'data'),
      photo: media(m.profilePicUrl),
      services: (m.services || []).map(serviceTitle).filter(Boolean),
    })),
  )

  const hours = computed(() => {
    const today = (new Date().getDay() + 6) % 7
    return DAY_KEYS.map((k, i) => {
      const value = (dept.value[`workingTime${k}`] || '').trim()
      return { day: t.value.days[i], value: value || t.value.closed, closed: !value, today: i === today }
    })
  })

  const feed = computed(() => state.feeds[state.dept] || [])

  const bookingUrl = computed(() => BOOKING_URL.replace('{lang}', state.lang).replace('{dept}', state.dept))

  const to = (page) => `/${state.lang}/${state.dept}/${page}`

  const countries = computed(() => (state.mainPageInfo || []).filter((c) => c.departments?.length))

  const languages = computed(() => dept.value.languages || LANGS.map((code) => ({ code, title: code.toUpperCase() })))

  return { state, dept, t, lang, info, services, team, hours, feed, bookingUrl, to, countries, languages }
}
