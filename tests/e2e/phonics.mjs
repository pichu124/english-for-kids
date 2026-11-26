/** Phonics: sounds, blending, building words, reading a tiny book aloud. node tests/e2e/phonics.mjs [baseUrl] [shotDir] */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };
const browser = await chromium.launch();

async function playSet(page, setId, prefix) {
  await page.locator(`.ph-set[data-set="${setId}"]`).click({ force: true });
  await page.waitForSelector('.ph-meet');
  const seen = new Set();
  for (let i = 0; i < 400 && !(await page.locator('.ph-done').count()); i++) {
    const shot = async (name) => { if (shots && !seen.has(name)) { seen.add(name); await page.waitForTimeout(250); await page.screenshot({ path: `${shots}/${prefix}-${name}.png` }); } };
    if (await page.locator('.ph-meet').count()) {
      await shot('meet');
      const spoken = await page.evaluate(() => window.__spoken.at(-1) || '');
      if (!/…/.test(spoken)) fail('meeting a sound: Bix says the sound, then the word');
      await page.locator('.ph-next').click({ force: true });
    } else if (await page.locator('.ph-find[data-answer]').count()) {
      await shot('find');
      const a = await page.locator('.ph-find').getAttribute('data-answer');
      await page.locator(`.ph-find .ph-tile[data-sound="${a}"]`).click({ force: true });
      await page.waitForFunction((x) => !document.querySelector(`.ph-find[data-answer="${x}"]`) || document.querySelectorAll('.ph-find').length === 0, a, { timeout: 4000 }).catch(() => {});
    } else if (await page.locator('.ph-blend[data-answer]').count()) {
      await shot('blend');
      const a = await page.locator('.ph-blend').getAttribute('data-answer');
      await page.locator(`.ph-pic[data-word="${a}"]`).click({ force: true });
      await page.waitForTimeout(150);
    } else if (await page.locator('.ph-build[data-parts]').count()) {
      await shot('build');
      const parts = (await page.locator('.ph-build').getAttribute('data-parts')).split(',');
      for (const p of parts) { await page.locator(`.ph-build .ph-tile[data-sound="${p}"]:not(.is-used)`).first().click({ force: true }); await page.waitForTimeout(40); }
      await page.waitForTimeout(150);
    } else if (await page.locator('.ph-read').count()) {
      await shot('read');
      if (await page.locator('.ph-read .mic-btn').count()) {
        await page.locator('.ph-read .mic-btn').click({ force: true });
        await page.waitForSelector('.ph-rword.is-read', { timeout: 4000 });
        await shot('read-done');
      }
      await page.locator('.ph-next').click({ force: true });
    }
    await page.waitForTimeout(80);
  }
  if (!(await page.locator('.ph-done').count())) fail(`${setId}: the set should end with a star`);
}

