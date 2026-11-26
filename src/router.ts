/** Minimal screen switcher with per-screen cleanup. */
import { cancelListening } from './lib/listen';
import { stopSpeaking } from './lib/tts';

export type ScreenName = 'start' | 'home' | 'lesson' | 'world' | 'parent' | 'rest' | 'book' | 'wardrobe' | 'garden' | 'stories' | 'story' | 'games' | 'certificate' | 'abc' | 'today' | 'report' | 'test' | 'worksheet';

export type Ctx = {
  /** False once the user has left this screen — stop async sequences. */
  alive(): boolean;
  onCleanup(fn: () => void): void;
  go(name: ScreenName, params?: Record<string, string>): void;
  params: Record<string, string>;
};

export type ScreenFn = (ctx: Ctx) => HTMLElement;

const registry = new Map<ScreenName, ScreenFn>();
let current: { name: ScreenName; cleanups: (() => void)[]; alive: boolean } | null = null;
let root: HTMLElement;
const listeners: ((name: ScreenName) => void)[] = [];

export function register(name: ScreenName, fn: ScreenFn): void {
  registry.set(name, fn);
}

export function mount(el: HTMLElement): void {
  root = el;
}

export function currentScreen(): ScreenName | null {
  return current?.name ?? null;
}

export function onNavigate(fn: (name: ScreenName) => void): void {
  listeners.push(fn);
}

export function go(name: ScreenName, params: Record<string, string> = {}): void {
  if (current) {
    current.alive = false;
    for (const fn of current.cleanups) {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    }
  }
  stopSpeaking();
  cancelListening();
  const state = { name, cleanups: [] as (() => void)[], alive: true };
  current = state;
  const ctx: Ctx = {
    alive: () => state.alive,
    onCleanup: (fn) => state.cleanups.push(fn),
    go,
    params,
  };
  const fn = registry.get(name);
  if (!fn) throw new Error(`No screen ${name}`);
  let el: HTMLElement;
  try {
    el = fn(ctx);
  } catch (e) {
    // A screen must never leave the child (or parent) on a blank page.
    console.error(e);
    if (name !== 'home' && name !== 'start' && name !== 'parent') return go('home');
    el = fallbackScreen(name);
  }
  el.classList.add('screen', `screen-${name}`);
  root.replaceChildren(el);
  window.scrollTo(0, 0);
  // Android back button: screens other than home get a history entry, so "back"
  // returns to the home map instead of closing the app.
  if (name !== 'home' && name !== 'start' && !history.state?.bix) {
    try {
      history.pushState({ bix: 1 }, '');
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l(name));
}

window.addEventListener('popstate', () => {
  if (current && current.name !== 'home' && current.name !== 'start') go('home');
});

/** Shown only if a screen fails to draw (e.g. damaged saved data): a way to the parent area. */
function fallbackScreen(name: ScreenName): HTMLElement {
  const main = document.createElement('main');
  main.className = 'fallback';
  const p = document.createElement('p');
  p.textContent = 'Xin lỗi, màn hình này đang gặp lỗi. Bố mẹ có thể mở khu bố mẹ để khôi phục bản sao lưu hoặc xoá tiến độ.';
  const btn = document.createElement('button');
  btn.className = 'btn btn-good';
  btn.textContent = name === 'parent' ? '🔄 Tải lại' : '🔒 Khu bố mẹ';
  btn.onclick = () => (name === 'parent' ? location.reload() : go('parent'));
  main.append(p, btn);
  return main;
}
