// First run on a new device: the parents' welcome (name, age → level, daily time, sound + mic check).
// Run: node tests/e2e/welcome.mjs [baseUrl] [screenshotDir]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };
const browser = await chromium.launch();
const FAKES = readFileSync(new URL('./fakes.js', import.meta.url), 'utf8');

for (const vp of [{ width: 1280, height: 800 }, { width: 640, height: 320 }, { width: 800, height: 1280 }]) {
  const tag = `${vp.width}x${vp.height}`;
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(FAKES);
  await page.addInitScript(() => localStorage.removeItem('efk.welcome')); // a brand-new device
  await page.goto(base);
  await page.waitForSelector('.welcome [data-step="0"]');
  if (await page.locator('.btn-play').count()) fail('no Play button before the welcome');
  // nothing may stick out of the screen
  const cut = async (where) => {
    const bad = await page.evaluate(() => {
      const W = innerWidth;
      return [...document.querySelectorAll('.welcome button, .welcome input')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).map((b) => b.textContent);
    });
    if (bad.length) fail(`${tag} ${where}: cut off ${bad.join(', ')}`);
    if (shots) await page.screenshot({ path: `${shots}/welcome-${tag}-${where}.png` });
  };
  await cut('hello');
  await page.locator('[data-wl="next"]').click();
  await page.waitForSelector('[data-step="1"]');
  await page.locator('.wl-name').fill('Su');
  await page.locator('[data-age="7"]').click();
  if (!(await page.locator('[data-level="L3"].is-on').count())) fail('age 7 suggests Movers');
  await page.locator('[data-age="6"]').click();
  if (!(await page.locator('[data-level="L2"].is-on').count())) fail('age 6 suggests Starters');
  await cut('child');
  await page.locator('[data-wl="next"]').click();
  await page.waitForSelector('[data-step="2"]');
  if (!(await page.locator('[data-limit="15"].is-on').count())) fail('15 minutes is the default');
  await page.locator('[data-limit="20"]').click();
  await cut('time');
  await page.locator('[data-wl="next"]').click();
  await page.waitForSelector('[data-step="3"]');
  await page.locator('[data-wl="sound"]').click();
  await page.waitForSelector('[data-wl="heard"]');
  if (!(await page.evaluate(() => window.__spoken.some((t) => /I'm Bix/.test(t))))) fail('Bix speaks in the sound check');
  await page.locator('[data-wl="heard"]').click();
  await page.locator('[data-wl="mic"]').click();
  await page.waitForSelector('.wl-card .p-saved >> text=Micro chạy tốt');
  await cut('check');
  await page.locator('[data-wl="next"]').click();
  await page.waitForSelector('[data-step="4"]');
  if (!(await page.locator('.wl-lead').textContent()).includes('Su')) fail('the ready card names the child');
  await cut('done');
  await page.locator('[data-wl="go"]').click();
  await page.waitForSelector('.btn-play');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')));
  if (st.childName !== 'Su' || st.settings.level !== 'L2' || st.settings.dailyLimitMin !== 20 || !st.settings.srMode) fail('settings saved: ' + JSON.stringify(st.settings) + st.childName);
  // never again on this device
  await page.reload();
  await page.waitForSelector('.btn-play');
  if (await page.locator('.welcome').count()) fail('the welcome shows only once');
  if (errors.length) fail('page errors: ' + errors.join(' | '));
  step(`${tag}: welcome — name, age → level, daily time, sound and mic check, then Play; only once`);
  await ctx.close();
}

// "Skip" goes straight to Play with the defaults; a teacher's link skips the welcome.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(FAKES);
  await page.addInitScript(() => localStorage.removeItem('efk.welcome'));
  await page.goto(base);
  await page.locator('[data-wl="skip"]').click();
  await page.waitForSelector('.btn-play');
  await page.close();
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p2.addInitScript(FAKES);
  await p2.addInitScript(() => localStorage.removeItem('efk.welcome'));
  await p2.goto(base + '/?unit=animals');
  await p2.waitForSelector('.btn-play');
  if (await p2.locator('.welcome').count()) fail('a unit link skips the welcome');
  await p2.close();
  // a device with progress from before (no welcome flag) never sees it
  const p3 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p3.addInitScript(FAKES);
  await p3.addInitScript(() => { localStorage.removeItem('efk.welcome'); localStorage.setItem('efk.v1', JSON.stringify({ childName: 'Shin', settings: { dailyLimitMin: 0, rate: 0.8 }, topics: {}, words: {}, blocks: { inventory: {}, placed: [], totalEarned: 0 }, days: {}, bonus: {}, review: {} })); });
  await p3.goto(base);
  await p3.waitForSelector('.btn-play');
  await p3.close();
  step('skip → Play; a unit link and an existing child skip the welcome');
}
await browser.close();
console.log('welcome e2e ok');
