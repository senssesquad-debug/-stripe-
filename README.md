# Happy Panda — redesign

A static redesign of happypanda.lv: a Chinese restaurant website with 3D scroll scenes.

## Run

Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

- `index.html`: page markup
- `assets/css/style.css`: styles and brand palette (`:root` tokens)
- `assets/js/data.js`: interface translations (LV / EN / RU)
- `assets/js/menu.js`: the menu (see below)
- `assets/js/main.js`: cart, checkout, reservations, language switch and the GSAP + Lenis scroll scenes

## Features

- Language switch (LV / EN / RU), remembered per visitor
- Menu by section with small/large portions, and a cart for delivery or pickup orders
- Links to delivery on Wolt and Bolt Food
- Table reservation form
- Contacts, opening hours and map
- 3D scenes: a hero plate that tilts on scroll, a fly-through "journey" tunnel, a scroll-driven signature-dish carousel, a dragon line that draws itself, and hover tilt on cards

## Menu data

`assets/js/menu.js` holds the restaurant's real menu: 133 dishes in 14 sections, with dish numbers, names and ingredients in LV / EN / RU, prices and photos. It was taken from Happy Panda's menu on Wolt, because happypanda.lv was unavailable (HTTP 503). Small and large portions of the same dish are merged into one card with a portion switch. Dish photos are in `assets/img/menu/`, named by dish number.

A few Latvian names that Wolt cuts off at a character limit were completed using the wording of the same dish's other portion or of similar dishes.

## Before launch

- Prices come from Wolt and may differ from in-restaurant prices. Check them against the restaurant's current price list.
- The order and reservation forms only log to the console. Connect them to a backend or e-mail service (search for `Hook this up` in `main.js`).
- The Bolt Food button links to the Bolt Food home page. Replace it with the restaurant's own Bolt Food link.
