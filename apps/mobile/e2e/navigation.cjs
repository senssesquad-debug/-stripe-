// Browser test of turn-by-turn navigation using the built-in simulation (no real movement).
// Run against a local server with the web build: node apps/mobile/e2e/navigation.cjs
// Screenshots of failures go to ./shots next to this file.
const { chromium } = require('playwright');
const FROM = '34.6786,33.0413', TO = { lat: 34.6830, lng: 33.0490 };
const url = (mode, sim, speed = 20, extra = '') => `http://localhost:8080/navigate?lat=${TO.lat}&lng=${TO.lng}&title=Test%20destination&mode=${mode}&from=${FROM}&sim=${sim}&speed=${speed}${extra}`;
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' }, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 860 }, locale: 'en-US' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const results = [];
  const step = async (n, f) => { try { await f(); console.log('OK  ', n); results.push([n, 'ok']); } catch (e) { console.log('FAIL', n, e.message.split('\n').slice(0, 3).join(' | ')); results.push([n, 'fail', e.message.split('\n')[0]]); await p.screenshot({ path: __dirname + '/shots/nav-fail-' + n.replace(/\W+/g, '_') + '.png' }); } };
  const tid = (id) => p.locator(`[data-testid="${id}"]`);
  const num = async (id) => (await tid(id).innerText()).replace(/\n/g, ' ');
  const meters = (s) => { const m = s.match(/([\d.,]+)\s*(km|m)\b/); return m ? parseFloat(m[1].replace(',', '.')) * (m[2] === 'km' ? 1000 : 1) : NaN; };
  await p.goto('http://localhost:8080/');
  await p.evaluate(() => localStorage.setItem('passtra.state.v1', JSON.stringify({ onboarded: true, locale: 'en', city: 'limassol', radiusKm: 10, useLocation: false, theme: 'light', saved: {}, interests: [] })));

  for (const mode of ['walk', 'bike', 'scooter', 'drive']) {
    const sim = mode;
    await step(`${mode}: simulation is labelled, guidance shown, progress and arrival`, async () => {
      await p.goto(url(mode, sim, mode === 'walk' ? 25 : 10));
      await tid('sim-badge').waitFor({ timeout: 30000 });
      if (!/SIMULATION/.test(await tid('sim-badge').innerText())) throw new Error('badge text');
      await tid('nav-instruction').waitFor({ timeout: 15000 });
      const r1 = meters(await num('nav-remaining'));
      await p.waitForTimeout(4000);
      const r2 = meters(await num('nav-remaining'));
      if (!(r2 < r1)) throw new Error(`remaining did not decrease ${r1} → ${r2}`);
      const prog = await tid('nav-progress').evaluate((el) => parseFloat(getComputedStyle(el).width));
      if (!(prog > 0)) throw new Error('progress bar empty');
      await tid('nav-arrived').waitFor({ timeout: 120000 });
      const nav = await p.evaluate(() => window.__passtraNav);
      const targets = nav.targets.filter((c) => c.mode === 'follow');
      const zooms = [...new Set(targets.map((c) => c.zoom))];
      console.log(`   ${mode}: ${targets.length} camera updates while following, target zoom levels: ${zooms.join(', ')}`);
      if (mode !== 'drive' && zooms.length !== 1) throw new Error('zoom changed while following: ' + zooms.join(','));
      if (mode === 'drive' && zooms.length > 2) throw new Error('drive zoom changed more than the two speed classes');
      // The map itself settles on that zoom (no creeping): the last recorded map states match the target.
      const settled = nav.camera.filter((c) => c.mode === 'follow').slice(-5).map((c) => c.zoom);
      console.log(`   ${mode}: map zoom at the end ${settled.join(', ')}`);
      if (settled.some((z) => Math.abs(z - targets.at(-1).zoom) > 0.05)) throw new Error('map zoom did not settle on the target: ' + settled);
      let maxTurn = 0;
      for (let i = 1; i < targets.length; i++) maxTurn = Math.max(maxTurn, Math.abs(((targets[i].bearing - targets[i - 1].bearing + 540) % 360) - 180));
      console.log(`   ${mode}: largest rotation between camera updates ${maxTurn}°`);
      if (maxTurn > 31) throw new Error('camera rotation jumped ' + maxTurn);
    });
  }

  await step('manual exploration: a drag stops following; Recenter brings it back', async () => {
    await p.goto(url('walk', 'walk', 4));
    await tid('nav-instruction').waitFor({ timeout: 30000 });
    await p.waitForTimeout(2500);
    const box = await tid('nav-map').boundingBox();
    await p.mouse.move(box.x + 200, box.y + 400); await p.mouse.down(); await p.mouse.move(box.x + 60, box.y + 250, { steps: 8 }); await p.mouse.up();
    await tid('nav-recenter').waitFor({ timeout: 5000 });
    const before = await p.evaluate(() => window.__passtraNav.camera.length);
    await p.waitForTimeout(4000);
    const after = await p.evaluate(() => window.__passtraNav.camera.slice(-3).map((c) => c.mode));
    if (after.some((m) => m === 'follow') && (await p.evaluate(() => window.__passtraNav.camera.length)) > before + 0 && after.at(-1) === 'follow') throw new Error('camera returned to following by itself');
    await tid('nav-recenter').click();
    await p.waitForTimeout(2500);
    const last = await p.evaluate(() => window.__passtraNav.camera.at(-1));
    if (last.mode !== 'follow') throw new Error('recenter did not resume following: ' + last.mode);
    if (await tid('nav-recenter').count()) throw new Error('recenter button still shown');
  });

  await step('overview shows the whole route, then back to following', async () => {
    await tid('nav-overview').click();
    await p.waitForTimeout(1500);
    const ov = await p.evaluate(() => window.__passtraNav.camera.at(-1));
    if (ov.mode !== 'overview' || Math.abs(ov.bearing) > 1) throw new Error('not an overview ' + JSON.stringify(ov));
    await tid('nav-overview').click();
    await p.waitForTimeout(2500);
    if ((await p.evaluate(() => window.__passtraNav.camera.at(-1))).mode !== 'follow') throw new Error('did not return to follow');
  });

  await step('north-up mode keeps the map unrotated', async () => {
    await tid('nav-rotate').click();
    await p.waitForTimeout(3500);
    const b = await p.evaluate(() => window.__passtraNav.camera.slice(-2).map((c) => c.bearing));
    if (b.some((x) => x !== 0)) throw new Error('rotated: ' + b);
    await tid('nav-rotate').click();
  });

  await step('leaving the route: detected, re-routed from the current position', async () => {
    await p.goto(url('walk', 'off_route', 8));
    await tid('nav-instruction').waitFor({ timeout: 30000 });
    await p.getByText(/You left the route/).waitFor({ timeout: 90000 });
    await p.getByText(/You left the route/).waitFor({ state: 'detached', timeout: 60000 });
    await tid('nav-arrived').waitFor({ timeout: 180000 });
  });

  await step('GPS lost is reported, and guidance continues when it returns', async () => {
    await p.goto(url('walk', 'gps_loss', 4));
    await tid('nav-instruction').waitFor({ timeout: 30000 });
    await p.getByText('GPS signal lost — showing your last known position.').waitFor({ timeout: 180000 });
    const r1 = meters(await num('nav-remaining'));
    await p.getByText('GPS signal lost — showing your last known position.').waitFor({ state: 'detached', timeout: 60000 });
    await p.waitForTimeout(3000);
    if (!(meters(await num('nav-remaining')) < r1)) throw new Error('no progress after GPS returned');
  });

  await step('stopping shows a pause note', async () => {
    await p.goto(url('walk', 'stop', 6));
    await tid('nav-instruction').waitFor({ timeout: 30000 });
    await p.getByText(/^Paused/).waitFor({ timeout: 180000 });
  });

  await step('turning back: guidance follows and still arrives', async () => {
    await p.goto(url('walk', 'turn_around', 25));
    await tid('nav-arrived').waitFor({ timeout: 180000 });
  });

  await step('Stop leaves navigation', async () => {
    await p.goto('http://localhost:8080/');
    await p.goto(url('walk', 'walk', 1));
    await tid('nav-stop').waitFor({ timeout: 30000 });
    await tid('nav-stop').click();
    await p.waitForTimeout(1500);
    if (/navigate/.test(p.url())) throw new Error('still on navigation: ' + p.url());
  });

  await step('public transport: stops and scheduled times while following the bus route', async () => {
    const d = await (await p.request.get(`http://localhost:8080/v1/directions?from=${FROM}&to=34.7071,33.0226&at=2026-11-10T10:00:00%2B02:00`)).json();
    if (d.transit.status !== 'ok') throw new Error('no transit locally: ' + d.transit.status);
    await p.goto(`http://localhost:8080/navigate?lat=34.7071&lng=33.0226&title=Bus%20test&mode=transit&from=${FROM}&sim=drive&speed=8&at=2026-11-10T10:00:00%2B02:00`);
    await tid('nav-instruction').waitFor({ timeout: 30000 });
    const txt = await num('nav-instruction');
    console.log('   first instruction:', txt);
    await tid('nav-transit').waitFor({ timeout: 120000 });
    console.log('   transit panel:', (await num('nav-transit')).slice(0, 160));
  });

  await step('Start Navigation button from the route panel opens guidance (real GPS, no simulation)', async () => {
    await ctx.grantPermissions(['geolocation']);
    await ctx.setGeolocation({ latitude: 34.6786, longitude: 33.0413, accuracy: 8 });
    const place = await (await p.request.get('http://localhost:8080/v1/places?city=limassol&limit=1')).json();
    await p.goto(`http://localhost:8080/locate?type=place&id=${place.items[0].id}&mode=route`);
    await tid('start-navigation').waitFor({ timeout: 40000 });
    if (!/START NAVIGATION/.test(await tid('start-navigation').innerText())) throw new Error('label');
    await tid('start-navigation').click();
    await tid('nav-remaining').waitFor({ timeout: 30000 });
    if (await tid('sim-badge').count()) throw new Error('simulation badge on real navigation');
    await p.screenshot({ path: __dirname + '/shots/nav-real.png' });
  });

  await p.goto(url('walk', 'walk', 2));
  await tid('nav-instruction').waitFor({ timeout: 30000 });
  await p.waitForTimeout(6000);
  await p.screenshot({ path: __dirname + '/shots/nav-sim.png' });
  console.log('page errors:', errs.length ? [...new Set(errs)].slice(0, 5) : 'none');
  require('fs').mkdirSync(__dirname + '/shots', { recursive: true }); require('fs').writeFileSync(__dirname + '/shots/nav-results.json', JSON.stringify(results, null, 1));
  await b.close();
})();
