/**
 * Play Together (two players on one device): the menu, each of the 3 modes to its end screen
 * at Starters, pre-readers (L0) and Flyers clues, and the layout on phones and an upright tablet.
 * node tests/e2e/duo.mjs [baseUrl] [shotDir]
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };
const FAKES = readFileSync(new URL('./fakes.js', import.meta.url), 'utf8');
const STATE = (level) => ({ childName: 'Shin', settings: { dailyLimitMin: 0, rate: 0.8, level }, topics: {}, words: {}, blocks: { inventory: {}, placed: [], totalEarned: 0 }, days: {}, bonus: {}, review: {} });

const browser = await chromium.launch();
const errors = [];

async function newPage(viewport, level = 'L2', mobile = false) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(FAKES);
  await page.addInitScript((s) => { if (!localStorage.getItem('efk.v1')) localStorage.setItem('efk.v1', JSON.stringify(s)); }, STATE(level));
  return page;
}
const spoken = (page) => page.evaluate(() => window.__spoken.slice());
const lastSaid = (page) => page.evaluate(() => window.__spoken.at(-1) || '');
async function openDuo(page, mode) {
  await page.goto(base);
  await page.locator('.btn-play').click({ force: true });
  await page.waitForSelector('.home');
  await page.locator('.dock-btn[aria-label="Games"]').click({ force: true });
  await page.waitForSelector('.games');
  await page.locator('.game-pick[data-game="duo"]').click({ force: true });
  await page.waitForSelector('.duo-menu');
  if (mode) {
    await page.locator(`.duo-mode[data-mode="${mode}"]`).click({ force: true });
    await page.waitForSelector('.duo-body');
  }
}
/** Screenshot after the pop-in animations have finished. */
const shot = async (page, name) => { if (!shots) return; await page.waitForTimeout(450); await page.screenshot({ path: `${shots}/${name}.png` }); };
const answer = (page) => page.locator('.duo-stage').getAttribute('data-answer');
const noMissWords = async (page, what) => {
  const all = (await spoken(page)).join(' | ') + ' ' + (await page.locator('#app').innerText());
  if (/\bwrong\b|\bsai\b|\blose\b|\bloser\b|\bwinner\b/i.test(all)) fail(`${what}: no "wrong"/loser language, got: ${all.match(/.{0,30}(wrong|sai|lose|loser|winner).{0,30}/i)[0]}`);
};
async function checkEnd(page, what) {
  await page.waitForSelector('.duo-end', { timeout: 15000 }).catch(() => fail(`${what}: should reach the end screen`));
  if ((await page.locator('.duo-end-title').textContent()) !== 'Great team!') fail(`${what}: end says Great team!`);
  if ((await page.locator('.duo-end-card').count()) !== 2) fail(`${what}: both players on the end screen`);
  const stars = await page.locator('.duo-end-stars b').allTextContents();
  if (stars.some((s) => Number(s) < 1)) fail(`${what}: both players get stars, got ${stars}`);
  if (!(await page.locator('.duo-done button[aria-label="Play again"]').count()) || !(await page.locator('.duo-done button[aria-label="Home"]').count())) fail(`${what}: Again + Home on the end screen`);
  await page.waitForFunction(() => window.__spoken.some((s) => /^Great team! .+ and .+, you both get a star/.test(s)));
  await noMissWords(page, what);
  return stars.map(Number);
}

