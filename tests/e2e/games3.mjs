// Grammar, Maths, Sort it!, Songs, Hello! (first step of Today), placement quiz, level-up hint, Vietnamese meanings.
// Run: node tests/e2e/games3.mjs [baseUrl] [shotsDir]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };
const FAKES = readFileSync(new URL('./fakes.js', import.meta.url), 'utf8');
const browser = await chromium.launch();
const errors = [];
const shot = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });

async function open(level, { vp = { width: 1280, height: 800 }, state = {}, games = true } = {}) {
  const page = await browser.newPage({ viewport: vp });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(FAKES);
  await page.addInitScript(([lv, extra]) => {
    if (!localStorage.getItem('efk.v1')) localStorage.setItem('efk.v1', JSON.stringify({ childName: 'Shin', settings: { dailyLimitMin: 0, rate: 0.8, level: lv }, topics: {}, words: {}, blocks: { inventory: {}, placed: [], totalEarned: 0 }, days: {}, bonus: {}, review: {}, ...extra }));
  }, [level, state]);
  await page.goto(base);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
  if (games) {
    await page.locator('.dock-btn[aria-label="Games"]').click({ force: true });
    await page.waitForSelector('.games-list');
  }
  return page;
}
async function parentArea(page) {
  await page.locator('.btn-parent, .dock-btn[aria-label="Parents"], [aria-label="Parents"]').first().click({ force: true });
  const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
  for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
  await page.click('.key-ok');
  await page.waitForSelector('.p-wrap .p-card');
}
const spoken = (page) => page.evaluate(() => window.__spoken.join(' | '));
const lastSaid = (page) => page.evaluate(() => window.__spoken.at(-1) || '');

// which games each level gets
{
  const p0 = await open('L0');
  if (!(await p0.locator('[data-game="maths"]').count()) || !(await p0.locator('[data-game="sort"]').count()) || (await p0.locator('[data-game="grammar"]').count())) fail('3–4: Maths and Sort it!, no Grammar');
  if (!(await p0.locator('[data-game="songs"]').count())) fail('Songs for everyone');
  await p0.close();
  const p2 = await open('L2');
  if (!(await p2.locator('[data-game="grammar"]').count())) fail('Starters: Grammar');
  await shot(p2, 'games-list');
  await p2.close();
  step('Games: Maths, Sort it!, Songs for every level; Grammar from Starters');
}

// Grammar
for (const level of ['L2', 'L3', 'L4']) {
  const page = await open(level, level === 'L2' ? {} : { vp: { width: 740, height: 360 } });
  await page.locator('[data-game="grammar"]').click({ force: true });
  const kinds = [];
  for (let r = 0; r < 8; r++) {
    await page.waitForSelector('.gr-round');
    const round = page.locator('.gr-round');
    const ans = await round.getAttribute('data-answer');
    kinds.push(await round.getAttribute('data-kind'));
    await page.waitForTimeout(450);
    if (r === 0) {
      if (level === 'L2') await shot(page, 'grammar');
      if (level === 'L3') await shot(page, 'grammar-phone');
      const other = page.locator(`.gr-opt:not([data-word="${ans}"])`).first();
      await other.click();
      await page.waitForFunction(() => /try (the other one|again)/i.test(window.__spoken.at(-1) || ''));
    }
    const before = await page.evaluate(() => window.__spoken.length);
    await page.locator(`.gr-opt[data-word="${ans}"]`).click();
    await page.waitForFunction(([n, a]) => window.__spoken.slice(n).some((t) => t.includes(a)), [before, ans]);
    if (!(await page.locator('.gr-gap.is-filled').textContent()).includes(ans)) fail('the gap shows the answer');
    if (r < 7) await page.waitForFunction((n) => document.querySelectorAll('.gr-gap.is-filled').length === 0, null, { timeout: 8000 });
  }
  await page.waitForSelector('.game-done');
  const said = await spoken(page);
  if (/wrong/i.test(said)) fail('never "wrong"');
  if (level === 'L3' && !kinds.some((k) => ['was', 'past', 'compare'].includes(k))) fail('Movers sentences come up: ' + kinds);
  if (level === 'L4' && !kinds.some((k) => ['future', 'ever'].includes(k))) fail('Flyers sentences come up: ' + kinds);
  step(`Grammar (${level}): 8 sentences (${[...new Set(kinds)].join(', ')}), the full sentence read after each`);
  await page.close();
}

