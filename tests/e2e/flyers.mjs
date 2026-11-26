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
if (islands !== l4 || l4 < 10) fail(`Flyers map should show ${l4} (≥20) islands, got ${islands}`);
if ((await page.locator('.island-test').getAttribute('aria-label')) !== 'Flyers Test') fail('a Flyers Test island at the end of the map');
if (shots) await page.screenshot({ path: `${shots}/flyers-home.png` });
step(`Flyers map: ${islands} islands + 🎓 Flyers Test`);

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

// Flyers practice test: listening 5 (3 pictures + 2 who is who), writing 3 (read a definition, type the word), reading 6.
await page.evaluate(() => { window.__manualReading = true; window.__manualWrite = true; window.__manualText = true; });
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
await page.locator('.island-test').click({ force: true });
await page.waitForSelector('.test');
if ((await page.locator('.test h1').textContent()) !== 'Flyers Test') fail('Flyers Test title');
const parts = { listening: 0, writing: 0, reading: 0 };
let defShot = false;
for (let i = 0; i < 900 && !(await page.locator('.test-result').count()); i++) {
  const q = page.locator('.test-q[data-answer]');
  if (await q.count()) {
    const idx = await page.locator('.test-dots span.now').count();
    const answer = await q.getAttribute('data-answer');
    const tag = (await page.locator('.test-part').textContent()) || '';
    const part = tag.includes('Listening') ? 'listening' : tag.includes('Writing') ? 'writing' : 'reading';
    if (part === 'writing') {
      const def = await q.locator('.def-card').textContent().catch(() => '');
      if (!def) fail('Flyers writing shows a definition');
      if (def.toLowerCase().includes(answer)) fail('the definition must not contain the answer');
      if (q.locator('.pic').count && (await q.locator('.pic').count())) fail('no picture in Flyers writing');
      if (!defShot && shots) { await page.screenshot({ path: `${shots}/flyers-test-write.png` }); defShot = true; }
      for (const c of answer) { await page.locator(`.wr-key[data-key="${c}"]`).click({ force: true }); await page.waitForTimeout(50); }
    } else {
      await q.locator(`button[data-word="${answer}"]`).first().click({ force: true });
    }
    parts[part]++;
    await page.waitForFunction((n) => document.querySelectorAll('.test-dots span.now').length > n || document.querySelector('.test-result'), idx, { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('.test-q[data-answer]') || document.querySelector('.test-result'), null, { timeout: 10000 });
  }
  await page.waitForTimeout(100);
}
await page.waitForSelector('.test-result');
if (parts.listening !== 5 || parts.writing !== 3 || parts.reading !== 6) fail('Flyers test parts: ' + JSON.stringify(parts));
const res = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).tests.at(-1));
if (res.level !== 'L4' || res.score.writing.join('/') !== '3/3' || res.score.reading.join('/') !== '6/6' || res.score.listening.join('/') !== '5/5') fail('Flyers test score: ' + JSON.stringify(res));
if (shots) await page.screenshot({ path: `${shots}/flyers-test.png` });
step('Flyers Test: listening 5/5, writing 3/3 (definitions), reading 6/6');

// Parent area lists the Flyers result.
await page.locator('.test-result .btn-good').click({ force: true });
await page.waitForSelector('.home');
await page.locator('.btn-parent').click({ force: true });
await page.waitForSelector('.gate');
const [a, c] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(a * c)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.waitForSelector('.p-wrap');
if (!(await page.locator('.p-test-level[data-level="L4"]').count())) fail('parent area shows the Flyers Test result');
step('parent area: Flyers Test result');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('flyers e2e ok');
