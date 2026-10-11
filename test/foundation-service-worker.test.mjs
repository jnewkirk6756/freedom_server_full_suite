import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { withNavigation } from '../launch/navigation.mjs';

const source = await readFile(new URL('../launch/nocturne-sw.js', import.meta.url), 'utf8');
const origin = 'https://nocturne.test';
const toRequest = value => value instanceof Request ? value : new Request(new URL(value, origin));
class MemoryCache {
  entries = new Map();
  async put(key, response) {
    if (this.rejectWrites) throw new Error('Quota exceeded');
    if (!response.ok || response.status === 206) throw new Error('Uncacheable response');
    const request = toRequest(key);
    this.entries.set(request.url, { request, response: response.clone() });
  }
  async match(key) {
    const request = toRequest(key), entry = this.entries.get(request.url);
    if (!entry) return undefined;
    for (const name of (entry.response.headers.get('vary') || '').split(',').filter(Boolean)) {
      if (name.trim() === '*' || entry.request.headers.get(name.trim()) !== request.headers.get(name.trim())) return undefined;
    }
    return entry.response.clone();
  }
  async delete(key) { return this.entries.delete(toRequest(key).url); }
}
function worker() {
  const handlers = new Map(), stores = new Map(), calls = [];
  const state = { skips: 0, claims: 0, network: async () => { throw new TypeError('Offline'); } };
  const caches = {
    async open(name) {
      if (state.unavailable) throw new Error('Cache storage unavailable');
      if (!stores.has(name)) stores.set(name, new MemoryCache());
      return stores.get(name);
    },
    async keys() { if (state.unavailable) throw new Error('Cache storage unavailable'); return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match() { throw new Error('Fallback must not search other applications’ caches'); }
  };
  const context = vm.createContext({ URL, Request, Response, location: { origin }, caches,
    fetch: async (request, options) => { calls.push({ request, options }); return state.network(request, options); },
    self: { addEventListener: (type, handler) => handlers.set(type, handler),
      skipWaiting: async () => { state.skips++; }, clients: { claim: async () => { state.claims++; } } }
  });
  vm.runInContext(source, context);
  const cacheName = vm.runInContext('SHELL', context);
  return { state, stores, calls, cacheName, cacheStorage: caches, core: Array.from(vm.runInContext('CORE', context)), cache: () => caches.open(cacheName),
    async lifecycle(type) {
      let pending;
      handlers.get(type)({ waitUntil: promise => { pending = promise; } });
      await pending;
    },
    async request(path, { mode, ...init } = {}) {
      const request = new Request(new URL(path, origin), init);
      if (mode) Object.defineProperty(request, 'mode', { value: mode });
      let pending;
      const background = [];
      handlers.get('fetch')({ request, respondWith: promise => { pending = promise; }, waitUntil: promise => background.push(promise) });
      await Promise.all(background);
      return pending === undefined ? undefined : await pending;
    }
  };
}
const html = text => new Response(text, { headers: { 'content-type': 'text/html' } });

test('online assets return fresh content on the first request and revalidate HTTP cache', async () => {
  const h = worker(), cache = await h.cache();
  await cache.put('/navigation.js', new Response('old'));
  h.state.network = async () => new Response('new');
  assert.equal(await (await h.request('/navigation.js?v=next')).text(), 'new');
  assert.equal(h.calls[0].options.cache, 'no-cache');
  assert.equal(await (await cache.match('/navigation.js')).text(), 'new');
});

test('version cache-busters share a key but functional query parameters stay separate', async () => {
  const h = worker(), cache = await h.cache();
  h.state.network = async request => new Response(new URL(request.url).search);
  await h.request('/app.js?v=one&lang=en');
  await h.request('/app.js?v=two&lang=en');
  await h.request('/app.js?v=two&lang=es');
  assert.deepEqual([...cache.entries.keys()].sort(), [origin + '/app.js?lang=en', origin + '/app.js?lang=es']);
  assert.equal(await (await cache.match('/app.js?lang=en')).text(), '?v=two&lang=en');
});

test('navigation stays fresh online and uses the last good matching page offline', async () => {
  const h = worker();
  h.state.network = async () => html('latest page');
  assert.equal(await (await h.request('/world/?panel=settings&v=one', { mode: 'navigate' })).text(), 'latest page');
  h.state.network = async () => { throw new TypeError('Offline'); };
  assert.equal(await (await h.request('/world/?panel=settings&v=two', { mode: 'navigate' })).text(), 'latest page');
});

test('failed navigation cannot replace the last good page', async () => {
  const h = worker(), cache = await h.cache();
  await cache.put('/world/', html('last good'));
  h.state.network = async () => new Response('Unavailable', { status: 503 });
  assert.equal(await (await h.request('/world/', { mode: 'navigate' })).text(), 'last good');
  assert.equal(await (await cache.match('/world/')).text(), 'last good');
});

test('authentication failures remain visible and purge all old offline shell pages', async () => {
  for (const status of [401, 403]) {
    const h = worker(), cache = await h.cache();
    await cache.put('/world/', html('old page'));
    await cache.put('/', html('old home'));
    h.state.network = async () => new Response('error', { status });
    assert.equal((await h.request('/world/', { mode: 'navigate' })).status, status);
    assert.equal(h.stores.has(h.cacheName), false);
    h.state.network = async () => { throw new TypeError('Offline'); };
    assert.equal((await h.request('/world/', { mode: 'navigate' })).type, 'error');
  }
});

test('404 remains visible without replacing the last good cache entry', async () => {
  const h = worker(), cache = await h.cache();
  await cache.put('/world/', html('last good'));
  h.state.network = async () => new Response('missing', { status: 404 });
  assert.equal((await h.request('/world/', { mode: 'navigate' })).status, 404);
  assert.equal(await (await cache.match('/world/')).text(), 'last good');
});

test('private authenticated responses are never cached and purge the whole shell', async () => {
  const h = worker(), cache = await h.cache();
  await cache.put('/world/', html('public page'));
  await cache.put('/', html('public home'));
  h.stores.set('unrelated-application', new MemoryCache());
  h.stores.set('nocturne-shell-0840', new MemoryCache());
  h.state.network = async () => new Response('private page', { headers: { 'cache-control': 'Private, no-store' } });
  assert.equal(await (await h.request('/world/?v=next', { mode: 'navigate' })).text(), 'private page');
  assert.equal(h.stores.has(h.cacheName), false);
  assert.equal(h.stores.has('unrelated-application'), true);
  assert.equal(h.stores.has('nocturne-shell-0840'), false);
  h.state.network = async () => { throw new TypeError('Offline'); };
  assert.equal((await h.request('/world/', { mode: 'navigate' })).type, 'error');
});

test('a private server error never falls back to a cached public page', async () => {
  const h = worker(), cache = await h.cache();
  await cache.put('/', html('public home'));
  h.state.network = async () => new Response('private error', { status: 503, headers: { 'cache-control': 'private="set-cookie", no-store' } });
  const response = await h.request('/world/', { mode: 'navigate' });
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'private error');
  assert.equal(h.stores.has(h.cacheName), false);
  h.state.network = async () => { throw new TypeError('Offline'); };
  assert.equal((await h.request('/', { mode: 'navigate' })).type, 'error');
});

