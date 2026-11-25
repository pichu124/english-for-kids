/** Movers (level 3). node tests/e2e/movers.mjs [baseUrl] [shotDir] */
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
const l3 = catalog.units.filter((u) => u.level === 'L3').length;

// The Movers map (?level=L3 link)
await page.goto(`${base}/?level=L3`);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
if ((await page.locator('.home-level').textContent()) !== 'Movers') fail('level label');
const islands = await page.locator('.island:not(.island-review):not(.island-test)').count();
if (islands !== l3 || l3 < 22) fail(`Movers map should show ${l3} (≥22) islands, got ${islands}`);
if ((await page.locator('.island-test').getAttribute('aria-label')) !== 'Movers Test') fail('a Movers Test island at the end of the map');
if (!(await page.locator('.dock-btn[aria-label="ABC"]').count())) fail('ABC for Movers too');
if (shots) await page.screenshot({ path: `${shots}/movers-home.png` });
step(`Movers map: ${islands} islands + 🎓 Movers Test`);

// Clock pictures (What Time Is It?)
await page.goto(`${base}/?unit=l3-time`);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.listen .pic-clock svg');
const aria = await page.locator('.listen .pic-clock svg').getAttribute('aria-label');
if (!/^\d+:00$/.test(aria)) fail('clock picture ' + aria);
if (shots) await page.screenshot({ path: `${shots}/movers-clock.png` });
step(`clock pictures for "o'clock" (${aria})`);

// Part 2 of "What's the Matter?": read → write → sentence → text
await page.evaluate(() => (window.__manualReading = true));
await page.goto(`${base}/?unit=l3-health&part=2`);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.progress-step');
const icons = (await page.locator('.progress-step').allTextContents()).join(' ');
if (icons !== '📖 ⌨️ ✍️ 📃 🎁') fail('Movers part 2 = read, write, sentence, text: ' + icons);
await page.evaluate(() => { window.__manualWrite = true; window.__manualText = true; window.__manualReading = false; });
await page.waitForSelector('.write[data-word]', { timeout: 60000 });
await page.waitForTimeout(400);
const word = await page.locator('.write').getAttribute('data-word');
if ((await page.locator('.wr-key').count()) !== 26) fail('a–z keyboard');
if ((await page.locator('.write .spell-tile').count())) fail('no letter tiles given when writing');
const wrongKey = 'abcdefghijklmnopqrstuvwxyz'.split('').find((c) => c !== word[0]);
await page.locator(`.wr-key[data-key="${wrongKey}"]`).click({ force: true });
await page.waitForTimeout(100);
await page.locator(`.wr-key[data-key="${wrongKey}"]`).click({ force: true });
await page.waitForTimeout(150);
if ((await page.locator('.wr-key.is-hint').getAttribute('data-key')) !== word[0]) fail('two slips → the right key glows');
if ((await page.locator('.wr-box.is-filled').count())) fail('a wrong key types nothing');
for (const c of word) {
  await page.locator(`.wr-key[data-key="${c}"]`).click({ force: true });
  await page.waitForTimeout(80);
}
if ((await page.locator('.wr-box.is-filled').allTextContents()).join('') !== word) fail('typed word');
if (shots) await page.screenshot({ path: `${shots}/movers-write.png` });
step(`write: typed "${word}" on the a–z keyboard; a wrong key types nothing, two slips → hint`);
await page.evaluate(() => (window.__manualWrite = false));

