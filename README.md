# JZ Cuts & Shave — website redesign

A new public frontend for [jzbarbershop.com](https://www.jzbarbershop.com) (JZ Barbershop, Alejas iela 75, Daugavpils).
It keeps every piece of the shop's content, all three languages (lv / en / ru), the original URLs and the
existing online booking, and gives them a new visual identity.

## Creative direction — “The Open Edge”

The shop's own name is the brief: **Cuts & Shave**. The signature object is a straight razor, built in
code with Three.js (brushed-steel blade with jimps, horn scales, brass pins). It opens on arrival, turns
edge-on as you scroll through the hero and *cuts* the headline in two, then follows the story:
beside the manifesto, out of frame behind the solid chapters, and closed again, ready, beside the
booking ledger.

- **Palette**: deep black `#080807`, charcoal `#171615`, chocolate `#30241E`, espresso `#49372B`, muted bronze
  `#987653`, champagne `#D6C3A5`, ivory `#F0E9DE`. Bronze is used as a hairline accent, not as “gold”.
  The price list is printed on warm ivory paper to break the dark rhythm.
- **Type**: Cormorant Garamond (high-contrast editorial serif, Latin Extended + Cyrillic) for display,
  Manrope for interface text. Both are self-hosted (no third-party font requests).
- **Texture**: film grain, warm light pools, desaturated sepia photography, outlined numerals.

### Chapters (home)

| Chapter | Treatment |
|---|---|
| Hero | 3D razor over the shop interior; pinned scroll where the razor turns edge-on and the headline splits along a cut line |
| JZ Barbershop | The shop description inked word-by-word on scroll; parallax collage of gallery photos; rotating seal |
| Ribbon | Name / address / phone marquee that speeds up with scroll velocity |
| Pakalpojumi | Pinned horizontal reel of all 15 services (photo or typographic price plate, description, price) |
| Cenas | Menu card on ivory paper; the service photo trails the cursor over the row being read |
| Komanda | Contact-sheet portraits in three columns drifting at different speeds, perspective tilt |
| Facebook | The live post feed as a draggable filmstrip with zoom lightbox and links to each post |
| Pieraksts | The four booking steps as a ledger, each previewing real data, and the booking CTA |
| Kontakti | Oversized phone number, hours with “today”, socials, warm-toned map |

Inner pages (`team`, `services`, `prices`, `contacts`, `booking`, `privacy-policy`) open with an oversized
letter-by-letter title over an interior photo. Page changes pass behind a two-panel curtain. On phones the
layout is rebuilt rather than shrunk: swipe strips instead of pinned reels, a lighter 3D scene only in the
hero, and a fixed booking/phone/WhatsApp bar.

## Content and functionality

Nothing was rewritten or invented — see [`docs/CONTENT_INVENTORY.md`](docs/CONTENT_INVENTORY.md) for the
audited inventory. In short:

- **Data source** — the same public API the original app uses (`/api/Public/DepartmentDataByCode`,
  `FacebookFeed`, …). When this frontend is served from jzbarbershop.com (or in `npm run dev`, which proxies
  `/api` and `/storage`), content is read live, so admin-panel edits appear immediately. Anywhere else the
  bundled snapshot (`src/data/snapshot.json` + `public/media/*.webp`) is used.
- **Booking** — every booking button (and each step of the booking ledger) opens the shop's existing
  booking system (service → barber → date → SMS-verified phone) in a full-screen sheet inside the site,
  so appointments go through the real system without leaving the page. Its URL is `VITE_BOOKING_URL`
  (default `https://www.jzbarbershop.com/{lang}/{dept}/booking`).
- **URLs** — identical to the original: `/`, `/:dept`, `/:lang/:dept/{home,team,services,prices,contacts,booking,privacy-policy}`.
- **SEO** — original title, description, Open Graph tags, canonical, Google site verification, `robots.txt`
  and both sitemaps are kept; per-page titles/canonicals, `<html lang>` and BarberShop JSON-LD were added.
- **Interface strings** — copied verbatim from the original interface in each language (`src/data/i18n.js`).

## Stack

Vite + Vue 3 + Vue Router (the original site is Vue 3 as well), Three.js (lazy-loaded on the home page only),
GSAP ScrollTrigger, Lenis smooth scrolling. No UI framework.

Accessibility and comfort: skip link, keyboard-operable menu/lightbox (Esc, arrows), visible focus, `aria`
labels, `prefers-reduced-motion` (no smooth scroll, no pinning, no autoplay motion, static razor), WebGL
fallback (the page works without it).

## Commands

```bash
npm install
npm run dev            # http://localhost:5173 — live content through the proxy
npm run build          # static build in dist/ (index.html + 404.html for deep links)
npm run preview        # serve the build
npm run sync           # refresh src/data/snapshot.json and public/media from the live API
npm run check:content  # list any difference between the snapshot and the live API
```

## Deployment notes

- Serve `dist/` with SPA fallback (any unknown path → `index.html`; `404.html` is provided for static hosts).
- Same-origin deployment on jzbarbershop.com gives live content. The admin panel routes of the original app
  (`/apanel`, `/login`, `/a-*`) and the booking page must keep being served by the original application, or
  `VITE_BOOKING_URL` must point to wherever the booking flow lives.
