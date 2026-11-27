/** Printable worksheets + level certificates. node tests/e2e/worksheet.mjs [baseUrl] [shotDir] */
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const shots = process.argv[3];
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };

// Unit ids per level, straight from the content files.
const unitsDir = new URL('../../content/units/', import.meta.url);
const units = readdirSync(unitsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, unitsDir), 'utf8')));
const ofLevel = (lv) => units.filter((u) => u.level === lv).map((u) => u.id);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
await page.goto(base);
// Su finished every Movers and Flyers unit; the last Starters unit she did is the zoo.
await page.evaluate(({ done }) => {
  const topics = {};
  for (const id of done) topics[id] = { completed: 1, lastDone: '2026-11-20' };
  topics['animals'] = { completed: 1, lastDone: '2026-11-21' };
  topics['l2-zoo'] = { completed: 1, lastDone: '2026-11-24' };
  localStorage.setItem('efk.v1', JSON.stringify({ childName: 'Su', topics, words: {}, days: {}, blocks: { inventory: {}, placed: [], totalEarned: 0 } }));
}, { done: [...ofLevel('L3'), ...ofLevel('L4')] });
await page.reload();
await page.click('.btn-play', { force: true });
await page.waitForSelector('.home');

async function unlock() {
  await page.waitForSelector('.gate, .p-wrap');
  if (await page.locator('.p-wrap').count()) return;
  const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
  for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
  await page.click('.key-ok');
  await page.waitForSelector('.p-wrap');
}
await page.click('.btn-parent');
await unlock();

// ---- the card in the parent area
const card = page.locator('.p-card', { has: page.locator('h2:text-is("Phiếu bài tập in")') });
if (!(await card.count())) fail('worksheet card in the parent area');
if ((await page.locator('.p-ws-level').inputValue()) !== 'L2') fail('level defaults to the child level (Starters)');
if ((await page.locator('.p-ws-unit').inputValue()) !== 'l2-zoo') fail('unit defaults to the most recently studied one: ' + (await page.locator('.p-ws-unit').inputValue()));
step('parent area: "Phiếu bài tập in" card, defaults to Starters + the last unit studied (Zoo)');

async function openSheet(level, unit) {
  if (!(await page.locator('.p-wrap').count())) {
    await page.locator('.ws-back').click();
    await page.waitForSelector('.p-wrap');
    if (await page.locator('.gate').count()) fail('back from the worksheet should not ask the maths question again');
  }
  await page.selectOption('.p-ws-level', level);
  await page.selectOption('.p-ws-unit', unit);
  await page.click('[data-ws="open"]');
  await page.waitForSelector('.ws-sheet');
  return page.locator('.ws-sec').evaluateAll((els) => els.map((e) => e.dataset.kind));
}
/** Pages and size when printed on A4 (CSS page size honoured). */
async function pdfPages(file) {
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
  if (file) writeFileSync(file, pdf);
  const s = pdf.toString('latin1');
  const n = (s.match(/\/Type\s*\/Page(?![a-z])/g) || []).length;
  const box = s.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  return { n, portrait: !!box && Number(box[1]) < Number(box[2]) };
}
const childText = () => page.locator('.ws-sheet:not(.ws-key)').innerText();
const noScold = async () => {
  const t = (await childText()).toLowerCase();
  if (/\bwrong\b|\bsai\b/.test(t)) fail('the child page must not say wrong/sai');
};

// ---- Starters
let kinds = await openSheet('L2', 'l2-zoo');
for (const k of ['match', 'trace', 'write', 'search']) if (!kinds.includes(k)) fail(`Starters sheet should have "${k}": ${kinds}`);
const head = await page.locator('.ws-head').innerText();
if (!head.includes('Zoo Animals') || !head.includes('Thú ở sở thú') || !head.includes('Name:') || !head.includes('Date:') || !head.includes('Bix English')) fail('header: ' + head);
if ((await page.locator('.ws-sec-match .ws-match-row').count()) < 4) fail('match rows');
if ((await page.locator('.ws-sec-search .ws-grid span').count()) !== 64) fail('8×8 word search');
if (!/^[A-Z]{64}$/.test((await page.locator('.ws-sec-search .ws-grid').innerText()).replace(/\s/g, ''))) fail('word search letters A–Z');
if ((await page.locator('.ws-sec-write .ws-box.is-given').count()) !== (await page.locator('.ws-sec-write .ws-write-item').count())) fail('Starters: the first letter of each word is given');
if (!(await page.locator('.ws-key').innerText()).includes('Đáp án cho bố mẹ')) fail('answer key');
if ((await page.locator('.ws-key .ws-grid-key .is-hit').count()) < 10) fail('word search solution in the key');
await noScold();
const grid1 = await page.locator('.ws-sec-search .ws-grid').innerText();
if (shots) await page.screenshot({ path: `${shots}/worksheet-starters.png`, fullPage: true });
let pdf = await pdfPages(shots && `${shots}/worksheet-starters.pdf`);
if (pdf.n < 2 || pdf.n > 3 || !pdf.portrait) fail(`Starters sheet prints on 2–3 A4 portrait pages (got ${pdf.n}, portrait ${pdf.portrait})`);
step(`Starters "Zoo Animals": ${kinds.join(', ')} + answer key · ${pdf.n} A4 portrait pages`);