for (const [vp, prefix] of [[{ width: 1280, height: 800 }, 'ph'], [{ width: 640, height: 320 }, 'ph640']]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 1000, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
  await page.goto(`${base}/?level=L2`);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
  await page.locator('.dock-btn[aria-label="ABC"]').click({ force: true });
  await page.locator('.abc-sounds-btn').click({ force: true });
  await page.waitForSelector('.ph-set');
  if ((await page.locator('.ph-set').count()) !== 5) fail('5 sound sets');
  if (!(await page.locator('.ph-set.is-next[data-set="p1"]').count())) fail('the first set is suggested');
  if (shots) await page.screenshot({ path: `${shots}/${prefix}-menu.png` });
  await playSet(page, 'p1', prefix);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')));
  if (st.phonics?.p1 !== 1) fail('set p1 counted as done');
  if (!(st.readAloud?.['phonics-p1'] >= 4)) fail('the 4 book pages were read aloud by the child');
  if (shots) await page.screenshot({ path: `${shots}/${prefix}-done.png` });
  step(`${vp.width}x${vp.height}: Sounds 1 — meet s a t p i n, find, blend, build, read the book aloud`);
  // digraphs (sh, ch, th, ee, oo) build from two-letter tiles
  await page.locator('button[aria-label="Sounds"]').first().click({ force: true });
  await page.waitForSelector('.ph-set');
  if (!(await page.locator('.ph-set[data-set="p1"] .ph-set-star').count())) fail('a star on the finished set');
  if (vp.width === 1280) {
    await playSet(page, 'p5', prefix);
    step('Sounds 5 — two-letter sounds (sh, ch, th, ee, oo) blend and build');
  }
  // no microphone: a parent can confirm the reading
  if (vp.width === 1280) {
    await page.evaluate(() => (window.__voice = 'denied'));
    await page.locator('button[aria-label="Sounds"]').first().click({ force: true });
    await page.locator('.ph-set[data-set="p2"]').click({ force: true });
    for (let i = 0; i < 400 && !(await page.locator('.ph-read').count()); i++) {
      if (await page.locator('.ph-meet').count()) await page.locator('.ph-next').click({ force: true });
      else if (await page.locator('.ph-find[data-answer]').count()) { const a = await page.locator('.ph-find').getAttribute('data-answer'); await page.locator(`.ph-find .ph-tile[data-sound="${a}"]`).click({ force: true }); }
      else if (await page.locator('.ph-blend[data-answer]').count()) { const a = await page.locator('.ph-blend').getAttribute('data-answer'); await page.locator(`.ph-pic[data-word="${a}"]`).click({ force: true }); }
      else if (await page.locator('.ph-build[data-parts]').count()) { for (const p of (await page.locator('.ph-build').getAttribute('data-parts')).split(',')) await page.locator(`.ph-build .ph-tile[data-sound="${p}"]:not(.is-used)`).first().click({ force: true }); }
      await page.waitForTimeout(120);
    }
    await page.locator('.ph-read .mic-btn').click({ force: true });
    await page.waitForSelector('.mic-parent-ok', { timeout: 4000 });
    await page.locator('.mic-parent-ok').click({ force: true });
    await page.waitForSelector('.ph-rword.is-read');
    step('mic blocked: a parent confirms "✓ Bé đã nói" and the words turn green');
  }
  if (errors.length) fail('page errors: ' + errors.join(' | '));
  await ctx.close();
}
// Stories: the child reads a page aloud ("My turn"); heard words turn green and the page counts.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
  await page.addInitScript(() => {
    if (!localStorage.getItem('efk.v1')) localStorage.setItem('efk.v1', JSON.stringify({ childName: 'Shin', settings: { dailyLimitMin: 0, rate: 0.8, level: 'L2' }, topics: { 'l2-home': { completed: 1 } }, words: {}, blocks: { inventory: {}, placed: [], totalEarned: 0 }, days: {}, bonus: {}, review: {} }));
  });
  await page.goto(base);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
  await page.locator('.dock-btn[aria-label="Stories"]').click({ force: true });
  await page.locator('.story-book[data-story="story-l2-home"]').click({ force: true });
  await page.waitForSelector('.story-mine');
  await page.locator('.story-mine').click({ force: true });
  await page.locator('.story-controls .mic-btn').click({ force: true });
  await page.waitForFunction(() => document.querySelectorAll('.story-word.is-read').length === document.querySelectorAll('.story-word').length, null, { timeout: 5000 });
  if (shots) await page.screenshot({ path: `${shots}/story-myturn.png` });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')));
  if (st.readAloud?.['story-l2-home'] !== 1) fail('a page read aloud is counted');
  // a misheard reading: "Try again!", never "wrong"
  await page.locator('.story-next').click({ force: true });
  await page.evaluate(() => (window.__voice = 'miss'));
  await page.locator('.story-mine').click({ force: true });
  await page.locator('.story-controls .mic-btn').click({ force: true });
  await page.waitForFunction(() => /try again/i.test(window.__spoken.at(-1) || ''), null, { timeout: 5000 });
  if ((await page.evaluate(() => window.__spoken.filter((t) => /wrong/i.test(t)).length))) fail('never say wrong');
  step('stories: "My turn" — the child reads the page aloud, words turn green; a miss is "Try again!"');
  await page.close();
}
await browser.close();
console.log('phonics e2e ok');
