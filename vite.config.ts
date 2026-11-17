import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** List files in /public (they are copied to dist as-is). */
function publicFiles(dir = 'public'): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push('/' + relative('public', p).split('\\').join('/'));
    }
  };
  walk(dir);
  return out;
}

/**
 * Emits /sw.js that precaches every built file, so the app works offline after
 * the first visit. The cache name changes whenever any file changes.
 */
function serviceWorker(): Plugin {
  return {
    name: 'efk-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = ['/', ...Object.keys(bundle).map((f) => '/' + f), ...publicFiles()].filter((f) => f !== '/index.html');
      const hash = createHash('sha256');
      for (const [name, chunk] of Object.entries(bundle)) {
        hash.update(name);
        hash.update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source));
      }
      const version = hash.digest('hex').slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: SW_TEMPLATE.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files, null, 2)),
      });
    },
  };
}

const SW_TEMPLATE = `/* Generated at build time — do not edit. */
const CACHE = 'efk-__VERSION__';
const PRECACHE = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('efk-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App shell: serve the cached page instantly (works offline).
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('/', { ignoreVary: true }).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreVary: true, ignoreSearch: false }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;

export default defineConfig({
  build: { target: 'es2021' },
  plugins: [serviceWorker()],
});
