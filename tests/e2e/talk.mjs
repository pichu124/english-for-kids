/** Talk with Bix: scripted chats and Cambridge-style speaking practice. node tests/e2e/talk.mjs [baseUrl] [shotDir] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };
const browser = await chromium.launch();

/** Answers whatever is on screen: mic, picture answers, things to point at or find. */
async function drive(page, prefix, until = '.talk-done') {
  const seen = new Set();
  for (let i = 0; i < 600 && !(await page.locator(until).count()); i++) {
    const shot = async (name) => { if (shots && !seen.has(name)) { seen.add(name); await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/${prefix}-${name}.png` }); } };
    const task = await page.locator('.talk-task').getAttribute('data-task').catch(() => null);
    if (task === 'point' && (await page.locator('.talk-task[data-answer]').count())) {
      await shot('point');
      const a = await page.locator('.talk-task').getAttribute('data-answer');
      await page.locator(`.talk-item[data-word="${a}"]:not(.is-found)`).click({ force: true, timeout: 800 }).catch(() => {});
    } else if (task === 'differences' && (await page.locator('.talk-task[data-left]:not([data-left="0"])').count())) {
      await shot('differences');
      // try the things in picture two one after another (the same ones just wiggle)
      const b = page.locator('.talk-pic:nth-child(2) .talk-item:not(.is-found)');
      const n = await b.count();
      if (n) await b.nth(i % n).click({ force: true, timeout: 800 }).catch(() => {});
      await page.waitForTimeout(200);
    } else if (await page.locator('.mic-btn').count()) {
      await shot(task || 'chat');
      await page.locator('.mic-btn').click({ force: true, timeout: 800 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(80);
  }
  if (!(await page.locator(until).count())) fail(`${prefix}: should reach the end`);
}

for (const [vp, prefix] of [[{ width: 1280, height: 800 }, 'talk'], [{ width: 640, height: 320 }, 'talk640']]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 1000, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
  await page.goto(`${base}/?level=L2`);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
  await page.locator('.dock-btn[aria-label="Talk"]').click({ force: true });
  await page.waitForSelector('.talk-card');
  const cards = await page.locator('.talk-card').evaluateAll((els) => els.map((e) => e.dataset.talk));
  if (!cards.includes('practice') || !cards.includes('hello') || !cards.includes('food') || cards.includes('day')) fail('Starters: practice + L1/L2 chats only: ' + cards);
  if (shots) await page.screenshot({ path: `${shots}/${prefix}-menu.png` });

  // Chat by tapping a picture answer: Bix replies to the choice
  await page.locator('.talk-card[data-talk="hello"]').click({ force: true });
  let tapped = false;
  for (let i = 0; i < 300 && !(await page.locator('.talk-done').count()); i++) {
    if (await page.locator('.talk-chip[data-option="blue"]').count()) {
      if (shots) await page.screenshot({ path: `${shots}/${prefix}-chat-chips.png` });
      await page.locator('.talk-chip[data-option="blue"]').click({ force: true });
      await page.waitForFunction(() => window.__spoken.some((t) => /Blue! I like blue too!/.test(t)), null, { timeout: 5000 });
      tapped = true;
    } else if (await page.locator('.mic-btn').count()) {
      await page.locator('.mic-btn').click({ force: true, timeout: 800 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(80);
  }
  if (!tapped || !(await page.locator('.talk-done').count())) fail('the Hello chat runs to the end, a tapped answer gets its own reply');
  step(`${vp.width}x${vp.height}: chat "Hello!" — spoken answers and a tapped picture answer ("Blue! I like blue too!")`);

  // Starters speaking practice: point, name, personal questions
  await page.locator('.talk-done button[aria-label="Talk"]').click({ force: true });
  await page.locator('.talk-card[data-talk="practice"]').click({ force: true });
  await drive(page, `${prefix}-L2`);
  step(`${vp.width}x${vp.height}: Starters speaking practice — point to things, name them, answer questions`);

  if (vp.width === 1280) {
    for (const lv of ['L3', 'L4']) {
      await page.goto(`${base}/?level=${lv}`);
      await page.locator('.btn-play').click({ force: true });
      await page.waitForSelector('.home');
      await page.locator('.dock-btn[aria-label="Talk"]').click({ force: true });
      await page.locator('.talk-card[data-talk="practice"]').click({ force: true });
      await drive(page, `${prefix}-${lv}`);
      step(`${lv} speaking practice — find the differences, tell the picture story, questions`);
    }
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).talk);
    if (!st['chat-hello'] || !st['practice-L2'] || !st['practice-L3'] || !st['practice-L4']) fail('talk progress saved: ' + JSON.stringify(st));
    if ((await page.evaluate(() => window.__spoken.filter((t) => /wrong/i.test(t)).length))) fail('never say wrong');
  }
  if (errors.length) fail('page errors: ' + errors.join(' | '));
  await ctx.close();
}
await browser.close();
console.log('talk e2e ok');
