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

  class FakeRec {
    start() {
      const mode = window.__voice;
      setTimeout(() => {
        if (mode === 'denied') { this.onerror && this.onerror({ error: 'not-allowed' }); this.onend && this.onend(); return; }
        if (mode === 'silent') { this.onerror && this.onerror({ error: 'no-speech' }); this.onend && this.onend(); return; }
        const label = document.querySelector('.speak .word-label')?.textContent || '';
        const said = mode === 'match' ? `${label}` : 'zebra on a skateboard';
        this.onspeechstart && this.onspeechstart();
        const alt = [{ transcript: said }, { transcript: said + 's' }];
        alt.isFinal = true;
        this.onresult && this.onresult({ resultIndex: 0, results: [alt] });
        setTimeout(() => this.onend && this.onend(), 30);
      }, 120);
    }
    stop() { setTimeout(() => this.onend && this.onend(), 10); }
    abort() { this.onend && this.onend(); }
  }
  window.webkitSpeechRecognition = FakeRec;
  window.SpeechRecognition = FakeRec;
})();
