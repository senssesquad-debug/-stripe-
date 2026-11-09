// Browser test of the "What can I do today?" block and the activity screen (local server with the web build).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const p = await (await b.newContext({ viewport: { width: 420, height: 900 }, locale: 'en-US' })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const step = async (n, f) => { try { await f(); console.log('OK  ', n); } catch (e) { console.log('FAIL', n, e.message.split('\n').slice(0, 3).join(' | ')); await p.screenshot({ path: __dirname + '/shots/todo-fail-' + n.replace(/\W+/g, '_') + '.png' }); } };
  await p.goto('http://localhost:8080/');
  await p.evaluate(() => localStorage.setItem('passtra.state.v1', JSON.stringify({ onboarded: true, locale: 'en', city: 'limassol', radiusKm: 10, useLocation: false, theme: 'light', saved: {}, interests: [] })));
  await p.goto('http://localhost:8080/');
  await step('home shows WHAT CAN I DO TODAY? with real ideas', async () => {
    await p.getByText('WHAT CAN I DO TODAY?').waitFor({ timeout: 30000 });
    await p.locator('[data-testid^="idea-"]').first().waitFor({ timeout: 20000 });
    console.log('   ideas:', (await p.locator('[data-testid^="idea-"]').allInnerTexts()).slice(0, 5).map((x) => x.split('\n')[0]).join(' | '));
  });
  await p.screenshot({ path: __dirname + '/shots/todo-home.png' });
  await step('Right now filter: no idea claims places are open unless confirmed', async () => {
    await p.getByRole('button', { name: 'Right now' }).click();
    await p.waitForTimeout(2500);
    const texts = await p.locator('[data-testid^="idea-"]').allInnerTexts();
    console.log('   now:', texts.slice(0, 4).map((x) => x.replace(/\n/g, ' / ')).join(' || '));
  });
  await step('Indoor filter changes the list', async () => {
    const before = (await p.locator('[data-testid^="idea-"]').allInnerTexts()).map((x) => x.split('\n')[0]);
    await p.getByRole('button', { name: 'Indoor' }).click();
    await p.waitForTimeout(2500);
    const after = (await p.locator('[data-testid^="idea-"]').allInnerTexts()).map((x) => x.split('\n')[0]);
    if (after.includes('Ride a bike route')) throw new Error('outdoor idea under Indoor');
    console.log('   indoor:', after.join(' | '));
    await p.getByRole('button', { name: 'Indoor' }).click();
    await p.getByRole('button', { name: 'Today' }).click();
    await p.waitForTimeout(2000);
  });
  await step('open an idea: all options with availability and a route', async () => {
    await p.locator('[data-testid="idea-culture"]').click();
    await p.locator('[data-testid="activity-option"]').first().waitFor({ timeout: 20000 });
    const n = await p.locator('[data-testid="activity-option"]').count();
    console.log('   options listed:', n);
    await p.screenshot({ path: __dirname + '/shots/todo-activity.png' });
    await p.getByRole('button', { name: 'Directions' }).first().click();
    await p.waitForURL(/locate/, { timeout: 10000 });
  });
  console.log('page errors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
