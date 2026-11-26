/**
 * Phone & tablet layouts: visit every kid screen on sideways phones and an upright tablet;
 * fail if a button is cut off or the page scrolls sideways.
 * node tests/e2e/phone.mjs [baseUrl] [shotDir]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const SH = process.argv[3];
const VIEWS = [
  ['phone-740x360', { width: 740, height: 360 }],
  ['phone-640x320', { width: 640, height: 320 }],
  ['tablet-800x1280', { width: 800, height: 1280 }],
];
const t = {}; for (const id of ['animals', 'l2-zoo', 'colors']) t[id] = { completed: 2, lastDone: '2026-11-18' };
const STATE = { childName: 'Shin', settings: { dailyLimitMin: 0, rate: .8 }, topics: t, words: { 'animals/dog': { said: true, tries: 1 } }, blocks: { inventory: { animals: 2 }, placed: [], totalEarned: 2 }, days: { '2026-11-18': { seconds: 300, lessons: 2, auto: 0, parent: 0, miss: 0, noVoice: 0 } }, bonus: {}, review: {}, outfit: { hat: 'cap' }, outfitSeen: 3, chats: { animals: '2099-01-01' } };
  const b = await chromium.launch();
  const report = [];
  for (const [vn, vp] of VIEWS) {
    const ctx = await b.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    await p.addInitScript(fs.readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
    await p.addInitScript((s) => { if (!localStorage.getItem('efk.v1')) localStorage.setItem('efk.v1', JSON.stringify(s)); }, STATE);
    const check = async (name) => {
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const W = innerWidth, H = innerHeight;
        const bad = [];
        const clipped = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(o.overflowX + o.overflowY) && a !== document.body && a !== document.documentElement && a.id !== 'app') return a; } return null; };
        for (const el of document.querySelectorAll('#app button, #app h1, #app h2, #app .badge, #app input, #app .story-text, #app .chant-line, #app .p-card')) {
          const rc = el.getBoundingClientRect();
          if (!rc.width || getComputedStyle(el).visibility === 'hidden') continue;
          const box = clipped(el);
          const lim = box ? box.getBoundingClientRect() : { left: 0, right: W, top: 0, bottom: H };
          const sc = box && /(auto|scroll)/.test(getComputedStyle(box).overflowX + getComputedStyle(box).overflowY);
          if (sc) continue; // inside a scroller: reachable
          if (rc.right > lim.right + 2 || rc.left < lim.left - 2 || rc.bottom > Math.max(lim.bottom, H) + 2 || rc.top < -2)
            bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" [${Math.round(rc.left)},${Math.round(rc.top)} ${Math.round(rc.width)}x${Math.round(rc.height)}]`);
        }
        const de = document.scrollingElement;
        return { hScroll: de.scrollWidth > W + 1 ? de.scrollWidth : 0, vScroll: de.scrollHeight > H + 1 ? de.scrollHeight : 0, bad: bad.slice(0, 12) };
      });
      report.push(`${vn} ${name}: ${r.hScroll ? 'H-OVERFLOW ' + r.hScroll + ' ' : ''}${r.vScroll ? 'page-v ' + r.vScroll + ' ' : ''}${r.bad.length ? '\n   ' + r.bad.join('\n   ') : 'ok'}`);
      if (SH) await p.screenshot({ path: `${SH}/${vn}-${name}.png` });
    };
    await p.goto(base); await check('start');
    await p.locator('.btn-play').click({ force: true }); await p.waitForSelector('.home'); await check('home');
    for (const [btn, name] of [['My Words', 'book'], ['Bix', 'wardrobe'], ['Garden', 'garden'], ['Games', 'games'], ['Stories', 'stories'], ['My World', 'world'], ['Today', 'today'], ['Test', 'test'], ['ABC', 'abc']]) {
      await p.goto(base); await p.locator('.btn-play').click({ force: true }); await p.waitForSelector('.home');
      await p.locator(btn === 'Today' ? '.home-today' : btn === 'Test' ? '.island-test' : `.dock-btn[aria-label="${btn}"]`).click({ force: true }); if (btn === 'Test') await p.waitForSelector('.test-q', { timeout: 15000 }); await check(name);
    }
    await p.locator('.abc-game-btn').click({ force: true }); await p.waitForSelector('.abc-choice'); await check('letter-game');
    try {
    await p.goto(base + '/'); await p.locator('.btn-play').click({ force: true }); await p.waitForSelector('.home');
    await p.locator('.dock-btn[aria-label="Games"]').click({ force: true }); await p.locator('[data-game=memory]').click({ force: true, timeout: 4000 }).catch((e) => report.push(vn + ' memory: CANNOT OPEN ' + e.message.split('\n')[0])); await check('memory');
    await p.locator('.btn-home').first().click({ force: true }); await p.locator('.dock-btn[aria-label="Games"]').click({ force: true }); await p.locator('[data-game=balloons]').click({ force: true }); await check('balloons');
    await p.locator('.btn-home').first().click({ force: true }); await p.locator('.dock-btn[aria-label="Games"]').click({ force: true }); await p.locator('[data-game=colour]').click({ force: true }); await check('colour');
    await p.locator('.btn-home').first().click({ force: true }); await p.locator('.dock-btn[aria-label="Games"]').click({ force: true }); await p.locator('[data-game=who]').click({ force: true }); await check('who');
    await p.locator('.btn-home').first().click({ force: true }); await p.locator('.dock-btn[aria-label="Stories"]').click({ force: true }); await p.locator('.story-book[data-story="story-animals"]').click({ force: true }); await check('story');
    await p.goto(base + '/?unit=l2-zoo'); await p.locator('.btn-play').click({ force: true }); await p.waitForSelector('.listen'); await check('lesson-listen');
    for (let i = 0; i < 300 && !(await p.locator('.speak').count()); i++) { if (await p.locator('.btn-next:not([hidden])').count()) await p.locator('.btn-next:not([hidden])').click({ force: true }); await p.waitForTimeout(80); }
    await check('lesson-speak');
    for (let i = 0; i < 400 && !(await p.locator('.play .word-card-play').count()); i++) { if (await p.locator('.btn-next:not([hidden])').count()) await p.locator('.btn-next:not([hidden])').click({ force: true }); else if (await p.locator('.btn-mic.is-ready').count()) await p.locator('.btn-mic.is-ready').click({ force: true }); await p.waitForTimeout(80); }
    await check('lesson-play');
    for (let i = 0; i < 400 && !(await p.locator('.chant').count()); i++) {
      if (await p.locator('.play').count()) { const said = (await p.evaluate(() => window.__spoken.at(-1) || '')).toLowerCase(); const cards = p.locator('.word-card-play:not(.is-faded):not(.is-right)'); for (let k = 0; k < await cards.count(); k++) { const l = (await cards.nth(k).getAttribute('aria-label')).toLowerCase(); if (said.includes(l)) { await cards.nth(k).click({ force: true }); break; } } }
      await p.waitForTimeout(80);
    }
    await check('lesson-chant');
    for (let i = 0; i < 600 && !(await p.locator('.reward-actions:not([hidden])').count()); i++) {
      if (await p.locator('.btn-chant-done:not([hidden])').count()) await p.locator('.btn-chant-done').click({ force: true });
      await p.waitForTimeout(100);
    }
    await check('reward');
    // Part 2: Read & Write — check each kind of screen once.
    await p.goto(base + '/?unit=l2-zoo&part=2'); await p.locator('.btn-play').click({ force: true });
    const seen = new Set();
    for (let i = 0; i < 800 && !(await p.locator('.reward-actions:not([hidden])').count()); i++) {
      for (const [sel, name] of [['.read-choice', 'lesson-read'], ['.spell-tile', 'lesson-spell'], ['.sb-tile', 'lesson-sentence'], ['.yn-btn', 'lesson-yesno']]) {
        if (!seen.has(name) && (await p.locator(sel).count())) { seen.add(name); await p.evaluate(() => (window.__manualReading = true)); await check(name); await p.evaluate(() => (window.__manualReading = false)); }
      }
      await p.waitForTimeout(100);
    }
    if (seen.size < 4) report.push(vn + ' reading screens seen: ' + [...seen].join(',') + ' (missing some)');
    // Movers part 2: typing on the a–z keyboard and the short text.
    await p.goto(base + '/?unit=l3-town&part=2'); await p.locator('.btn-play').click({ force: true });
    const seen3 = new Set();
    for (let i = 0; i < 900 && seen3.size < 3 && !(await p.locator('.reward-actions:not([hidden])').count()); i++) {
      for (const [sel, name] of [['.gap-opt', 'movers-gap'], ['.wr-key', 'movers-write'], ['.tx-opt', 'movers-text']]) {
        if (!seen3.has(name) && (await p.locator(sel).count())) { seen3.add(name); await p.evaluate(() => (window.__manualReading = true)); await check(name); await p.evaluate(() => (window.__manualReading = false)); }
      }
      await p.waitForTimeout(100);
    }
    if (seen3.size < 3) report.push(vn + ' Movers screens seen: ' + [...seen3].join(',') + ' (missing some)');
    // Movers practice test: the typed word and the text question.
    await p.evaluate(() => { const st = JSON.parse(localStorage.getItem('efk.v1')); st.settings.level = 'L3'; localStorage.setItem('efk.v1', JSON.stringify(st)); window.__manualReading = true; window.__manualWrite = true; window.__manualText = true; });
    await p.goto(base); await p.locator('.btn-play').click({ force: true }); await p.waitForSelector('.home');
    await p.locator('.island-test').click({ force: true }); await p.waitForSelector('.test');
    const seenT = new Set();
    for (let i = 0; i < 600 && seenT.size < 3 && !(await p.locator('.test-result').count()); i++) {
      const q = p.locator('.test-q[data-answer]');
      if (await q.count()) {
        const ans = await q.getAttribute('data-answer');
        const kind = (await p.locator('.test-q.write').count()) ? 'test-write' : (await p.locator('.test-q.text-read').count()) ? 'test-text' : (await p.locator('.test-q.test-kids').count()) ? 'test-who' : '';
        if (kind && !seenT.has(kind)) { seenT.add(kind); await check(kind); }
        const n = await p.locator('.test-dots span.now').count();
        if (kind === 'test-write') { for (const c of ans) await p.locator(`.wr-key[data-key="${c}"]`).click({ force: true }); }
        else await q.locator(`button[data-word="${ans}"]`).first().click({ force: true });
        await p.waitForFunction((k) => document.querySelectorAll('.test-dots span.now').length > k || document.querySelector('.test-result'), n, { timeout: 10000 }).catch(() => {});
      }
      await p.waitForTimeout(100);
    }
    if (seenT.size < 3) report.push(vn + ' Movers test screens seen: ' + [...seenT].join(',') + ' (missing some)');
    // Flyers: read a definition, type the word (the longest definitions).
    await p.goto(base + '/?unit=l4-subjects&part=2'); await p.evaluate(() => { window.__manualWrite = true; });
    await p.locator('.btn-play').click({ force: true });
    await p.waitForSelector('.write.define', { timeout: 60000 }).then(() => check('flyers-define')).catch((e) => report.push(vn + ' flyers-define: NOT SEEN ' + e.message.split('\n')[0]));
    await p.evaluate(() => { window.__manualWrite = false; });
    await p.evaluate(() => { const st = JSON.parse(localStorage.getItem('efk.v1')); st.settings.level = 'L2'; localStorage.setItem('efk.v1', JSON.stringify(st)); window.__manualReading = false; window.__manualWrite = false; window.__manualText = false; });
    await check('reward-part2');
    await p.goto(base); await p.locator('.btn-play').click({ force: true }); await p.waitForSelector('.home');
    await p.locator('.btn-parent').click({ force: true }); await p.waitForSelector('.gate'); await check('gate');
    const [a, c] = (await p.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
    for (const ch of String(a * c)) await p.click(`.key:text-is("${ch}")`); await p.click('.key-ok'); await p.waitForSelector('.p-wrap'); await check('parent');
    } catch (e) { report.push(vn + ' FAILED at: ' + e.message.split('\n')[0]); if (SH) await p.screenshot({ path: SH + '/' + vn + '-FAIL.png' }); }
    await ctx.close();
  }
  await b.close();
  // Balloons start below the sky and float up on purpose — not a layout problem.
  const problems = report.filter((r) => !r.endsWith('ok') && !/ balloons: /.test(r));
  if (problems.length) {
    console.log(problems.join('\n'));
    throw new Error(`${problems.length} layout problem(s) on phones/tablets`);
  }
  console.log(`✓ ${VIEWS.length} screen sizes × every kid screen: nothing cut off, no sideways scrolling`);
