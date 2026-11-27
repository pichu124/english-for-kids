// Recorded voice: a line with a recording plays the file instead of the speech engine;
// a line without one (or a file that fails) still goes to the speech engine.
// Run: node tests/e2e/voice.mjs [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const step = (m) => console.log('✓', m);
const fail = (m) => { throw new Error(m); };

// a tiny silent WAV (0.2 s)
function wav(ms = 200) {
  const rate = 8000, n = Math.round((rate * ms) / 1000), b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return b;
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const played = [];
await ctx.route('**/audio/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ lines: { hello: 'hello.wav', "i'm bix": 'bix.wav', "let's play": 'play.wav', 'this is a dog': 'missing.wav', 'can you say dog': 'play.wav' } }) }));
await ctx.route('**/audio/*.wav', (r) => {
  const name = r.request().url().split('/').pop();
  played.push(name);
  return name === 'missing.wav' ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ contentType: 'audio/wav', body: wav() });
});
await page.addInitScript(readFileSync(new URL('./fakes.js', import.meta.url), 'utf8'));
await page.addInitScript(() => localStorage.removeItem('efk.welcome')); // the welcome's sound check says "Hello! I'm Bix. Let's play!"
await page.goto(base);
await page.locator('[data-wl="next"]').click();
await page.locator('[data-wl="next"]').click();
await page.locator('[data-wl="next"]').click();
await page.waitForSelector('[data-wl="sound"]');
await page.waitForTimeout(300);
await page.locator('[data-wl="sound"]').click();
await page.waitForSelector('[data-wl="heard"]', { timeout: 6000 });
if (played.join() !== 'hello.wav,bix.wav,play.wav') fail('both recordings play in order: ' + played.join());
if (await page.evaluate(() => window.__spoken.some((t) => /I'm Bix/.test(t)))) fail('a recorded line is not sent to the speech engine');
step('a line with recordings plays them, sentence by sentence, not the speech engine');
// a file that fails: the whole line goes to the speech engine instead
await page.locator('[data-wl="skip"]').click();
await page.locator('.btn-play').click({ force: true });
await page.locator('.btn-parent').click();
const [x, y] = (await page.locator('.gate-q').textContent()).match(/\d+/g).map(Number);
for (const ch of String(x * y)) await page.click(`.key:text-is("${ch}")`);
await page.click('.key-ok');
if (!(await page.locator('.p-recorded input[type=checkbox]').isChecked())) fail('recordings are on by default when there are some');
await page.locator('button:has-text("Nghe thử giọng đọc")').click();
await page.waitForFunction(() => window.__spoken.some((t) => /This is a dog\. Can you say dog\?/.test(t)), null, { timeout: 6000 });
if (!played.includes('missing.wav')) fail('the recording was tried first');
step('a recording that will not play falls back to the speech engine for the whole line');
if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('voice e2e ok');
