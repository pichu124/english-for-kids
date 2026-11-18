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
      if (mode === 'broken') {
        setTimeout(() => { fire('onstart'); fire('onerror', { error: 'no-speech' }); fire('onend'); }, 60);
        return;
      }
      setTimeout(() => {
        fire('onstart');
        if (mode === 'denied') { fire('onerror', { error: 'not-allowed' }); fire('onend'); return; }
        fire('onaudiostart');
        if (mode === 'silent') { fire('onerror', { error: 'no-speech' }); fire('onend'); return; }
        const label = document.querySelector('.speak .word-label')?.textContent || '';
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
