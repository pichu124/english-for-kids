// Injected before the app loads: fast fake speech so a whole lesson runs in seconds.
// window.__voice = 'match' | 'miss' | 'silent' | 'denied' controls the fake recognizer.
(() => {
  window.__voice = 'match';
  window.__spoken = [];
  const fakeSynth = {
    speaking: false,
    getVoices: () => [{ name: 'Fake US', lang: 'en-US', voiceURI: 'fake', localService: true, default: true }],
    addEventListener() {},
    cancel() {},
    resume() {},
    pending: false,
    speak(u) {
      window.__spoken.push(u.text);
      setTimeout(() => u.onend && u.onend(), 20);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fakeSynth, configurable: true });

  // Modes: 'match' (says the word), 'miss' (says something else), 'silent' (mic on, no speech),
  // 'broken' (ends at once without capturing audio, like a dead speech service), 'denied'.
  class FakeRec {
    start() {
      const mode = window.__voice;
      const fire = (name, arg) => this[name] && this[name](arg);
      // Like the reporter's Android phone: starts, then hears nothing until stopped
      // (error "aborted") — but only in the full configuration.
      if (mode === 'simple-only' && this.interimResults) {
        this._hung = true;
        setTimeout(() => fire('onstart'), 7);
        return;
      }
      if (mode === 'simple-only') { window.__voice = 'match'; this.start(); window.__voice = 'simple-only'; return; }
      // Like the same phone after its settings were fixed: full mode hears speech but says "nomatch".
      if (mode === 'full-nomatch' && this.interimResults) {
        setTimeout(() => { fire('onstart'); fire('onaudiostart'); fire('onsoundstart'); fire('onspeechstart'); fire('onspeechend'); fire('onnomatch'); fire('onend'); }, 80);
        return;
      }
      if (mode === 'full-nomatch') { window.__voice = 'match'; this.start(); window.__voice = 'full-nomatch'; return; }
      // Only gives text with a single alternative and no partial results.
      if (mode === 'simple-text-only' && (this.interimResults || this.maxAlternatives > 1)) {
        setTimeout(() => { fire('onstart'); fire('onaudiostart'); fire('onspeechstart'); fire('onspeechend'); fire('onnomatch'); fire('onend'); }, 80);
        return;
      }
      if (mode === 'simple-text-only') { window.__voice = 'match'; this.start(); window.__voice = 'simple-text-only'; return; }
      if (mode === 'broken') {
        setTimeout(() => { fire('onstart'); fire('onerror', { error: 'no-speech' }); fire('onend'); }, 60);
        return;
      }
      setTimeout(() => {
        fire('onstart');
        if (mode === 'denied') { fire('onerror', { error: 'not-allowed' }); fire('onend'); return; }
        fire('onaudiostart');
        if (mode === 'silent') { fire('onerror', { error: 'no-speech' }); fire('onend'); return; }
        // newer speaking activities put the expected words on the mic button (data-say)
        const label = window.__say ?? (document.querySelector('[data-say]')?.getAttribute('data-say') || document.querySelector('.speak .word-card')?.getAttribute('aria-label') || document.querySelector('.speak .word-label')?.textContent || '');
        const said = mode === 'match' ? `${label}` : 'zebra on a skateboard';
        fire('onspeechstart');
        const alt = [{ transcript: said }, { transcript: said + 's' }];
        alt.isFinal = true;
        fire('onresult', { resultIndex: 0, results: [alt] });
        setTimeout(() => fire('onend'), 30);
      }, 120);
    }
    stop() {
      if (this._hung) { this._hung = false; setTimeout(() => { this.onerror && this.onerror({ error: 'aborted' }); this.onend && this.onend(); }, 20); return; }
      setTimeout(() => this.onend && this.onend(), 10);
    }
    abort() { this.onend && this.onend(); }
  }
  window.webkitSpeechRecognition = FakeRec;
  window.SpeechRecognition = FakeRec;
})();

// Reading/spelling steps: answer them automatically so the older tests can walk through a
// whole lesson. Tests that check these steps set window.__manualReading = true.
setInterval(() => {
  if (window.__manualReading) return;
  const read = document.querySelector('.read[data-answer]');
  if (read) {
    const want = read.getAttribute('data-answer');
    const btn = [...document.querySelectorAll('.read-choice:not(.is-faded):not(.is-right)')].find((b) => b.getAttribute('data-word') === want);
    if (btn && !document.querySelector('.read-choice.is-right')) btn.click();
    return;
  }
  const spell = document.querySelector('.spell[data-word]');
  if (spell) {
    const word = spell.getAttribute('data-word');
    const filled = spell.querySelectorAll('.spell-slot.is-filled').length;
    if (filled >= word.length) return;
    const tile = [...spell.querySelectorAll('.spell-tile:not(.is-used)')].find((t) => t.textContent === word[filled]);
    if (tile) tile.click();
  }
}, 120);

// Sentence step: build the sentence word by word; answer yes/no.
setInterval(() => {
  if (window.__manualReading) return;
  const b = window.__manualSentence ? null : document.querySelector('.sentence-build[data-sentence]');
  if (b) {
    const words = b.getAttribute('data-sentence').split(/\s+/);
    const n = b.querySelectorAll('.sb-gap.is-filled').length;
    if (n >= words.length) return;
    const tile = [...b.querySelectorAll('.sb-tile:not(.is-used)')].find((t) => t.textContent === words[n]);
    if (tile) tile.click();
    return;
  }
  const yn = document.querySelector('.yesno[data-truth]');
  if (yn && !yn.querySelector('.yn-btn.is-right')) yn.querySelector(yn.getAttribute('data-truth') === 'true' ? '.yn-yes' : '.yn-no')?.click();
}, 150);

// Movers steps: type the word on the a–z keyboard; answer the text questions.
setInterval(() => {
  if (window.__manualReading) return;
  const w = window.__manualWrite ? null : document.querySelector('.write[data-word]');
  if (w) {
    const word = w.getAttribute('data-word');
    const n = w.querySelectorAll('.wr-box.is-filled').length;
    if (n < word.length) w.querySelector(`.wr-key[data-key="${word[n]}"]`)?.click();
    return;
  }
  const q = window.__manualText ? null : document.querySelector('.tx-ask[data-answer]');
  if (q && !document.querySelector('.tx-opt.is-right')) document.querySelector(`.tx-opt[data-k="${q.getAttribute('data-answer')}"]`)?.click();
}, 150);

// Gap fill: choose the missing word.
setInterval(() => {
  if (window.__manualReading || window.__manualGap) return;
  const g = document.querySelector('.gap[data-answer]');
  if (g && !g.querySelector('.gap-opt.is-right')) [...g.querySelectorAll('.gap-opt')].find((b) => b.getAttribute('data-word') === g.getAttribute('data-answer'))?.click();
}, 150);
