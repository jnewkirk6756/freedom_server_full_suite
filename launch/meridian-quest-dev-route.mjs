/** Public, finite static demo only. This handler never serves the application or APIs. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const prefix = '/meridian-quest-dev';
export const questDevFiles = Object.freeze({
  '/meridian-quest-dev/': ['index.html', 'text/html; charset=utf-8'],
  '/meridian-quest-dev/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/meridian-quest-dev/dev.css': ['dev.css', 'text/css; charset=utf-8'],
  '/meridian-quest-dev/dev.mjs': ['dev.mjs', 'text/javascript; charset=utf-8'],
  '/meridian-quest-dev/scene.mjs': ['scene.mjs', 'text/javascript; charset=utf-8'],
  '/meridian-quest-dev/quest-workspace.mjs': ['quest-workspace.mjs', 'text/javascript; charset=utf-8'],
  '/meridian-quest-dev/quest-measurement.mjs': ['quest-measurement.mjs', 'text/javascript; charset=utf-8'],
  '/meridian-quest-dev/quest-feedback.mjs': ['quest-feedback.mjs', 'text/javascript; charset=utf-8'],
  '/meridian-quest-dev/quest-camera.mjs': ['quest-camera.mjs', 'text/javascript; charset=utf-8']
});
export const questDevHeaders = Object.freeze({
  'cache-control': 'private, no-store',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src blob: data:; media-src blob:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'permissions-policy': 'xr-spatial-tracking=(self), accelerometer=(self), gyroscope=(self), camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex, nofollow, noarchive'
});

/** `pathname` must come from URL.pathname; no decoded path becomes a filesystem path. */
export function serveQuestDev(req, res, pathname) {
  if (pathname !== prefix && !pathname.startsWith(prefix + '/')) return false;
  const reply = (code, type, body, extra = {}) => {
    res.writeHead(code, {...questDevHeaders, 'content-type': type, ...extra});
    res.end(req.method === 'HEAD' ? '' : body);
    return true;
  };
  if (!['GET', 'HEAD'].includes(req.method)) return reply(405, 'text/plain; charset=utf-8', 'Read-only demo.', {'allow': 'GET, HEAD'});
  if (pathname === prefix) return reply(308, 'text/plain; charset=utf-8', 'Open /meridian-quest-dev/', {'location': prefix + '/'});
  const entry = Object.hasOwn(questDevFiles, pathname) ? questDevFiles[pathname] : null;
  if (!entry) return reply(404, 'text/plain; charset=utf-8', 'Demo file not found.');
  try {
    const body = fs.readFileSync(fileURLToPath(new URL('./meridian-quest-dev/' + entry[0], import.meta.url)));
    return reply(200, entry[1], body);
  } catch {
    return reply(503, 'text/plain; charset=utf-8', 'Demo file temporarily unavailable.');
  }
}