test('explicit public shell caching remains available despite the existing no-store HTTP convention', async () => {
  const h = worker(), cache = await h.cache();
  h.state.network = async () => new Response('public shell', { headers: { 'cache-control': 'no-store' } });
  await h.request('/', { mode: 'navigate' });
  assert.equal(await (await cache.match('/')).text(), 'public shell');
});

test('offline navigation falls back to this shell home only; missing assets return a network error', async () => {
  const h = worker(), cache = await h.cache();
  await cache.put('/', html('offline home'));
  assert.equal(await (await h.request('/unknown/', { mode: 'navigate' })).text(), 'offline home');
  assert.equal((await h.request('/missing.js')).type, 'error');
});

test('HTTP 5xx without a cached fallback is returned unchanged', async () => {
  const h = worker();
  h.state.network = async () => new Response('temporarily unavailable', { status: 503 });
  assert.equal((await h.request('/missing.js')).status, 503);
});

test('API roots, API descendants, media, writes, cross-origin and non-shell requests bypass the worker', async () => {
  const h = worker();
  for (const path of ['/api', '/api/', '/api/status.json', '/v1', '/v1/status.json', '/media', '/media/file.json']) {
    assert.equal(await h.request(path, { mode: 'navigate' }), undefined, path);
  }
  assert.equal(await h.request('/app.js', { method: 'POST' }), undefined);
  assert.equal(await h.request('https://other.test/app.js'), undefined);
  assert.equal(await h.request('/image.png'), undefined);
  assert.equal(h.calls.length, 0);
  h.state.network = async () => new Response('not an API');
  assert.equal(await (await h.request('/api-docs.js')).text(), 'not an API');
});

test('Range, Authorization and explicitly no-store requests bypass caching', async () => {
  const h = worker();
  for (const init of [{ headers: { range: 'bytes=0-100' } }, { headers: { authorization: 'Bearer test-only' } }, { cache: 'no-store' }]) {
    assert.equal(await h.request('/app.js', init), undefined);
  }
  assert.equal(h.calls.length, 0);
});

