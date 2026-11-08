// Renders brand SVG/HTML into PNG assets with the preinstalled Chromium (Playwright).
// Usage: node brand/scripts/render.mjs <out-dir> [--preview]
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const fontDir = path.resolve(root, '../node_modules/@expo-google-fonts/plus-jakarta-sans');
const out = path.resolve(process.argv[2] ?? path.join(root, 'png'));
mkdirSync(out, { recursive: true });

const BLUE = '#1769E8';
/** Background of the app icon / logo tile — the deep blue of the passtra logo. */
const ICON_BG = '#0009A9';
const DARK = '#0D47A1';
const SOFT = '#EAF2FF';
const mark = readFileSync(path.join(root, 'passtra-mark.svg'), 'utf8');
// Fonts are embedded as data URLs: pages created with setContent cannot load file:// fonts.
const face = (weight, file) => `@font-face{font-family:Jakarta;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(path.join(fontDir, file)).toString('base64')}) format('truetype')}`;
const font = [face(800, '800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'), face(700, '700Bold/PlusJakartaSans_700Bold.ttf'), face(500, '500Medium/PlusJakartaSans_500Medium.ttf')].join('\n');

const page = (body, w, h, bg = 'transparent') => `<!doctype html><html><head><style>${font}
html,body{margin:0;width:${w}px;height:${h}px;background:${bg};overflow:hidden}
.c{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
svg{display:block}</style></head><body>${body}</body></html>`;

const markSvg = (size, color) => mark.replace('<svg ', `<svg width="${size}" height="${size}" style="color:${color}" `);
const wordmark = (px, color) => `<span style="font-family:Jakarta;font-weight:800;font-size:${px}px;letter-spacing:${-px * 0.035}px;color:${color};line-height:1">passtra</span>`;

// The mark's viewBox keeps the logo's own margins (glyph ≈ 60% of the box), so "size" is the tile size.
const tile = (size, radius = 0) => `<div class="c" style="background:${ICON_BG};border-radius:${radius}px">${markSvg(size, '#fff')}</div>`;

const assets = [
  // iOS/App Store icon: full-bleed square, no transparency (the OS applies the mask).
  { name: 'icon.png', w: 1024, h: 1024, html: page(tile(1024), 1024, 1024, ICON_BG) },
  // Android adaptive icon: glyph (50% high) inside the 66% safe circle; background colour also set in app.json.
  { name: 'android-icon-foreground.png', w: 1024, h: 1024, html: page(`<div class="c">${markSvg(853, '#fff')}</div>`, 1024, 1024) },
  { name: 'android-icon-background.png', w: 1024, h: 1024, html: page('', 1024, 1024, ICON_BG) },
  { name: 'android-icon-monochrome.png', w: 1024, h: 1024, html: page(`<div class="c">${markSvg(853, '#000')}</div>`, 1024, 1024) },
  // Splash: mark only (expo-splash-screen centres it on the configured background colour).
  { name: 'splash-icon.png', w: 1024, h: 1024, html: page(`<div class="c">${markSvg(1024, '#fff')}</div>`, 1024, 1024) },
  { name: 'favicon.png', w: 196, h: 196, html: page(tile(196, 44), 196, 196) },
  // Web app (PWA) icons; the maskable one keeps the glyph inside the 80% safe circle.
  { name: 'icon-192.png', w: 192, h: 192, html: page(tile(192), 192, 192, ICON_BG) },
  { name: 'icon-512.png', w: 512, h: 512, html: page(tile(512), 512, 512, ICON_BG) },
  { name: 'icon-maskable-512.png', w: 512, h: 512, html: page(`<div class="c">${markSvg(436, '#fff')}</div>`, 512, 512, ICON_BG) },
  // Notification badge (Android Chrome uses only the alpha channel).
  { name: 'badge-96.png', w: 96, h: 96, html: page(`<div class="c">${markSvg(120, '#fff')}</div>`, 96, 96) },
  // Wordmarks for the app header, website and store graphics.
  { name: 'wordmark-blue.png', w: 1200, h: 360, html: page(`<div class="c">${wordmark(260, BLUE)}</div>`, 1200, 360) },
  { name: 'wordmark-white.png', w: 1200, h: 360, html: page(`<div class="c">${wordmark(260, '#fff')}</div>`, 1200, 360) },
  { name: 'lockup-horizontal.png', w: 1600, h: 420, html: page(`<div class="c" style="gap:36px"><div style="width:300px;height:300px;border-radius:72px;overflow:hidden">${tile(300)}</div>${wordmark(230, DARK)}</div>`, 1600, 420) },
  // Store feature graphic (Google Play 1024×500).
  { name: 'play-feature-graphic.png', w: 1024, h: 500, html: page(`<div class="c" style="flex-direction:column;gap:18px;background:linear-gradient(180deg,#FFFFFF 0%,${SOFT} 100%)"><div style="display:flex;align-items:center;gap:22px"><div style="width:120px;height:120px;border-radius:30px;overflow:hidden">${tile(120)}</div>${wordmark(110, DARK)}</div><div style="font-family:Jakarta;font-weight:500;font-size:34px;color:#43506A">What's happening around you, right now.</div></div>`, 1024, 500, '#fff') },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
for (const a of assets) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: a.w, height: a.h });
  await p.setContent(a.html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(out, a.name), omitBackground: true });
  await p.close();
  console.log('rendered', a.name);
}
await browser.close();
