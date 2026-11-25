/** Minimal screen switcher with per-screen cleanup. */
import { cancelListening } from './lib/listen';
import { stopSpeaking } from './lib/tts';

export type ScreenName = 'start' | 'home' | 'lesson' | 'world' | 'parent' | 'rest' | 'book' | 'wardrobe' | 'garden' | 'stories' | 'story' | 'games' | 'certificate' | 'abc';

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
  const el = fn(ctx);
  el.classList.add('screen', `screen-${name}`);
  root.replaceChildren(el);
  window.scrollTo(0, 0);
  listeners.forEach((l) => l(name));
}