test('cache quota or availability failures do not discard successful network responses', async () => {
  const h = worker(), cache = await h.cache();
  h.state.network = async () => new Response('fresh');
  cache.rejectWrites = true;
  assert.equal(await (await h.request('/app.js')).text(), 'fresh');
  h.state.unavailable = true;
  assert.equal(await (await h.request('/app.js')).text(), 'fresh');
  h.state.network = async () => { throw new TypeError('Offline'); };
  assert.equal((await h.request('/app.js')).type, 'error');
});

test('canonical request keys preserve headers needed for Vary matching', async () => {
  const h = worker();
  h.state.network = async () => new Response('English', { headers: { vary: 'Accept-Language' } });
  await h.request('/app.js?v=one', { headers: { 'accept-language': 'en' } });
  h.state.network = async () => { throw new TypeError('Offline'); };
  assert.equal(await (await h.request('/app.js?v=two', { headers: { 'accept-language': 'en' } })).text(), 'English');
  assert.equal((await h.request('/app.js?v=two', { headers: { 'accept-language': 'es' } })).type, 'error');
});

test('installation precaches navigation dependencies, tolerates failures and stores canonical keys', async () => {
  const h = worker();
  h.state.network = async request => request.startsWith('/vr') ? new Response('missing', { status: 404 }) : new Response('shell');
  await h.lifecycle('install');
  const cache = await h.cache();
  assert.equal(h.state.skips, 1);
  assert.ok(await cache.match('/navigation-state.js'));
  assert.ok(await cache.match('/browser-storage.js'));
  assert.equal(await cache.match('/vr/'), undefined);
  assert.ok([...cache.entries.keys()].every(key => !new URL(key).searchParams.has('v')));
  assert.ok(h.calls.every(call => call.options.cache === 'reload'));
});

test('installation does not cache private responses or fail when entirely offline', async () => {
  const h = worker();
  h.state.network = async () => new Response('private', { headers: { 'cache-control': 'private, no-store' } });
  await h.lifecycle('install');
  assert.equal((await h.cache()).entries.size, 0);
  h.state.network = async () => { throw new TypeError('Offline'); };
  await h.lifecycle('install');
  assert.equal(h.state.skips, 2);
});

test('activation deletes only obsolete shell caches and claims clients', async () => {
  const h = worker();
  await h.cache();
  h.stores.set('nocturne-shell-0840', new MemoryCache());
  h.stores.set('unrelated-application', new MemoryCache());
  await h.lifecycle('activate');
  assert.deepEqual([...h.stores.keys()].sort(), [h.cacheName, 'unrelated-application'].sort());
  assert.equal(h.state.claims, 1);
});


test('Authorization requests purge old shell pages while bypassing the fetch handler', async () => {
  const h = worker(), cache = await h.cache();
  await cache.put('/', html('old public home'));
  assert.equal(await h.request('/', { mode: 'navigate', headers: { authorization: 'Basic test-only' } }), undefined);
  assert.equal(h.stores.has(h.cacheName), false);
  assert.equal((await h.request('/', { mode: 'navigate' })).type, 'error');
});

test('a public response arriving after a private response cannot recreate offline data', async () => {
  const h = worker();
  let finishPublic;
  h.state.network = request => request.url.endsWith('/app.js')
    ? new Promise(resolve => { finishPublic = resolve; })
    : Promise.resolve(new Response('private', { headers: { 'cache-control': 'private, no-store' } }));
  const delayed = h.request('/app.js');
  await h.request('/', { mode: 'navigate' });
  finishPublic(new Response('earlier public script'));
  assert.equal(await (await delayed).text(), 'earlier public script');
  assert.equal(h.stores.has(h.cacheName), false);
});

test('activation can claim clients when cache storage is unavailable', async () => {
  const h = worker();
  h.state.unavailable = true;
  await h.lifecycle('activate');
  assert.equal(h.state.claims, 1);
});


test('an authorized API write also purges old shell pages without intercepting the API', async () => {
  const h = worker(), cache = await h.cache();
  await cache.put('/', html('old public home'));
  assert.equal(await h.request('/api/action', { method: 'POST', headers: { authorization: 'Basic test-only' } }), undefined);
  assert.equal(h.stores.has(h.cacheName), false);
  assert.equal(h.calls.length, 0);
});


const packSource = (await readFile(new URL('../launch/asset-pack-core.js', import.meta.url), 'utf8'))
  .replace(/^import[^\n]+\n/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const))/g, '');
function assetShell(h) {
  const context = vm.createContext({ URL, Request, Response, location: { origin }, caches: h.cacheStorage,
    window: { caches: h.cacheStorage },
    fetch: async (request, options) => { h.calls.push({ request, options }); return h.state.network(request, options); }
  });
  vm.runInContext(packSource, context);
  return { cacheShell: vm.runInContext('cacheShell', context),
    cacheName: vm.runInContext('SHELL_CACHE', context), assets: Array.from(vm.runInContext('SHELL_ASSETS', context)) };
}