await page.evaluate(() => (window.print = () => (window.__printed = true)));
await page.locator('.ws-print').click();
if (!(await page.evaluate(() => window.__printed))) fail('print button');
await openSheet('L2', 'l2-zoo');
if ((await page.locator('.ws-sec-search .ws-grid').innerText()) !== grid1) fail('same unit, same day → same sheet');
step('🖨️ In phiếu calls window.print; reopening the same unit today gives the same sheet');

// ---- Flyers
kinds = await openSheet('L4', 'l4-space');
for (const k of ['write', 'gaps', 'define', 'text']) if (!kinds.includes(k)) fail(`Flyers sheet should have "${k}": ${kinds}`);
if (await page.locator('.ws-sec-write .ws-box.is-given').count()) fail('Flyers: no letters given');
if (!(await page.locator('.ws-sec-text').innerText()).includes('A Trip to the Moon')) fail('reading text');
if ((await page.locator('.ws-sec-gaps .ws-blank').count()) < 2) fail('gap sentences');
const key = await page.locator('.ws-key').innerText();
if (!key.includes('in a rocket') || !key.toLowerCase().includes('rocket')) fail('Flyers key: ' + key);
await noScold();
if (shots) await page.screenshot({ path: `${shots}/worksheet-flyers.png`, fullPage: true });
pdf = await pdfPages(shots && `${shots}/worksheet-flyers.pdf`);
if (pdf.n > 3 || !pdf.portrait) fail(`Flyers sheet ≤ 3 A4 portrait pages (got ${pdf.n})`);
step(`Flyers "Into Space": ${kinds.join(', ')} · ${pdf.n} pages`);

// ---- Movers
kinds = await openSheet('L3', 'l3-health');
for (const k of ['write', 'text']) if (!kinds.includes(k)) fail(`Movers sheet should have "${k}": ${kinds}`);
pdf = await pdfPages();
if (pdf.n > 3) fail(`Movers sheet ≤ 3 pages (got ${pdf.n})`);
step(`Movers "What's the Matter?": ${kinds.join(', ')} · ${pdf.n} pages`);

// ---- pre-readers
kinds = await openSheet('L0', 'l0-animals');
if (kinds.join() !== 'colour,same,circle') fail('Little Bix sheet: ' + kinds);
if (!(await page.locator('.ws-key').innerText()).includes('Number 1. ')) fail('the key tells the parent what to read aloud');
if (shots) await page.screenshot({ path: `${shots}/worksheet-l0.png`, fullPage: true });
pdf = await pdfPages(shots && `${shots}/worksheet-l0.pdf`);
if (pdf.n > 3) fail(`Little Bix sheet ≤ 3 pages (got ${pdf.n})`);
step(`Little Bix "${units.find((u) => u.id === 'l0-animals').title}": colour, same pictures, listen and circle · ${pdf.n} pages`);

// ---- every unit fits on at most 3 A4 pages
let worst = { n: 0, id: '' };
for (const u of units) {
  await openSheet(u.level, u.id);
  const { n } = await pdfPages();
  if (n > worst.n) worst = { n, id: u.id };
  if (n > 3) fail(`${u.id} prints on ${n} pages`);
}
step(`all ${units.length} units print on ≤ 3 A4 pages (most: ${worst.n}, ${worst.id})`);

// ---- certificates for Movers and Flyers
await page.locator('.ws-back').click();
await page.waitForSelector('.p-wrap');
for (const [lv, name] of [['L3', 'Movers'], ['L4', 'Flyers']]) {
  if (!(await page.locator('.p-wrap').count())) {
    await page.click('.btn-parent').catch(() => {});
    await unlock();
  }
  const btn = page.locator(`button[data-level="${lv}"]`);
  if (!(await btn.count())) fail(`parent area lists the ${name} certificate`);
  await btn.click();
  await page.waitForSelector('.cert');
  const t = await page.locator('.cert').innerText();
  if (!t.includes(`Bix English · ${name}`) || !t.includes('Su')) fail(`${name} certificate: ${t}`);
  if ((await page.locator('.cert').getAttribute('data-level')) !== lv) fail('level colours');
  if (shots) await page.screenshot({ path: `${shots}/certificate-${lv}.png` });
  step(`${name} certificate: level name, "Su", own colours`);
  await page.locator('.cert-actions .btn-home').click();
  await page.waitForSelector('.gate, .p-wrap');
  await unlock();
}
if (await page.locator('button[data-level="L2"]').count()) fail('Starters is not finished: no certificate yet');
step('Starters (not finished) has no certificate button yet');

// word cards and family bingo for the chosen unit
await page.waitForSelector('.p-wrap');
await page.locator('[data-ws="cards"]').click();
await page.waitForSelector('.pc-card');
const nCards = await page.locator('.pc-card').count();
if (nCards < 4) fail('word cards for the unit: ' + nCards);
await page.locator('.ws-back').click();
await page.waitForSelector('.p-wrap');
if (await page.locator('.gate').count()) fail('back from the cards should not ask again');
await page.locator('[data-ws="bingo"]').click();
await page.waitForSelector('.bg-board');
const boards = await page.$$eval('.bg-board', (bs) => bs.map((b) => [...b.querySelectorAll('.bg-cell')].map((c) => c.dataset.word).join(',')));
if (boards.length !== 4 || boards.some((b) => b.split(',').length !== 9)) fail('4 boards of 9');
if (new Set(boards.map((b) => b.split(',').sort().join())).size < 2) fail('the boards hold different words');
step(`word cards (${nCards}) and 4 different bingo boards with a caller list`);
await page.locator('.ws-back').click();

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('worksheet e2e ok');
