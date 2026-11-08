// UI smoke test: drives the web build of the app through the main flows and saves screenshots.
// Usage: start the API (port 8080) with data, serve apps/mobile/dist (port 8081), then `node scripts/e2e-web-smoke.mjs`.
// Fails (exit 1) on any page/console error.
import { createRequire } from 'node:module';
const require = createRequire('/home/user/-stripe-/package.json');
const { chromium } = require('playwright');
const OUT = process.env.SHOTS_DIR ?? 'docs/screenshots/latest';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
const base = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:8080';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, geolocation: { latitude: 34.676, longitude: 33.044 }, permissions: ['geolocation'], locale: 'en-US', colorScheme: 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = async (name) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };

await page.goto(base + '/', { waitUntil: 'networkidle' });
await shot('01-onboarding-welcome');
await page.getByText('Continue', { exact: true }).click();
for (const i of ['Music', 'Food & drink', 'Culture']) await page.getByText(i, { exact: true }).click();
await shot('02-onboarding-interests');
await page.getByText('Continue', { exact: true }).click();
await shot('03-onboarding-location');
await page.getByText('Allow location', { exact: true }).click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2500);
await shot('04-today');
await page.mouse.wheel(0, 700);
await shot('05-today-scrolled');
await page.mouse.wheel(0, 900);
await shot('06-today-scrolled-2');

// Event detail with an open conflict (real Pissouri case)
const ev = await (await fetch(`${API}/v1/events?limit=100`)).json();
const pissouri = ev.items.find((e) => e.title.startsWith('CYPRUS SWIM SERIES'));
const marathon = ev.items.find((e) => e.title.startsWith('Radisson Blu Larnaka'));
await page.goto(`${base}/event/${marathon.id}`, { waitUntil: 'networkidle' });
await shot('07-event-detail');
await page.mouse.wheel(0, 800);
await shot('08-event-sources');
await page.goto(`${base}/event/${pissouri.id}`, { waitUntil: 'networkidle' });
await page.mouse.wheel(0, 900);
await shot('09-event-conflict');

const pl = await (await fetch(`${API}/v1/places?lat=34.676&lng=33.044&radius=5&category=museum&limit=10`)).json();
const museum = pl.items.find((p) => p.images.length) ?? pl.items[0];
await page.goto(`${base}/place/${museum.id}`, { waitUntil: 'networkidle' });
await shot('10-place-detail');

await page.goto(`${base}/search`, { waitUntil: 'networkidle' });
await page.getByRole('textbox').fill('Где сегодня вечером можно выпить коктейль рядом?');
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
await shot('11-search-ru');

await page.goto(`${base}/explore`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot('12-explore');
await page.goto(`${base}/plan`, { waitUntil: 'networkidle' });
await page.getByText('Build my plan', { exact: true }).click();
await page.waitForTimeout(3000);
await page.mouse.wheel(0, 900);
await shot('13-plan-my-day');
await page.goto(`${base}/surprise`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await shot('14-surprise');
await page.goto(`${base}/profile`, { waitUntil: 'networkidle' });
await shot('15-profile');
await page.goto(`${base}/map`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot('16-map-web');

// Dark mode + Greek
await page.emulateMedia({ colorScheme: 'dark' });
await page.evaluate(() => { const k = 'passtra.state.v1'; const s = JSON.parse(localStorage.getItem(k)); s.locale = 'el'; localStorage.setItem(k, JSON.stringify(s)); });
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await shot('17-today-dark-greek');
console.log('errors:', JSON.stringify(errors.slice(0, 10), null, 1));
if (errors.length) process.exitCode = 1;
await browser.close();