/** Quick Tap: buzz, pick. `miss` = first round: tap a picture early, then a miss passes the turn. */
async function playTap(page, { miss = false, onRound } = {}) {
  for (let r = 0; r < 40 && !(await page.locator('.duo-end').count()); r++) {
    await page.waitForSelector('.duo-buzz:not([disabled])', { timeout: 8000 }).catch(() => {});
    if (await page.locator('.duo-end').count()) break;
    const target = await answer(page);
    const n = (r % 2) + 1;
    if (miss && r === 0) {
      await page.locator(`.duo-pic[data-word="${target}"]`).click({ force: true });
      await page.waitForTimeout(150);
      if (await page.locator('.duo-pic.is-right').count()) fail('quick tap: a picture before "I know!" does nothing');
      if (!(await spoken(page)).includes('Who knows? Press the bell!')) fail('quick tap: tapping early: Bix says "Who knows? Press the bell!"');
    }
    await page.locator(`.duo-buzz[data-player="${n}"]`).click({ force: true });
    if (!(await page.locator(`.duo-side[data-player="${n}"].is-turn`).count())) fail('quick tap: the buzzer gives that player the turn');
    if ((await page.locator('.duo-buzz:not([disabled])').count())) fail('quick tap: after a buzz the buzzers are locked');
    if (onRound) await onRound(r);
    if (miss && r === 0) {
      await page.locator(`.duo-pic:not([data-word="${target}"])`).first().click({ force: true });
      await page.waitForTimeout(150);
      if (!(await page.locator('.duo-pic.is-faded').count())) fail('quick tap: a missed picture fades');
      if (!(await page.locator('.duo-side[data-player="2"].is-turn').count())) fail('quick tap: a miss passes the turn to the other player');
      if (!/^Try again! Mum's turn!/.test(await lastSaid(page))) fail('quick tap: miss: "Try again! Mum\'s turn!", got ' + (await lastSaid(page)));
    }
    await page.locator(`.duo-pic[data-word="${target}"]`).click({ force: true });
    await page.waitForFunction((t) => document.querySelector('.duo-end') || document.querySelector('.duo-stage')?.dataset.answer !== t || document.querySelector('.duo-buzz:not([disabled])') === null, target);
    await page.waitForFunction(() => document.querySelector('.duo-end') || document.querySelector('.duo-buzz:not([disabled])'), null, { timeout: 8000 }).catch(() => {});
  }
}

/** You Be Bix: hand-over → secret → hand-over → guess, 6 rounds. Returns the hand-over sequence. */
async function playDescribe(page, { miss = false, onPhase } = {}) {
  const hands = [];
  const secrets = [];
  for (let i = 0; i < 80 && !(await page.locator('.duo-end').count()); i++) {
    await page.waitForSelector('.duo-hand, .duo-secret, .duo-pic, .duo-end', { timeout: 8000 });
    if (await page.locator('.duo-hand').count()) {
      const to = await page.locator('.duo-hand').getAttribute('data-to');
      hands.push(Number(to));
      if (await page.locator('.duo-pic, .duo-secret').count()) fail('you be bix: the hand-over screen hides everything');
      if (!/^Pass it to (Shin|Mum)!$/.test(await page.locator('.duo-hand-title').textContent())) fail('you be bix: "Pass it to …!"');
      if (onPhase) await onPhase('hand', hands.length);
      await page.waitForTimeout(400); // let the pop-in finish (the button moves while it grows)
      await page.locator('.duo-ready').click({ force: true });
      await page.waitForFunction(() => !document.querySelector('.duo-hand'));
    } else if (await page.locator('.duo-secret').count()) {
      if (await page.locator('.duo-pic').count()) fail('you be bix: the secret screen shows only the one picture');
      secrets.push({ word: await page.locator('.duo-secret').getAttribute('data-word'), shown: await page.locator('.duo-secret-word').count(), def: await page.locator('.duo-def').count(), describer: hands.at(-1) });
      if (onPhase) await onPhase('secret', secrets.length);
      await page.waitForTimeout(400);
      await page.locator('.duo-got').click({ force: true });
      await page.waitForSelector('.duo-hand');
    } else if (await page.locator('.duo-pic').count()) {
      const target = await answer(page);
      if (target !== secrets.at(-1).word) fail('you be bix: the guess is the secret word');
      if ((await page.locator('.duo-pic').count()) !== 4) fail('you be bix: 4 pictures to guess from');
      if (onPhase) await onPhase('guess', secrets.length);
      if (miss && secrets.length === 1) {
        await page.locator(`.duo-pic:not([data-word="${target}"])`).first().click({ force: true });
        await page.waitForTimeout(150);
        if (!/^Try again! .+, more clues, please!$/.test(await lastSaid(page))) fail('you be bix: a miss asks for more clues, got ' + (await lastSaid(page)));
      }
      await page.locator(`.duo-pic[data-word="${target}"]`).click({ force: true });
      await page.waitForSelector('.duo-hand, .duo-end', { timeout: 8000 });
    }
  }
  return { hands, secrets };
}

/** Say It!: the judge (the other player) presses 👍 or "Again!". Returns the speakers in order. */
async function playSay(page, { again = false, onRound } = {}) {
  const speakers = [];
  for (let r = 0; r < 40 && !(await page.locator('.duo-end').count()); r++) {
    await page.waitForSelector('.duo-say-pic, .duo-end');
    if (await page.locator('.duo-end').count()) break;
    const word = await page.locator('.duo-say-pic').getAttribute('data-word');
    const sp = Number(await page.locator('.duo-turn').getAttribute('data-turn'));
    speakers.push(sp);
    const judge = sp === 1 ? 2 : 1;
    await page.waitForFunction((w) => (window.__spoken.at(-1) || '').endsWith(`say: ${w}!`), word);
    if (!(await page.locator(`.duo-yes[data-player="${judge}"]`).isVisible()) || (await page.locator(`.duo-yes[data-player="${sp}"]`).isVisible())) fail('say it: only the other player judges');
    if (!(await page.locator(`.duo-side[data-player="${sp}"] .duo-say-tag`).isVisible())) fail('say it: the speaker\'s side says "Say it!"');
    if (onRound) await onRound(r, sp);
    await page.waitForTimeout(80);
    if (again && r === 0) {
      await page.locator(`.duo-again[data-player="${judge}"]`).click({ force: true });
      await page.waitForFunction((w) => (window.__spoken.at(-1) || '').startsWith(`Listen! ${w}.`), word);
      await page.waitForTimeout(120);
    }
    const before = await page.locator(`.duo-side[data-player="${sp}"] .duo-score`).getAttribute('data-stars');
    await page.locator(`.duo-yes[data-player="${judge}"]`).click({ force: true });
    await page.waitForFunction(([s, b]) => document.querySelector(`.duo-side[data-player="${s}"] .duo-score`)?.dataset.stars !== b || document.querySelector('.duo-end'), [sp, before]);
    await page.waitForFunction((w) => document.querySelector('.duo-end') || document.querySelector('.duo-say-pic')?.dataset.word !== w || window.__spoken.filter((s) => s.endsWith(`say: ${w}!`)).length > 1, word, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(100);
  }
  return speakers;
}

// ---------- Starters, desktop/tablet landscape ----------
if (!process.env.DUO_VIEW) {
  const page = await newPage({ width: 1280, height: 800 });
  await openDuo(page);
  if ((await page.locator('.duo-mode').count()) !== 3) fail('Play Together offers 3 modes');
  if ((await page.locator('.duo-p1-card .duo-name').textContent()) !== 'Shin') fail('player 1 is the child');
  if ((await page.locator('.duo-p1-card .duo-avatar').textContent()) !== '🦊') fail('player 1 has the profile animal');
  await shot(page, `duo-menu-1280`);
  await page.locator('.duo-p2-pick[data-p2="dad"]').click({ force: true });
  if (!(await page.locator('.duo-p2-pick[data-p2="dad"].is-on').count())) fail('player 2 can be Dad');
  if ((await page.evaluate(() => localStorage.getItem('efk.duo.p2'))) !== 'dad') fail('player 2 is remembered');
  await page.locator('.duo-p2-pick[data-p2="mum"]').click({ force: true });
  step('Games → 🧒👩 Play Together: 3 modes, Shin 🦊 + Mum/Dad/Friend (remembered)');

  // Quick Tap
  await page.locator('.duo-mode[data-mode="tap"]').click({ force: true });
  await page.waitForSelector('.duo-pic');
  if ((await page.locator('.duo-pic').count()) !== 4) fail('quick tap: 4 pictures');
  if ((await page.locator('.duo-buzz').count()) !== 2) fail('quick tap: a buzzer on each side');
  await page.waitForFunction(() => /[?!]$/.test(window.__spoken.at(-1) || '') && !/^Find the (happy|sad|big|small)/.test(window.__spoken.at(-1)));
  await playTap(page, { miss: true, onRound: async (r) => { if (r === 1) await shot(page, `duo-tap-1280`); } });
  const tapStars = await checkEnd(page, 'quick tap');
  if (tapStars[0] + tapStars[1] !== 6 + 2) fail(`quick tap: 6 stars + a team star each, got ${tapStars}`);
  await shot(page, `duo-end-1280`);
  step('quick tap: the unit\'s question ("Where is the …?"), early tap → "Who knows? Press the bell!", buzz → pick, a miss passes the turn, 6 rounds → Great team!');

  // Again restarts the same mode
  await page.locator('.duo-done button[aria-label="Play again"]').click({ force: true });
  await page.waitForSelector('.duo-tap .duo-pic');
  step('end: Again replays the same mode');

  // You Be Bix
  await openDuo(page, 'describe');
  const { hands, secrets } = await playDescribe(page, {
    miss: true,
    onPhase: async (ph, n) => { if (n === 1) await shot(page, `duo-describe-${ph}-1280`); },
  });
  if (hands.join('') !== '122112211221'.slice(0, hands.length) || hands.length !== 12) fail(`you be bix: describer/guesser hand-overs alternate, got ${hands.join('')}`);
  if (secrets.length !== 6) fail('you be bix: 6 rounds');
  if (secrets.some((s) => !s.shown)) fail('you be bix: Starters readers see the word');
  const dStars = await checkEnd(page, 'you be bix');
  if (dStars[0] !== 7 || dStars[1] !== 7) fail(`you be bix: a star for both each round (+ team star), got ${dStars}`);
  step('you be bix: hand-over screen, only the describer sees the secret, guess from 4, turns alternate, a star for both');

  // Say It!
  await openDuo(page, 'say');
  const speakers = await playSay(page, { again: true, onRound: async (r) => { if (r === 0) await shot(page, `duo-say-1280`); } });
  if (speakers.join('') !== '121212') fail(`say it: speakers alternate, 6 rounds, got ${speakers.join('')}`);
  const sStars = await checkEnd(page, 'say it');
  if (sStars[0] !== 4 || sStars[1] !== 4) fail(`say it: 3 thumbs up each (+ team star), got ${sStars}`);
  step('say it: Bix says the word, the other player judges 👍 / Again!, 3 turns each');

  // Leaving mid-game is clean.
  await openDuo(page, 'tap');
  await page.locator('.duo-back').click({ force: true });
  await page.waitForSelector('.duo-menu');
  await page.locator('.btn-home').first().click({ force: true });
  await page.waitForSelector('.home');
  step('leaving mid-game: back to Play Together, Home');
  await page.context().close();
}

// ---------- pre-readers (L0): pictures only for the child, the word only for the parent ----------
if (!process.env.DUO_VIEW) {
  const page = await newPage({ width: 1280, height: 800 }, 'L0');
  await openDuo(page, 'say');
  const seen = {};
  await playSay(page, { onRound: async (r, sp) => { seen[sp] = (await page.locator('.duo-say-pic .duo-secret-word').count()) > 0; } });
  if (seen[1] || !seen[2]) fail(`L0 say it: no written word for the child, the word for the parent, got ${JSON.stringify(seen)}`);
  await checkEnd(page, 'L0 say it');
  await openDuo(page, 'describe');
  const { secrets } = await playDescribe(page);
  if (secrets.some((s) => (s.describer === 1) === !!s.shown)) fail('L0 you be bix: the child describer sees only the picture, the parent sees the word');
  if (await page.locator('.duo-starters').count()) fail('L0: no written sentence starters');
  await checkEnd(page, 'L0 you be bix');
  await openDuo(page, 'tap');
  await playTap(page);
  await checkEnd(page, 'L0 quick tap');
  step('L0 pre-readers: all 3 modes, pictures only for the child, the word only for the parent');
  await page.context().close();
}

// ---------- Flyers: a definition to help the parent give clues ----------
if (!process.env.DUO_VIEW) {
  const page = await newPage({ width: 1280, height: 800 }, 'L4');
  await openDuo(page, 'describe');
  const { secrets } = await playDescribe(page, { onPhase: async (ph, n) => { if (ph === 'secret' && n === 2) await shot(page, `duo-describe-flyers-1280`); } });
  if (secrets.some((s) => !s.def)) fail('Flyers you be bix: every secret word comes with its definition');
  await checkEnd(page, 'Flyers you be bix');
  step('Flyers you be bix: the word\'s definition as a clue helper');
  await page.context().close();
}

// ---------- phones and an upright tablet: nothing cut off ----------
const VIEWS = [
  ['phone-640x320', { width: 640, height: 320 }],
  ['phone-740x360', { width: 740, height: 360 }],
  ['tablet-800x1280', { width: 800, height: 1280 }],
  ['tablet-1280x800', { width: 1280, height: 800 }],
];
const report = [];
const ONLY = process.env.DUO_VIEW; // e.g. DUO_VIEW=tablet-800x1280 to check one size
for (const [vn, vp] of VIEWS.filter((v) => !ONLY || v[0] === ONLY)) {
  for (const level of ['L2', 'L4']) {
    const page = await newPage(vp, level, vn.startsWith('phone'));
    const check = async (name) => {
      await page.waitForTimeout(450);
      const r = await page.evaluate(() => {
        const W = innerWidth, H = innerHeight;
        const bad = [];
        const clipped = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(o.overflowX + o.overflowY) && a !== document.body && a !== document.documentElement && a.id !== 'app') return a; } return null; };
        for (const el of document.querySelectorAll('#app button, #app h1, #app h2, #app .duo-turn, #app .duo-score, #app .duo-name, #app .duo-hand p, #app .duo-secret p, #app .duo-starters, #app .duo-vi, #app .duo-end-card')) {
          const rc = el.getBoundingClientRect();
          if (!rc.width || getComputedStyle(el).visibility === 'hidden') continue;
          const box = clipped(el);
          const lim = box ? box.getBoundingClientRect() : { left: 0, right: W, top: 0, bottom: H };
          if (box && /(auto|scroll)/.test(getComputedStyle(box).overflowX + getComputedStyle(box).overflowY)) continue;
          const label = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" [${Math.round(rc.left)},${Math.round(rc.top)} ${Math.round(rc.width)}x${Math.round(rc.height)}]`;
          if (rc.right > lim.right + 2 || rc.left < lim.left - 2 || rc.bottom > Math.min(lim.bottom, H) + 2 || rc.top < -2) bad.push(label);
          else if (el.tagName === 'BUTTON' && (rc.height < 63 || rc.width < 63) && !el.closest('.duo-pic')) bad.push('small ' + label);
        }
        // text overflowing its own box (ellipsis is fine for names)
        for (const el of document.querySelectorAll('#app .duo-hand-title, #app .duo-def, #app .duo-mode-vi, #app .btn')) if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow === 'visible' && el.clientWidth) bad.push(`overflow ${el.className.split(' ')[0]} "${el.textContent.trim().slice(0, 20)}"`);
        const de = document.scrollingElement;
        return { hScroll: de.scrollWidth > W + 1 ? de.scrollWidth : 0, vScroll: de.scrollHeight > H + 1 ? de.scrollHeight : 0, bad: bad.slice(0, 12) };
      });
      report.push(`${vn} ${level} ${name}: ${r.hScroll ? 'H-OVERFLOW ' + r.hScroll + ' ' : ''}${r.vScroll ? 'page-v ' + r.vScroll + ' ' : ''}${r.bad.length ? '\n   ' + r.bad.join('\n   ') : 'ok'}`);
      if (shots && (level === 'L2' || /secret/.test(name))) await page.screenshot({ path: `${shots}/${vn}-${level}-duo-${name}.png` });
    };
    try {
      await openDuo(page);
      await check('menu');
      await page.locator('.duo-back, .book-top .btn-sun').first().click({ force: true }); await page.waitForSelector('.games'); await check('games');
      await page.locator('.game-pick[data-game="duo"]').click({ force: true }); await page.waitForSelector('.duo-menu');
      await page.locator('.duo-mode[data-mode="tap"]').click({ force: true }); await page.waitForSelector('.duo-pic');
      await check('tap');
      await playTap(page, { onRound: async (r) => { if (r === 0) await check('tap-buzzed'); } });
      await check('end');
      await openDuo(page, 'describe');
      await playDescribe(page, { onPhase: async (ph, n) => { if (n === 1 || (ph === 'secret' && n === 2)) await check(`describe-${ph}${n > 1 ? n : ''}`); } });
      await openDuo(page, 'say');
      await playSay(page, { onRound: async (r) => { if (r < 2) await check(`say${r + 1}`); } });
    } catch (e) { report.push(`${vn} ${level} FAILED at: ${e.message.split('\n')[0]} ${(e.stack || '').split('\n').find((l) => l.includes('duo.mjs')) || ''}`); if (shots) await page.screenshot({ path: `${shots}/${vn}-${level}-duo-FAIL.png` }); }
    await page.context().close();
  }
}
await browser.close();
const problems = report.filter((r) => !r.endsWith('ok'));
if (problems.length) {
  console.log(problems.join('\n'));
  fail(`${problems.length} layout problem(s) in Play Together`);
}
step(`layout: ${VIEWS.map((v) => v[0]).join(', ')} × every Play Together screen (Starters + Flyers): nothing cut off, buttons ≥ 64px`);
if (errors.length) fail('page errors: ' + errors.join('; '));
console.log('Play Together: all checks passed');
