/** Spaced review. node tests/e2e/review.mjs [baseUrl] [shotDir] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1') || '{}'));

// Finish the Numbers 11–20 unit quickly through the real lesson flow.
await page.goto(`${base}/?unit=l2-numbers2`);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.listen .pic-text');
if (shots) await page.screenshot({ path: `${shots}/numbers2-listen.png` });
step('numbers 11–20 show big number pictures');
for (let i = 0; i < 800 && !(await page.locator('.reward-actions:not([hidden])').count()); i++) {
  if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
  else if (await page.locator('.btn-mic.is-ready').count()) await page.locator('.btn-mic.is-ready').click({ force: true });
  else if (await page.locator('.play').count()) {
    const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
    const cards = page.locator('.word-card-play:not(.is-faded):not(.is-right)');
    for (let k = 0; k < (await cards.count()); k++) {
      const label = (await cards.nth(k).getAttribute('aria-label')).toLowerCase();
      if (said.endsWith(` ${label}?`)) { await cards.nth(k).click({ force: true }); break; }
    }
  }
  await page.waitForTimeout(80);
}
let s = await state();
const keys = Object.keys(s.review || {}).filter((k) => k.startsWith('l2-numbers2/'));
if (keys.length !== 10 || !keys.every((k) => s.review[k].box === 1)) throw new Error('finishing a unit should schedule its 10 words in box 1');
step('finishing a unit schedules its words for review (box 1, due tomorrow)');

// Not due yet → no review island. Then make them due.
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
if (await page.locator('.island-review').count()) throw new Error('review island should not show before words are due');
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('efk.v1'));
  for (const k of Object.keys(st.review)) st.review[k].due = '2000-01-01';
  localStorage.setItem('efk.v1', JSON.stringify(st));
});
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.island-review');
if (shots) await page.screenshot({ path: `${shots}/review-island.png` });
step('due words → a "Review" island appears on the map');

// Play the review: first round answer wrong once, the rest right first time.
await page.locator('.island-review').click({ force: true });
await page.waitForSelector('.play');
let round = 0;
for (let i = 0; i < 400 && !(await page.locator('.review-star').count()); i++) {
  if (await page.locator('.play').count()) {
    const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
    if (!said.includes('number ')) { await page.waitForTimeout(80); continue; }
    const cards = page.locator('.word-card-play:not(.is-faded):not(.is-right)');
    const n = await cards.count();
    let target = -1, other = -1;
    for (let k = 0; k < n; k++) {
      const label = (await cards.nth(k).getAttribute('aria-label')).toLowerCase();
      if (said.endsWith(` ${label}?`)) target = k; else other = k;
    }
    if (target >= 0) {
      if (round === 0 && other >= 0) { await cards.nth(other).click({ force: true }); await page.waitForTimeout(400); }
      await cards.nth(target).click({ force: true });
      round++;
      await page.waitForTimeout(500);
    }
  }
  await page.waitForTimeout(80);
}
s = await state();
const boxes = Object.values(s.review).map((r) => r.box).sort();
if (round !== 6) throw new Error(`review should have 6 rounds, got ${round}`);
if (boxes.filter((b) => b === 2).length !== 5) throw new Error('5 words answered first time should move to box 2: ' + boxes.join(','));
step('review: right first time → box 2 (due later); a miss stays in box 1');

if (errors.length) throw new Error(errors.join('\n'));
await browser.close();