await page.waitForSelector('.tx-ask[data-answer]', { timeout: 90000 }).catch(async (e) => { await page.screenshot({ path: '/tmp/claude-0/-home-user-english-for-kids/b6f0c53c-8f55-52b9-8d58-719158415184/scratchpad/mv-fail.png' }); console.log(await page.evaluate(() => window.__spoken.slice(-4))); throw e; });
await page.evaluate(() => (window.__manualReading = true));
await page.waitForTimeout(300);
if (!(await page.locator('.tx-card').textContent()).includes('Tom Is Ill')) fail('the text');
const ans = await page.locator('.tx-ask').getAttribute('data-answer');
const wrongOpt = page.locator(`.tx-opt:not([data-k="${ans}"])`).first();
await wrongOpt.click({ force: true });
await page.waitForTimeout(300);
if (await page.locator('.tx-opt.is-right').count()) fail('a wrong answer is not marked right');
const n0 = await page.evaluate(() => window.__spoken.length);
await page.locator('.tx-card .btn-ear').click({ force: true });
await page.waitForTimeout(400);
if (!(await page.evaluate((n) => window.__spoken.slice(n).some((t) => t.startsWith('Yesterday Tom was ill')), n0))) fail('🔊 reads the text');
await page.locator(`.tx-opt[data-k="${ans}"]`).click({ force: true });
await page.waitForSelector('.tx-opt.is-right');
if (shots) await page.screenshot({ path: `${shots}/movers-text.png` });
await page.evaluate(() => { window.__manualReading = false; window.__manualText = false; });
await page.waitForSelector('.reward-actions:not([hidden])', { timeout: 60000 });
step('text: "Tom Is Ill" + questions; 🔊 reads it; a slip wiggles; then the reward');

// Movers stories open after their unit
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('efk.v1')); s.topics['l3-weather'] = { completed: 1, lastDone: '2026-11-20' }; localStorage.setItem('efk.v1', JSON.stringify(s)); });
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.locator('.dock-btn[aria-label="Stories"]').click({ force: true });
await page.waitForSelector('.story-book');
if (!(await page.locator('.story-book[data-story="story-l3-weather"]:not(.is-locked)').count())) fail('A Rainy Day opens after the weather unit');
step('Movers stories (past simple) on the Movers shelf');

// Movers practice test: listening 5, writing 3 (typed), reading 3 yes/no + a text with 3 questions.
await page.evaluate(() => { window.__manualReading = true; window.__manualWrite = true; window.__manualText = true; });
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
await page.locator('.island-test').click({ force: true });
await page.waitForSelector('.test');
if ((await page.locator('.test h1').textContent()) !== 'Movers Test') fail('Movers Test title');
const parts = { listening: 0, writing: 0, reading: 0 };
let typedWrong = false;
for (let i = 0; i < 900 && !(await page.locator('.test-result').count()); i++) {
  const q = page.locator('.test-q[data-answer]');
  if (await q.count()) {
    const idx = await page.locator('.test-dots span.now').count();
    const answer = await q.getAttribute('data-answer');
    const tag = (await page.locator('.test-part').textContent()) || '';
    const part = tag.includes('Listening') ? 'listening' : tag.includes('Writing') ? 'writing' : 'reading';
    if (part === 'writing') {
      // first word: one wrong key first (the question then counts as wrong), others clean
      if (!typedWrong) {
        typedWrong = true;
        const wrongKey = 'abcdefghijklmnopqrstuvwxyz'.split('').find((c) => c !== answer[0]);
        await page.locator(`.wr-key[data-key="${wrongKey}"]`).click({ force: true });
      }
      for (const c of answer) { await page.locator(`.wr-key[data-key="${c}"]`).click({ force: true }); await page.waitForTimeout(60); }
    } else {
      await q.locator(`button[data-word="${answer}"]`).first().click({ force: true });
    }
    parts[part]++;
    // wait for the next question (one more dot marked "now"), or the result
    await page.waitForFunction((n) => document.querySelectorAll('.test-dots span.now').length > n || document.querySelector('.test-result'), idx, { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('.test-q[data-answer]') || document.querySelector('.test-result'), null, { timeout: 10000 });
  }
  await page.waitForTimeout(100);
}
await page.waitForSelector('.test-result');
if (parts.listening !== 5 || parts.writing !== 3 || parts.reading !== 6) fail('Movers test parts: ' + JSON.stringify(parts));
const res = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).tests.at(-1));
if (res.level !== 'L3' || res.score.writing.join('/') !== '2/3' || res.score.reading.join('/') !== '6/6' || res.score.listening.join('/') !== '5/5') fail('Movers test score: ' + JSON.stringify(res));
if (shots) await page.screenshot({ path: `${shots}/movers-test.png` });
step('Movers Test: listening 5/5, writing 2/3 (a slip counts), reading 6/6 (yes/no + text)');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('movers e2e ok');
