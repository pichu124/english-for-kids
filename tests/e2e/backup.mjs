/** Backup & restore in the parent area. node tests/e2e/backup.mjs [baseUrl] */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));

// Two children with some progress, no backup yet.
await page.goto(base);
await page.evaluate(() => {
  const kid = (name, topics) => ({ childName: name, settings: { dailyLimitMin: 0, rate: 0.8 }, topics, words: { 'animals/dog': { said: true, tries: 1 } }, blocks: { inventory: { animals: 1 }, placed: [], totalEarned: 1 }, days: {}, bonus: {}, review: {}, outfit: { hat: 'cap' } });
  localStorage.setItem('efk.v1', JSON.stringify(kid('Shin', { animals: { completed: 3, lastDone: '2026-11-20' } })));
  localStorage.setItem('efk.v1.p2', JSON.stringify(kid('Mia', { colors: { completed: 1, lastDone: '2026-11-21' } })));
  localStorage.setItem('efk.profiles', JSON.stringify({ active: 'p1', ids: ['p1', 'p2'] }));
  localStorage.removeItem('efk.backup');
});
const openParent = async () => {
  await page.goto(base);
  await page.locator('.who-btn[data-profile="p1"]').click({ force: true });
  await page.waitForSelector('.home');
  await page.locator('.btn-parent').click({ force: true });
  await page.waitForSelector('.gate');
  const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
  for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
  await page.click('.key-ok');
  await page.waitForSelector('.p-wrap');
};
await openParent();
if (!(await page.locator('.p-notice').count())) fail('progress and no backup → reminder at the top');
step('no backup yet → a reminder at the top of the parent area');

// Download
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-backup="download"]').click()]);
if (!/^bix-english-sao-luu-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename())) fail('file name: ' + dl.suggestedFilename());
const dir = mkdtempSync(join(tmpdir(), 'bix-'));
const file = join(dir, dl.suggestedFilename());
await dl.saveAs(file);
const data = JSON.parse(readFileSync(file, 'utf8'));
if (data.app !== 'bix-english' || data.index.ids.join() !== 'p1,p2' || data.profiles.p2.childName !== 'Mia' || data.profiles.p1.topics.animals.completed !== 3) fail('backup content: ' + JSON.stringify(data).slice(0, 200));
if (await page.locator('.p-notice').count()) fail('reminder should go after a backup');
if (!(await page.locator('.p-backup-status').textContent()).includes('Lần sao lưu gần nhất')) fail('last backup date shown');
step('download: one file with both children (Shin, Mia), reminder gone, date shown');

// Wipe everything (new phone), then restore.
await page.evaluate(() => localStorage.clear());
await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
await page.locator('.btn-parent').click({ force: true });
await page.waitForSelector('.gate');
{
  const [a, b] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
  for (const ch of String(a * b)) await page.click(`.key:text-is("${ch}")`);
  await page.click('.key-ok');
  await page.waitForSelector('.p-wrap');
}
// a wrong file is refused
const bad = join(dir, 'bad.json');
writeFileSync(bad, JSON.stringify({ hello: 1 }));
await page.locator('.p-file').setInputFiles(bad);
await page.waitForSelector('.p-error');
if (!(await page.locator('.p-error').textContent()).includes('không phải file sao lưu')) fail('wrong file should be refused clearly');
await page.locator('.p-file').setInputFiles(file);
await page.waitForSelector('[data-backup="confirm"]');
const preview = await page.locator('.p-restore').textContent();
if (!preview.includes('Shin') || !preview.includes('Mia')) fail('preview should name the children: ' + preview);
await page.locator('[data-backup="confirm"]').click();
if (await page.evaluate(() => localStorage.getItem('efk.v1.p2'))) fail('one tap must not restore yet');
await page.locator('[data-backup="confirm"]').click();
await page.waitForFunction(() => localStorage.getItem('efk.v1.p2'));
const st = await page.evaluate(() => ({ p1: JSON.parse(localStorage.getItem('efk.v1')), p2: JSON.parse(localStorage.getItem('efk.v1.p2')), idx: JSON.parse(localStorage.getItem('efk.profiles')) }));
if (st.p1.childName !== 'Shin' || st.p1.topics.animals.completed !== 3 || st.p2.childName !== 'Mia' || st.idx.ids.join() !== 'p1,p2') fail('restore content');
if (!(await page.locator('.p-backup-msg').textContent()).includes('Đã khôi phục')) fail('success message');
step('restore: wrong file refused, preview names both children, two taps, everything back');

await page.goto(base);
if ((await page.locator('.who-btn').count()) !== 2) fail('both children on the start screen after restore');
step('after restore: both children are back on the start screen');

if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('backup e2e ok');
