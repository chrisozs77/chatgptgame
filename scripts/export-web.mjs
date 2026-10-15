import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { generateImageAsync } from '@expo/image-utils';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  'base-path': { type: 'string', default: process.env.DEGEN_WEB_BASE_PATH ?? '' },
  'output-dir': { type: 'string', default: 'dist' },
  clear: { type: 'boolean', default: false },
} });
const basePath = values['base-path'].replace(/\/+$/, '');
if (!/^(\/[A-Za-z0-9_-]+)*$/.test(basePath)) {
  throw new Error('Base path must be empty or a path such as /chatgptgame, without dots or query parameters.');
}
const prefix = `${basePath}/`;
const destination = path.resolve(root, values['output-dir']);
const cli = path.resolve(path.dirname(require.resolve('expo/package.json')), 'bin/cli');
const config = require('../src/cloud/config.js').projectConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const fingerprint = createHash('sha256').update(JSON.stringify({ ...config, basePath })).digest('hex');
const fingerprintFile = path.join(root, '.expo/web-build-config.sha256');
const previousFingerprint = await readFile(fingerprintFile, 'utf8').catch(() => '');
const clear = values.clear || previousFingerprint !== fingerprint;
if (clear && !values.clear) console.log('Cloud configuration or deployment path changed; rebuilding the Metro cache.');
const result = spawnSync(process.execPath, [cli, 'export', '--platform', 'web', '--output-dir', destination, ...(clear ? ['--clear'] : [])], {
  cwd: root, stdio: 'inherit', env: { ...process.env, DEGEN_WEB_BASE_PATH: basePath },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir(path.dirname(fingerprintFile), { recursive: true });
await writeFile(fingerprintFile, fingerprint);

await mkdir(path.join(destination, 'icons'), { recursive: true });
for (const size of [180, 192, 512]) {
  const { source } = await generateImageAsync({ projectRoot: root, cacheType: 'pwa-icons' }, {
    src: path.join(root, 'assets/degen-icon.png'), width: size, height: size,
    resizeMode: 'contain', backgroundColor: '#11121b', name: `icon-${size}.png`,
  });
  await writeFile(path.join(destination, `icons/icon-${size}.png`), source);
}

await writeFile(path.join(destination, 'manifest.webmanifest'), JSON.stringify({
  id: prefix, name: 'Degen Tracker', short_name: 'Degen Tracker',
  description: 'Your personal scoreboard for gains and losses.',
  start_url: prefix, scope: prefix, display: 'standalone', orientation: 'portrait',
  background_color: '#11121b', theme_color: '#11121b',
  icons: [
    { src: `${prefix}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${prefix}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${prefix}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

await writeFile(path.join(destination, 'register-sw.js'), `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(${JSON.stringify(`${prefix}sw.js`)}, {
      scope: ${JSON.stringify(prefix)}, updateViaCache: 'none'
    }).catch(error => console.warn('Offline setup unavailable:', error));
  });
}
`);

let html = await readFile(path.join(destination, 'index.html'), 'utf8');
html = html.replace('shrink-to-fit=no', 'shrink-to-fit=no, viewport-fit=cover');
html = html.replace('</head>', `
    <meta name="theme-color" content="#11121b" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Degen Tracker" />
    <link rel="manifest" href="${prefix}manifest.webmanifest" />
    <link rel="apple-touch-icon" sizes="180x180" href="${prefix}icons/icon-180.png" />
  </head>`).replace('</body>', `<script src="${prefix}register-sw.js" defer></script>\n</body>`);
await writeFile(path.join(destination, 'index.html'), html);
// GitHub Pages should serve _expo assets without Jekyll processing.
await writeFile(path.join(destination, '.nojekyll'), '');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  }));
  return files.flat().sort();
}

const files = (await listFiles(destination)).filter(file => !['sw.js', '.nojekyll'].includes(path.basename(file)));
const hash = createHash('sha256').update(prefix);
for (const file of files) { hash.update(path.relative(destination, file)); hash.update(await readFile(file)); }
const version = hash.digest('hex').slice(0, 16);
const cachePrefix = `degen-tracker:${prefix}:`;
const urls = [prefix, ...files.map(file => prefix + path.relative(destination, file).split(path.sep).join('/'))];
await writeFile(path.join(destination, 'sw.js'), `
const CACHE_PREFIX = ${JSON.stringify(cachePrefix)};
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};
const PRECACHE = ${JSON.stringify(urls)};
const APP_SCOPE = ${JSON.stringify(prefix)};
const INDEX_URL = APP_SCOPE + 'index.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request.mode === 'navigate' ? INDEX_URL : event.request);
    // Safari requests byte ranges for audio, including during offline playback.
    // Cache the complete bundled asset, then serve the requested slice.
    const range = event.request.headers.get('Range');
    if (cached && range) {
      const match = /^bytes=(\\d*)-(\\d*)$/.exec(range);
      if (match) {
        const body = await cached.arrayBuffer();
        const length = body.byteLength;
        const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
        const end = match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
        const headers = new Headers(cached.headers);
        headers.delete('Content-Encoding');
        headers.set('Accept-Ranges', 'bytes');
        if ((!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= length) {
          headers.set('Content-Range', 'bytes */' + length);
          headers.set('Content-Length', '0');
          return new Response(null, { status: 416, headers });
        }
        headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + length);
        headers.set('Content-Length', String(end - start + 1));
        return new Response(body.slice(start, end + 1), { status: 206, headers });
      }
    }
    return cached || fetch(event.request);
  })());
});
`);
console.log(`Installable web app exported to ${destination}; deployment path: ${prefix}`);
