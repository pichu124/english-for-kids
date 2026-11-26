/** Emoji this phone cannot draw are replaced. node tests/e2e/emoji.mjs [baseUrl] [shotDir] */
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
const parent = async () => {
  await page.goto(base);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
  await page.locator('.btn-parent').click({ force: true });
  await page.waitForSelector('.gate');
  const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
  for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
  await page.click('.key-ok');
  await page.waitForSelector('.p-emoji-grid');
};

// This browser has a recent emoji font: everything is drawn.
await parent();
const bad0 = await page.locator('.p-emoji.is-bad').count();
const total = await page.locator('.p-emoji').count();
if (total !== 23) fail(`23 newer emoji are checked, got ${total}`);
if (bad0 !== 0) fail(`a recent browser should draw all newer emoji, ${bad0} flagged`);
step(`detector: this browser draws all ${total} newer emoji`);

// Pretend an old phone: no kite, no teddy, no teacher, no hippo.
await page.evaluate(() => localStorage.setItem('efk.emoji.missing', JSON.stringify(['🪁', '🧸', '🧑‍🏫', '🦛', '🧱'])));
await parent();
if ((await page.locator('.p-emoji.is-bad').count()) !== 5) fail('5 flagged on the "old phone"');
if (!(await page.locator('.p-wrap').textContent()).includes('không vẽ được 5/23')) fail('summary sentence');
if (shots) await page.screenshot({ path: `${shots}/emoji-check.png` });
step('old phone (simulated): 5 missing emoji reported in the parent area');

// In the Word Book: teddy → 🐻, kite → the word "kite", teacher → 👩‍🏫.
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
if (!(await page.locator('.dock-btn[aria-label="My World"] .dock-icon').textContent()).includes('🏠')) fail('dock: 🧱 → 🏠');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('efk.v1') || 'null') ?? { childName: '', settings: { dailyLimitMin: 0, rate: 0.8 }, topics: {}, words: {}, blocks: { inventory: {}, placed: [], totalEarned: 0 }, days: {}, bonus: {}, review: {} };
  for (const k of ['l2-toys/teddy', 'l2-toys/kite', 'l2-school/teacher', 'l2-animals2/hippo']) s.words[k] = { said: true, tries: 1 };
  localStorage.setItem('efk.v1', JSON.stringify(s));
});
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.locator('.dock-btn[aria-label="My Words"]').click({ force: true });
await page.waitForSelector('.book');
const sticker = (unit, word) => page.locator(`.book-page[data-unit="${unit}"] .sticker[aria-label="${word}"]`);
if ((await sticker('l2-toys', 'teddy').textContent()).indexOf('🐻') < 0) fail('teddy → 🐻');
if (!(await sticker('l2-toys', 'kite').locator('.pic-word').count())) fail('kite → written word');
if ((await sticker('l2-school', 'teacher').textContent()).indexOf('👩‍🏫') < 0) fail('teacher → 👩‍🏫');
if (!(await sticker('l2-animals2', 'hippo').locator('.pic-word').count())) fail('hippo → written word');
const html = await page.locator('.book').innerHTML();
for (const e of ['🪁', '🧸', '🧑‍🏫', '🦛']) if (html.includes(e)) fail(`${e} must not be shown on this phone`);
if (shots) await page.screenshot({ path: `${shots}/emoji-fallback.png` });
step('pictures: teddy → 🐻, teacher → 👩‍🏫, kite/hippo → the word written big; missing emoji never shown');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('emoji e2e ok');
