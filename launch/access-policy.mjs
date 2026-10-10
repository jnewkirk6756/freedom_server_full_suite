/** Private, single-owner preview boundary. No credentials are sent to client code. */
import { createHash, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();
const loopback = value => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value);
const deny = (status, code, message, extra = {}) => ({ allowed: false, private: true, status, code, message, ...extra });

export function createAccessPolicy(env = {}, { bindHost = '127.0.0.1' } = {}) {
  const password = env.NOCTURNE_ACCESS_PASSWORD || '';
  const configured = password.length >= 20;
  const expected = digest('owner:' + password);
  const localPreview = loopback(bindHost) && env.NODE_ENV !== 'production' && !env.RENDER;
  const sharedWrites = env.NOCTURNE_ALLOW_SHARED_MEDIA_WRITES === '1';
  function authorized(req) {
    const value = req.headers.authorization;
    if (!configured || typeof value !== 'string' || value.length > 2048 || !/^Basic [A-Za-z0-9+/]+=*$/i.test(value)) return false;
    const decoded = Buffer.from(value.slice(6), 'base64').toString('utf8');
    return timingSafeEqual(digest(decoded), expected);
  }
  return {
    configured,
    check(req, pathname) {
      if (['/v1/health', '/robots.txt'].includes(pathname) && ['GET', 'HEAD'].includes(req.method)) return { allowed: true };
      const privateRoute = /^\/(?:v1|api|media)(?:\/|$)/.test(pathname);
      if (!configured) {
        if (localPreview && loopback(req.socket?.remoteAddress) && !privateRoute && ['GET', 'HEAD'].includes(req.method)) return { allowed: true };
        return deny(503, 'PRIVATE_ACCESS_NOT_CONFIGURED', 'Private access must be configured before this service is available.');
      }
      if (!authorized(req)) return deny(401, 'OWNER_AUTH_REQUIRED', 'Owner sign-in is required.', {
        private: true,
        headers: { 'www-authenticate': 'Basic realm="Nocturne private preview", charset="UTF-8"' }
      });
      // Browsers attach Basic credentials automatically. Reject cross-origin writes
      // even if a future route omits the additional per-session request header.
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const origin = req.headers.origin;
        if (req.headers['sec-fetch-site'] === 'cross-site') return deny(403, 'CROSS_ORIGIN_WRITE', 'Cross-origin writes are disabled.', { private: true });
        if (origin) {
          try {
            const expectedOrigin = env.NOCTURNE_PUBLIC_ORIGIN ? new URL(env.NOCTURNE_PUBLIC_ORIGIN) : null;
            const incoming = new URL(origin);
            const same = expectedOrigin ? incoming.origin === expectedOrigin.origin : incoming.host === req.headers.host;
            if (!same || !['http:', 'https:'].includes(incoming.protocol)) throw Error('origin');
          } catch { return deny(403, 'CROSS_ORIGIN_WRITE', 'Cross-origin writes are disabled.', { private: true }); }
        }
      }
      if (/^\/v1\/media(?:\/|$)/.test(pathname) && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sharedWrites) {
        return deny(403, 'SHARED_MEDIA_WRITES_DISABLED', 'Shared media changes are disabled in this private preview.', { private: true });
      }
      return { allowed: true, private: true };
    }
  };
}
