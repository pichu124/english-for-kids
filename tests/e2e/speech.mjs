/**
 * First-line speech on Android: the engine may silently drop the first line after
 * the page loads. Bix must still greet: a silent wake-up line in the Play tap, and a
 * resend when a line has not started after ~1.5 s.  node tests/e2e/speech.mjs [baseUrl]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:4173/').replace(/\/$/, '');
const fail = (m) => { throw new Error(m); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  // A speech engine that drops the first audible line it is given (like some Android phones).
  window.__log = [];
  let dropped = false;
  const synth = {
    speaking: false, pending: false,
    getVoices: () => [{ name: 'Fake US', lang: 'en-US', voiceURI: 'fake-us', localService: true, default: true }],
    addEventListener() {}, removeEventListener() {},
    resume() {}, pause() {},
    cancel() { window.__log.push('cancel'); this.speaking = false; },
    speak(u) {
      if (u.volume === 0) { window.__log.push('prime:' + u.text); setTimeout(() => u.onend && u.onend(), 30); return; }
      if (!dropped) { dropped = true; window.__log.push('DROPPED:' + u.text); return; }
      window.__log.push('spoke:' + u.text);
      this.speaking = true;
      setTimeout(() => { u.onstart && u.onstart(); }, 10);
      setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, 60);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.volume = 1; };
});

await page.goto(base);
await page.locator('.btn-play').click({ force: true });
await page.waitForSelector('.home');
await page.waitForTimeout(3500);
const log = await page.evaluate(() => window.__log);
if (!log[0]?.startsWith('prime:')) fail('the Play tap should wake the speech engine first: ' + log.join(' | '));
const dropped = log.find((l) => l.startsWith('DROPPED:'));
if (!dropped) fail('test engine should have dropped a line: ' + log.join(' | '));
const text = dropped.slice('DROPPED:'.length);
if (!log.includes('spoke:' + text)) fail(`a dropped line must be sent again: ${log.join(' | ')}`);
if (log.filter((l) => l === 'spoke:' + text).length !== 1) fail('the line should be spoken exactly once after the resend');
console.log(`✓ first line dropped by the engine ("${text.slice(0, 30)}…") → sent again and heard`);
if (errors.length) fail('page errors: ' + errors.join(' | '));
await browser.close();
console.log('speech e2e ok');