// Maths
for (const level of ['L0', 'L2', 'L3']) {
  const page = await open(level, level === 'L3' ? { vp: { width: 740, height: 360 } } : {});
  await page.locator('[data-game="maths"]').click({ force: true });
  const kinds = [];
  for (let r = 0; r < 6; r++) {
    await page.waitForSelector('.mt-round');
    const round = page.locator('.mt-round');
    const ans = await round.getAttribute('data-answer');
    const kind = await round.getAttribute('data-kind');
    kinds.push(kind);
    if (kind === 'take') await page.waitForSelector('.mt-item.is-gone');
    await page.waitForTimeout(450);
    if (r === 0 && level === 'L2') await shot(page, 'maths');
    if (r === 0 && level === 'L3') await shot(page, 'maths-phone');
    const sel = kind === 'more' ? '.mt-pick' : '.mt-num';
    if (r === 1) {
      await page.locator(`${sel}:not([data-n="${ans}"])`).first().click();
      await page.waitForFunction(() => /Hmm|Listen/.test(window.__spoken.at(-1) || ''));
    }
    await page.locator(`${sel}[data-n="${ans}"]`).click();
    await page.waitForSelector(`${sel}.is-right`);
    if (r < 5) await page.waitForFunction((k) => !document.querySelector('.mt-num.is-right, .mt-pick.is-right'), null, { timeout: 12000 });
  }
  await page.waitForSelector('.game-done');
  if (level === 'L0' && kinds.some((k) => k !== 'count')) fail('3–4 years: counting only');
  if (level === 'L3' && !kinds.includes('find')) fail('Movers: 13 or 30?');
  step(`Maths (${level}): ${kinds.join(', ')}`);
  await page.close();
}

// Sort it!
for (const level of ['L0', 'L2']) {
  const page = await open(level, level === 'L2' ? { vp: { width: 740, height: 360 } } : {});
  await page.locator('[data-game="sort"]').click({ force: true });
  for (let i = 0; i < 6; i++) {
    await page.waitForSelector('.so-word');
    await page.waitForTimeout(450);
    if (i === 0) await shot(page, level === 'L0' ? 'sort' : 'sort-phone');
    const cat = await page.locator('.so-word').getAttribute('data-cat');
    if (i === 0) {
      await page.locator(`.so-basket:not([data-cat="${cat}"])`).click();
      await page.waitForFunction(() => /Look again/.test(window.__spoken.at(-1) || ''));
    }
    await page.locator(`.so-basket[data-cat="${cat}"]`).click();
    await page.waitForFunction((n) => document.querySelectorAll('.so-mini').length === n, i + 1);
  }
  if (level === 'L2') {
    for (let i = 0; i < 3; i++) {
      await page.waitForSelector('.so-round[data-phase="odd"]');
      const ans = await page.locator('.so-round').getAttribute('data-answer');
      await page.waitForTimeout(450);
      if (i === 0) await shot(page, 'odd-phone');
      await page.locator(`.so-odd[data-word="${ans}"]`).click();
      await page.waitForFunction((a) => window.__spoken.some((t) => t.includes(`The ${a} is different`)), ans);
      if (i < 2) await page.waitForFunction((a) => document.querySelector('.so-round')?.getAttribute('data-answer') !== a, ans, { timeout: 8000 });
    }
  }
  await page.waitForSelector('.game-done');
  step(`Sort it! (${level}): 6 pictures into two baskets${level === 'L2' ? ', then 3 odd ones out' : ''}`);
  await page.close();
}

