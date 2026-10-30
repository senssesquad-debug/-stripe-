# Happy Panda — redesign

A static redesign of happypanda.lv, the site of a Chinese restaurant in Daugavpils.

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
- `assets/js/main.js`: cart, checkout, reservations, language switch, carousel and entrance animations
- `assets/img/logo.svg`: the restaurant's logo (see below)

## Features

- Language switch (LV / EN / RU), remembered per visitor. On phones it sits at the top of the menu.
- Menu by section, including business lunch, with small/large portions, allergens and a cart for delivery or pickup orders
- Links to delivery on Wolt and Bolt Food
- Table reservation form
- Contacts, opening hours, map and Facebook

## Motion

Scrolling never moves or hides text. Sections fade in once and then stay put, and nothing is pinned to the scroll.

3D motion is limited to pictures:
- the hero plate follows the mouse on desktop;
- story photos tilt in once;
- the signature-dish carousel turns with its arrows, a swipe, a click on a side dish, or slowly by itself while it is on screen.

While the page is pinch-zoomed, all animation pauses. It also honours "reduce motion" in the system settings.

## Logo

`assets/img/logo.svg` is the original Happy Panda emblem (the panda with bamboo under the sun) redrawn as a vector. The original raster logo on happypanda.lv is only 164×99 px. The trace keeps the drawing, the bamboo sprig is redrawn cleanly, and the colours follow the site palette. `docs/original-logo.png` is the source image.

## Menu data

`assets/js/menu.js` holds the restaurant's menu as published on happypanda.lv: 161 items in 15 sections. Each item has its dish number, name and ingredients in LV / EN / RU, the restaurant's "hot" marks, allergens and photos. Prices come from the Latvian version of the site. Small and large portions are merged into one card with a portion switch. Dish photos are in `assets/img/menu/`.

## Before launch

- The order and reservation forms only log to the console. Connect them to a backend or e-mail service (search for `Hook this up` in `main.js`).
- The Bolt Food button links to the Bolt Food home page. Replace it with the restaurant's own Bolt Food link.
