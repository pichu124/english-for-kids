/** Weekly report for parents. node tests/e2e/report.mjs [baseUrl] [shotDir] */
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

// A real lesson where the child misses a picture once → "words to practise".
await page.goto(`${base}/?unit=animals`);
await page.locator('.btn-play').click({ force: true });
let missed = null;
for (let i = 0; i < 1200 && !(await page.locator('.reward-actions:not([hidden])').count()); i++) {
  if (await page.locator('.btn-next:not([hidden])').count()) await page.locator('.btn-next:not([hidden])').click({ force: true });
  else if (await page.locator('.btn-mic.is-ready').count()) await page.locator('.btn-mic.is-ready').click({ force: true });
  else if (await page.locator('.play').count()) {
    const said = (await page.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase();
    const cards = page.locator('.word-card-play:not(.is-faded):not(.is-right)');
    const labels = [];
    for (let k = 0; k < (await cards.count()); k++) labels.push(((await cards.nth(k).getAttribute('aria-label', { timeout: 500 }).catch(() => '')) || '').toLowerCase());
    const right = labels.findIndex((l) => l && said.includes(l) && said.startsWith('where'));
    if (right >= 0) {
      if (!missed) {
        const wrong = labels.findIndex((l, k) => k !== right && l);
        await cards.nth(wrong).click({ force: true, timeout: 500 }).catch(() => {});
        missed = labels[right];
        await page.waitForTimeout(400);
      }
      await cards.nth(right).click({ force: true, timeout: 500 }).catch(() => {});
    }
  }
  await page.waitForTimeout(90);
}
if (!missed) fail('test should have missed one picture');

await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
await page.locator('.btn-parent').click({ force: true });
await page.waitForSelector('.gate');
const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
await page.waitForSelector('.p-week');
const week = await page.locator('.p-week').textContent();
if (!week.includes('1/7 ngày có học') || !week.includes('1 lượt học xong')) fail('week card: ' + week);
if (!week.includes(missed)) fail(`"${missed}" (missed once) should be in "words to practise": ${week}`);
step(`parent area "Tuần này": 1/7 days, 1 lesson, "${missed}" to practise`);

await page.locator('[data-report="open"]').click();
await page.waitForSelector('.rp');
const rp = await page.locator('.rp').textContent();
if (!rp.includes('Báo cáo tuần')) fail('report title');
if ((await page.locator('.rp-day.is-on').count()) !== 1) fail('one green day');
const newWords = await page.locator('.rp-words').first().locator('.rp-word').count();
if (newWords < 5) fail(`new words this week should list the stickers (got ${newWords})`);
if (!(await page.locator('.rp-words').nth(1).textContent()).includes(missed)) fail('words to practise in the report');
if (!rp.includes('Chơi cùng con tuần tới')) fail('tips for next week');
if (!rp.includes('Cùng bố mẹ')) fail('Play Together / worksheets section');
if ((await page.locator('.rp-skills .sk-item').count()) !== 4) fail('four skills in the report');
if (!(await page.locator('.rp-skills .sk-tip').textContent()).includes('Nên tập thêm')) fail('what to practise next');
if (shots) await page.screenshot({ path: `${shots}/report.png`, fullPage: true });
await page.evaluate(() => (window.print = () => (window.__printed = true)));
await page.locator('.rp-print').click();
if (!(await page.evaluate(() => window.__printed))) fail('print button');
step(`report: days, minutes, ${newWords} new words, words to practise, play-together tips, printable`);

await page.locator('.rp-actions .p-btn').first().click();
await page.waitForSelector('.p-wrap');
if (await page.locator('.gate').count()) fail('back from the report should not ask again');
step('back from the report → parent area without a second maths question');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('report e2e ok');
