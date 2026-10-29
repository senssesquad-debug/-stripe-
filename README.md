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
- `assets/js/data.js`: menu, categories and EN / LV / RU translations
- `assets/js/main.js`: cart, checkout, reservations, language switch and the GSAP + Lenis scroll scenes

## Features

- Language switch (LV / EN / RU), remembered per visitor
- Menu by category, with a cart (delivery or pickup, minimum order, delivery fee, takeaway discount)
- Table reservation form
- Contacts, opening hours and map
- 3D scenes: a hero plate that tilts on scroll, a fly-through "journey" tunnel, a scroll-driven signature-dish carousel, a dragon line that draws itself, and hover tilt on cards

## Before launch

- Replace the dish names, prices and photos in `assets/js/data.js` with the real menu.
- The order and reservation forms only log to the console. Connect them to a backend or e-mail service (search for `Hook this up` in `main.js`).
- The photos are from Unsplash. Replace them with the restaurant's own photography.