// Songs: a lesson done unlocks its chant
{
  const page = await open('L2', { state: { topics: { 'l2-zoo': { completed: 1 } } } });
  await page.locator('[data-game="songs"]').click({ force: true });
  await page.waitForSelector('.songs-grid');
  await shot(page, 'songs');
  const locked = page.locator('.song-tile.is-locked').first();
  await locked.click();
  await page.waitForFunction(() => /to sing this song/.test(window.__spoken.at(-1) || ''));
  const open1 = page.locator('.song-tile:not(.is-locked)');
  if ((await open1.count()) !== 1) fail('one song unlocked: ' + (await open1.count()));
  await open1.click();
  await page.waitForSelector('.song-play .chant-line');
  await page.waitForFunction(() => /Lovely singing/.test(window.__spoken.join('|')), null, { timeout: 20000 });
  const lines = await page.locator('.chant-line').count();
  if (lines < 2) fail('the chant lines show');
  step(`Songs: the chant of a finished lesson (${lines} lines) plays again, others are locked`);
  await page.close();
}

// Hello! first in Today
{
  const page = await open('L2', { games: false });
  await page.locator('.today-btn, [aria-label="Today"]').first().click({ force: true });
  await page.waitForSelector('.today-card[data-kind="hello"].is-now');
  await page.locator('.today-go').click();
  await page.waitForSelector('.cc-day.is-hint');
  await page.waitForTimeout(450);
  await shot(page, 'hello-day');
  await page.locator('.cc-day.is-hint').click({ force: true });
  await page.waitForSelector('.cc-round[data-part="weather"]');
  await page.waitForTimeout(450);
  await shot(page, 'hello-weather');
  await page.locator('.cc-opt[data-id="sunny"]').click();
  await page.waitForSelector('.cc-round[data-part="feel"]', { timeout: 10000 });
  await page.waitForTimeout(450);
  await page.locator('.cc-opt[data-id="tired"]').click();
  await page.waitForSelector('.cc-done .today-next', { timeout: 10000 });
  const said = await spoken(page);
  for (const must of ['Good ', 'Today is', "It's sunny", "I'm tired", 'stretch']) if (!said.includes(must)) fail(`Hello says "${must}"`);
  const log = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('efk.v1')); return Object.values(s.days).map((d) => d.circle).find(Boolean); });
  if (log?.weather !== 'sunny' || log?.feel !== 'tired') fail('weather and feeling saved: ' + JSON.stringify(log));
  await page.locator('.today-next').click();
  await page.waitForSelector('.today-card[data-kind="hello"].is-done');
  // the weekly report shows it
  await page.locator('.home-btn, [aria-label="Home"]').first().click({ force: true });
  await page.waitForSelector('.home');
  await parentArea(page);
  await page.locator('[data-report="open"]').click();
  await page.waitForSelector('.rp-feelings');
  if (!/mệt/.test(await page.locator('.rp-feelings').textContent())) fail('report: the child felt tired');
  step('Hello! is the first step of Today: day (glowing for Starters), weather, how are you; the weekly report shows the feelings');
  await page.close();
}

