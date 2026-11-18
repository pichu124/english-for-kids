/** Engagement features (Word Book, wardrobe, garden, mini-games, stories). node tests/e2e/features.mjs [baseUrl] [shotDir] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1') || '{}'));
const setState = (fn) => page.evaluate(`(() => { const s = JSON.parse(localStorage.getItem('efk.v1')); (${fn})(s); localStorage.setItem('efk.v1', JSON.stringify(s)); })()`);
const home = async () => {
  await page.goto(base);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
};

// ---------- A2: Word Book ----------
await home();
await page.locator('.dock-btn[aria-label="My Words"]').click({ force: true });
await page.waitForSelector('.book');
if (await page.locator('.sticker.is-got').count()) fail('fresh child should have no stickers');
step('Word Book opens from the home dock, all stickers locked at first');

// Play the Animals unit: tap game picks right first time → stickers.
await page.goto(`${base}/?unit=animals`);
await page.locator('.btn-play').click({ force: true });
for (let i = 0; i < 800 && !(await page.locator('.reward-actions:not([hidden])').count()); i++) {
  if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
  else if (await page.locator('.btn-mic.is-ready').count()) await page.locator('.btn-mic.is-ready').click({ force: true });
  else if (await page.locator('.play').count()) {
    const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
    const cards = page.locator('.word-card-play:not(.is-faded):not(.is-right)');
    for (let k = 0; k < (await cards.count()); k++) {
      const label = (await cards.nth(k).getAttribute('aria-label')).toLowerCase();
      if (said.includes(label)) { await cards.nth(k).click({ force: true }); break; }
    }
  }
  await page.waitForTimeout(80);
}
let s = await state();
const known = Object.entries(s.words).filter(([k, v]) => k.startsWith('animals/') && v.known).length;
if (!known) fail('right-first-time picks should mark words known');
await home();
const badge = await page.locator('.dock-btn[aria-label="My Words"] .badge').textContent();
if (!(Number(badge) >= known)) fail(`dock badge should count stickers, got ${badge}`);
await page.locator('.dock-btn[aria-label="My Words"]').click({ force: true });
await page.waitForSelector('.sticker.is-got');
const got = await page.locator('.sticker.is-got').count();
if (got < known) fail('book should show the known words as stickers');
const before = await page.evaluate(() => window.__spoken.length);
await page.locator('.sticker.is-got').first().click({ force: true });
await page.waitForTimeout(300);
if ((await page.evaluate(() => window.__spoken.length)) <= before) fail('tapping a sticker should say the word');
if (shots) await page.screenshot({ path: `${shots}/book.png` });
step(`after a lesson: ${got} stickers in the book, tap says the word`);

// __MORE__

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('features e2e ok');