test('the worker and page shell writer use one cache name, manifest and canonical key policy', async () => {
  const h = worker(), pack = assetShell(h);
  assert.equal(pack.cacheName, h.cacheName);
  assert.deepEqual(pack.assets, h.core);
  h.state.network = async () => new Response('public shell', { headers: { 'cache-control': 'no-store' } });
  const result = await pack.cacheShell();
  assert.equal(result.failed.length, 0);
  assert.equal(result.cached.length, pack.assets.length);
  assert.ok([...(await h.cache()).entries.keys()].every(key => !new URL(key).searchParams.has('v')));
  assert.ok(h.calls.every(call => call.options.credentials === 'same-origin'));
  h.state.network = async () => { throw new TypeError('Offline'); };
  assert.equal(await (await h.request('/anna-home.js?v=older-html')).text(), 'public shell');
});

test('page shell writer refuses private responses and removes current and legacy shell caches only', async () => {
  for (const response of [
    new Response('private page', { headers: { 'cache-control': 'Private, no-store' } }),
    new Response('locked', { status: 401 }), new Response('denied', { status: 403 }),
    new Response('auth unconfigured', { status: 503, headers: { 'cache-control': 'private, no-store' } })
  ]) {
    const h = worker(), pack = assetShell(h);
    await (await h.cache()).put('/', html('old public home'));
    h.stores.set('nocturne-shell-0840', new MemoryCache());
    h.stores.set('unrelated-application', new MemoryCache());
    h.state.network = async () => response.clone();
    const result = await pack.cacheShell();
    assert.equal(result.cached.length, 0);
    assert.match(result.failed.at(-1).error, /disabled for authenticated deployments/);
    assert.deepEqual([...h.stores.keys()], ['unrelated-application']);
    assert.equal(h.calls.length, 1, 'stop immediately on a private deployment');
    await pack.cacheShell();
    assert.equal(h.calls.length, 1, 'do not restart offline caching after authentication is observed');
  }
});

test('a mid-download private response purges already downloaded shell entries and reports none cached', async () => {
  const h = worker(), pack = assetShell(h);
  h.state.network = async path => path === '/' ? new Response('public shell')
    : new Response('private asset', { headers: { 'cache-control': 'private, no-store' } });
  const result = await pack.cacheShell();
  assert.equal(result.cached.length, 0);
  assert.equal(h.stores.has(h.cacheName), false);
  assert.equal(h.calls.length, 2);
});

test('shell writer reports unavailable cache storage instead of rejecting the whole operation', async () => {
  const h = worker(), pack = assetShell(h);
  h.state.unavailable = true;
  const result = await pack.cacheShell();
  assert.equal(result.cached.length, 0);
  assert.match(result.failed[0].error, /Cache storage unavailable/);
});

test('precache covers Home styles, injected scripts, and the complete static module import graph', async () => {
  const h = worker(), paths = new Set(h.core.map(path => new URL(path, origin).pathname));
  const html = withNavigation(await readFile(new URL('../launch/experience.html', import.meta.url), 'utf8'), '/');
  const pending = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => new URL(match[1], origin).pathname)
    .filter(path => /\.(?:js|css|webmanifest)$/.test(path));
  const visited = new Set();
  while (pending.length) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    visited.add(path);
    assert.ok(paths.has(path), `Home offline shell is missing ${path}`);
    const contents = await readFile(new URL('../launch' + path, import.meta.url), 'utf8');
    if (path.endsWith('.js')) {
      for (const match of contents.matchAll(/\bimport\s*(?:[^'";]*?\bfrom\s*)?['"]([^'"]+)['"]/g)) {
        pending.push(new URL(match[1], origin + path).pathname);
      }
    } else if (path.endsWith('.webmanifest')) {
      for (const icon of JSON.parse(contents).icons || []) pending.push(new URL(icon.src, origin + path).pathname);
    }
  }
  assert.ok(visited.has('/anna-home.js'));
  assert.ok(visited.has('/anna-psyche.js'));
  assert.ok(visited.has('/video-state-player.js'));
  assert.ok(visited.has('/browser-storage.js'));
});

test('the precached app icon remains available offline', async () => {
  const h = worker();
  h.state.network = async () => new Response('shell resource');
  await h.lifecycle('install');
  h.state.network = async () => { throw new TypeError('Offline'); };
  assert.equal(await (await h.request('/nocturne-icon.svg')).text(), 'shell resource');
});

test('only fixed bundled portraits join the existing private-safe offline cache path',async()=>{
 const h=worker();h.state.network=async()=>new Response('portrait test bytes');await h.lifecycle('install');h.state.network=async()=>{throw new TypeError('Offline')};
 for(const path of ['/portraits/neutral-20261011.webp','/portraits/friendly-20261011.webp'])assert.equal(await (await h.request(path)).text(),'portrait test bytes');
});