// Placement quiz from the parent area, then the result card
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(FAKES);
  await page.addInitScript(() => localStorage.getItem('efk.v1') || localStorage.setItem('efk.v1', JSON.stringify({ childName: 'Shin', settings: { dailyLimitMin: 0, rate: 0.8, level: 'L1' }, topics: {}, words: {}, blocks: { inventory: {}, placed: [], totalEarned: 0 }, days: {}, bonus: {}, review: {} })));
  await page.goto(base);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
  await parentArea(page);
  await page.locator('[data-go="placement"]').click();
  // knows the 4–5 and Starters words, not the Movers ones
  let n = 0;
  for (;;) {
    const r = await page.waitForSelector('.pl-round');
    if (await page.locator('.pl-done').count()) break;
    const level = await r.getAttribute('data-level');
    const ans = await r.getAttribute('data-answer');
    const kind = await r.getAttribute('data-kind');
    await page.waitForTimeout(450);
    if (n === 0) await shot(page, 'placement');
    if (kind === 'read' && n < 9) await shot(page, 'placement-read');
    const sel = kind === 'read' ? '.pl-word' : '.pl-card';
    if (level === 'L3') await page.locator(`${sel}:not([data-word="${ans}"])`).first().click();
    else await page.locator(`${sel}[data-word="${ans}"]`).click();
    n++;
    await page.waitForFunction((a) => document.querySelector('.pl-round')?.getAttribute('data-answer') !== a || document.querySelector('.pl-done'), ans);
    if (n > 20) fail('placement too long');
  }
  if (n !== 12) fail('4 + 4 + 4 questions: ' + n);
  if (/wrong|right!/i.test(await spoken(page))) fail('no right/wrong in the quiz');
  await page.locator('.pl-parent').click();
  const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
  for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
  await page.click('.key-ok');
  await page.waitForSelector('.p-placement');
  const text = await page.locator('.p-placement').textContent();
  if (!/Movers/.test(text) || !/Starters: 4\/4/.test(text)) fail('result: Movers, with the scores: ' + text);
  await page.locator('[data-placement="L3"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('efk.v1')).settings.level === 'L3');
  step(`placement: ${n} questions (no right/wrong for the child), result for parents → Movers, one tap to switch`);
  await page.close();
}

// level-up hint after a passed test; Vietnamese meanings for parents
{
  const page = await open('L2', { games: false, state: { tests: [{ day: '2026-11-20', level: 'L2', score: { listening: [5, 5], spelling: [5, 5], reading: [5, 5] } }], words: { 'l2-zoo/elephant': { said: true, tries: 1, firstAt: '2099-01-01', slips: 2, slipAt: '2099-01-01' } }, topics: { 'l2-zoo': { completed: 1, lastDone: '2099-01-01' } } } });
  await parentArea(page);
  await page.waitForSelector('.p-levelup');
  if (!/thi thử/.test(await page.locator('.p-levelup').textContent())) fail('the hint says why');
  await shot(page, 'levelup');
  await page.locator('.p-levelup .p-btn:not(.p-btn-main)').click();
  await page.waitForFunction(() => !document.querySelector('.p-levelup'));
  if (!(await page.locator('.p-vi').first().count())) fail('the word lists show the Vietnamese meaning');
  if (!(await page.locator('.p-vi').allTextContents()).includes('con voi')) fail('elephant = con voi');
  step('parent area: "ready for Movers" after a passed test (can be put off); words show their meaning (elephant = con voi)');
  await page.close();
}

// Little Books: the books of finished sound sets, to read again
{
  const page = await open('L2', { games: false, state: { phonics: { p1: 1, p2: 1 } } });
  await page.locator('.dock-btn[aria-label="ABC"]').click({ force: true });
  await page.locator('.abc-sounds-btn').click({ force: true });
  await page.locator('.ph-books-btn').click({ force: true });
  await page.waitForSelector('.ph-shelf-book');
  await shot(page, 'little-books');
  const open1 = await page.locator('.ph-shelf-book:not(.is-locked)').count();
  const locked = await page.locator('.ph-shelf-book.is-locked').count();
  if (open1 < 2 || !locked) fail(`books of sets 1–2 open, the rest locked: ${open1} open, ${locked} locked`);
  await page.locator('.ph-shelf-book:not(.is-locked)').last().click({ force: true });
  await page.waitForSelector('.ph-read');
  for (let i = 0; i < 40 && !(await page.locator('.ph-done').count()); i++) {
    if (await page.locator('.pbtn-ok').count()) await page.locator('.pbtn-ok').click({ force: true }).catch(() => {});
    else if (await page.locator('.ph-next').count()) await page.locator('.ph-next').click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.waitForSelector('.ph-done');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('efk.v1')).storiesRead || {});
  if (!Object.keys(st).some((k) => k.startsWith('book-p'))) fail('the book counts as read');
  step('Little Books: books of finished sound sets open (others locked), read one to the end, it counts');
  await page.close();
}

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('games3 e2e ok');
