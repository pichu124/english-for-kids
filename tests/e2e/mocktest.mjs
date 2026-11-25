/** Starters practice test. node tests/e2e/mocktest.mjs [baseUrl] [shotDir] */
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
await page.addInitScript(() => (window.__manualReading = true)); // the test answers by itself

await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
if (!(await page.locator('.island-test').count())) fail('Starters map ends with a 🎓 Test island');
await page.locator('.island-test').click({ force: true });
await page.waitForSelector('.test');

// Answer: wrong on purpose for the first listening question and the first spelling one.
const seen = { listening: 0, spelling: 0, reading: 0 };
let asked = 0;
let wrongOnPurpose = 0;
const spokenAll = [];
for (let i = 0; i < 600 && !(await page.locator('.test-result').count()); i++) {
  const q = page.locator('.test-q[data-answer]');
  if (await q.count()) {
    const answer = await q.getAttribute('data-answer');
    const part = ((await page.locator('.test-part').textContent()) || '').includes('Listening') ? 'listening' : ((await page.locator('.test-part').textContent()) || '').includes('Spelling') ? 'spelling' : 'reading';
    if (part === 'spelling') {
      const last = await page.evaluate(() => window.__spoken.at(-1) || '');
      if (/[a-z], /.test(last)) spokenAll.push(last);
    }
    const buttons = q.locator('button[data-word]');
    const n = await buttons.count();
    let target = null;
    const wrong = (part === 'listening' || part === 'spelling') && seen[part] === 0;
    for (let k = 0; k < n; k++) {
      const w = await buttons.nth(k).getAttribute('data-word');
      if (wrong ? w !== answer : w === answer) { target = buttons.nth(k); break; }
    }
    if (target) {
      await target.click({ force: true });
      seen[part]++;
      asked++;
      if (wrong) wrongOnPurpose++;
      await page.waitForFunction(() => !document.querySelector('.test-q[data-answer]') || document.querySelector('.test-intro'), null, { timeout: 8000 }).catch(() => {});
    }
  }
  await page.waitForTimeout(120);
}
await page.waitForSelector('.test-result');
if (asked !== 15) fail(`15 questions expected, answered ${asked}`);
if (seen.listening !== 5 || seen.spelling !== 3 || seen.reading !== 7) fail('parts: ' + JSON.stringify(seen));
if (!spokenAll.length) fail('spelling questions are spelled out by letter names');
if ((await page.evaluate(() => window.__spoken.filter((t) => /wrong/i.test(t)).length))) fail('never say wrong');
step(`15 questions: listening 5, spelling 3 (spelled "${spokenAll[0]}"), reading 7`);

const s = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).tests);
const r = s.at(-1).score;
if (r.listening.join('/') !== '4/5' || r.spelling.join('/') !== '2/3' || r.reading.join('/') !== '7/7') fail('score: ' + JSON.stringify(r));
const shieldsOn = await page.locator('.test-row[data-part="spelling"] .test-shields .on').count();
if (shieldsOn !== 3) fail(`2/3 spelling → 3 shields, got ${shieldsOn}`);
if (shots) await page.screenshot({ path: `${shots}/test-result.png` });
step('result: Listening 4/5, Spelling 2/3, Reading 7/7 → shields 4, 3, 5 (13/15 = pass)');

await page.locator('.test-result .btn-good').click({ force: true });
await page.waitForSelector('.home');
await page.locator('.btn-parent').click({ force: true });
await page.waitForSelector('.gate');
const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.waitForSelector('.p-tests');
const card = await page.locator('.p-tests').locator('..').textContent();
if (!card.includes('Đánh vần 2/3') || !card.includes('có thể bắt đầu bậc Movers')) fail('parent card: ' + card.slice(0, 300));
step('parent area: result per part and "ready for Movers" advice');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('mocktest e2e ok');
