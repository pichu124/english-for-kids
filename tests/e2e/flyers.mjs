/** Flyers (level 4). node tests/e2e/flyers.mjs [baseUrl] [shotDir] */
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
const catalog = await (await fetch(`${base}/catalog.json`)).json();
const l4 = catalog.units.filter((u) => u.level === 'L4').length;

// The Flyers map (?level=L4 link)
await page.goto(`${base}/?level=L4`);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
if ((await page.locator('.home-level').textContent()) !== 'Flyers') fail('level label');
const islands = await page.locator('.island:not(.island-review):not(.island-test)').count();
if (islands !== l4 || l4 < 10) fail(`Flyers map should show ${l4} (≥10) islands, got ${islands}`);
if (shots) await page.screenshot({ path: `${shots}/flyers-home.png` });
step(`Flyers map: ${islands} islands`);

// Part 2 of a Flyers unit: gap → read the definition and write the word → sentence → text.
await page.addInitScript(() => { window.__manualWrite = true; });
await page.goto(`${base}/?unit=l4-places&part=2`);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.progress-step');
const icons = (await page.locator('.progress-step').allTextContents()).join(' ');
if (icons !== '🧩 📝 ✍️ 📃 🎁') fail('Flyers part 2 = gap, define, sentence, text: ' + icons);
await page.waitForSelector('.write.define[data-word]', { timeout: 60000 });
await page.waitForTimeout(400);
const def = await page.locator('.def-card').textContent();
const word = await page.locator('.write.define').getAttribute('data-word');
if (def.toLowerCase().includes(word)) fail('the definition must not give the word away');
const spoken = await page.evaluate(() => window.__spoken.at(-1) || '');
if (spoken !== def) fail(`Bix reads the definition aloud ("${spoken}")`);
if (await page.locator('.write.define .pic').count()) fail('no picture in the definition step');
if (shots) await page.screenshot({ path: `${shots}/flyers-define.png` });
// a wrong key types nothing; then the word
const wrong = 'abcdefghijklmnopqrstuvwxyz'.split('').find((c) => c !== word[0]);
await page.locator(`.wr-key[data-key="${wrong}"]`).click({ force: true });
if (await page.locator('.wr-box.is-filled').count()) fail('a wrong key types nothing');
for (const c of word) { await page.locator(`.write.define .wr-key[data-key="${c}"]`).click({ force: true }); await page.waitForTimeout(40); }
await page.waitForFunction((w) => !document.querySelector(`.write.define[data-word="${w}"]`), word, { timeout: 8000 });
step(`define: "${def}" → typed "${word}"`);
await page.evaluate(() => (window.__manualWrite = false));
await page.waitForSelector('.reward-actions:not([hidden])', { timeout: 120000 });
step('Flyers part 2 runs to the reward');

// Flyers words have drawings or emoji; the planet is drawn.
await page.goto(`${base}/?unit=l4-space`);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.listen .pic');
step('Into Space opens');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('flyers e2e ok');
