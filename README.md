# Nocturne interface polish candidate

Local-only continuation of tested PR #14 head `396ba2ee89fe893d58e2de8152eb97d78972138d`.

- Run `npm test`: foundation plus focused neutral interface/viewer/XR checks.
- Run `npm run test:browser` in an environment allowed to start Chromium.
- Open `/model-viewer/` for the neutral model-viewer prototype.
- [Implementation, verification and remaining gates](reports/UI-POLISH-VALIDATION.md).

The candidate has not been published or deployed. Real iPhone/Quest and current browser layout/rendering checks are still required. Existing scene content/simulation is outside this interface patch.

---

# Nocturne private-preview foundation

This is a local stabilization candidate based on commit
`6db213fe285704f688b8a572effd13635109b7a2` from
`jnewkirk6756/freedom_server_full_suite`, branch `aurelia-staging-v012`.
It is not a deployed release or a claim that the whole product is finished.

## Run and check

Use Node.js 22 or later. The ordinary server and unit/HTTP checks need no runtime
packages and no provider credentials:

```sh
npm start
npm test
```

The default listener is `127.0.0.1:8787`. Without owner access configured, local
development can read the app shell, but backend and media routes fail closed.
The status display may therefore show fallback/offline. There are no automatic
voice, AI, or media-seeding requests at ordinary startup.

The legacy startup self-test remains in the source for reference, but is no
longer invoked by server startup. It is not the release validation procedure.

The separate browser smoke suite uses mocked backend responses and denies
external page requests:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
```

Set `CHROMIUM_PATH` only when using an existing compatible Chromium install.
The GitHub workflow runs the neutral unit/HTTP checks and browser suite with
Node 22. It has not been published or run on GitHub as part of this patch.

## Access behavior and deployment impact

This candidate intentionally changes public access. Existing publicly reachable
URLs will return an access-configuration error unless deployment setup is
completed. Do not roll it out without approving this access change first.

- `HOST` defaults to loopback. A hosted service needs `HOST=0.0.0.0` explicitly.
- `NOCTURNE_ACCESS_PASSWORD` is required for hosted access and must contain at
  least 20 characters. Username is `owner`. Use an independently chosen strong
  secret in the hosting service's secure environment configuration. No actual
  credential has been generated, saved, or configured by this patch.
- Serve the app only through HTTPS before entering any owner credential.
  HTTP Basic authentication relies on TLS; this code does not provision TLS.
- Set `NODE_ENV=production` and `NOCTURNE_PUBLIC_ORIGIN` to the exact HTTPS app
  origin. `RENDER` environments also disable the localhost preview bypass.
- The browser manages Basic authentication. It is never embedded in frontend
  code, a URL, localStorage, or sessionStorage. There is no account system or
  reliable in-app Basic-auth logout. Use a separate browser profile on shared
  computers and close that profile when finished.
- `/v1/health` and `/robots.txt` remain reachable without sign-in. Health output
  reports build/capability metadata, not credential values or user records.
- Shared media changes and startup seeding are disabled by default. Enabling
  `NOCTURNE_ALLOW_SHARED_MEDIA_WRITES=1` also requires configured owner access.
  Do not enable it until the remaining storage issues below are resolved.
- Authenticated responses and all access denials use `private, no-store`.
  Private app pages deliberately do not get offline shell caching. Local
  credential-free shell caching does not make provider requests work offline.

This is a single-owner preview boundary, not multi-user authentication. It does
not provide user accounts, individual permissions, MFA, password reset, or a
global provider-spending cap. Renewed sessions can still reset per-session
limits. Keep provider cost limits configured separately before live use.

## What changed

- Repeatable root startup/test commands, locked browser-test dependency, and a
  proposed CI workflow.
- Navigation regression assertions describe routes and asset relationships
  instead of freezing an old release number.
- Script/navigation cache refresh is network-first, with last-good local
  fallback and no replacement of cached pages by failed responses.
- Access failures cannot be hidden by stale cached pages.
- Browser storage failures use temporary page memory with a visible warning.
  Native saved data is left intact; temporary fallback changes do not survive
  a reload or page transition.
- Per-tab UI snapshots reject malformed, oversized, future-dated, or expired
  values. Drafts and bounded text/scroll restoration remain covered.
- Automatic startup provider calls are removed. Shared media writes are gated.

## Required checks before calling this a release

1. Review/apply this patch to the pinned source and run `npm test` on the exact
   proposed commit. Publish only with explicit approval.
2. Run `npm run test:browser` successfully on normal desktop Chromium; then
   verify real iPhone Safari/Android Chrome and the target Quest browser.
   Check keyboard/viewport overlap, More-menu scrolling, back/forward,
   portrait/landscape resize, offline transitions, and XR entry/exit.
3. Decide and approve hosted access/TLS/environment changes. Verify both a
   signed-out browser and a signed-in browser against the actual preview URL.
4. Separately authorize live provider validation. Verify normal chat, timeouts,
   error messages, voice, and cost limits. No provider key was reused or created
   and no live provider response was tested here.
5. Reconcile the avatar assets. Prior project history records 30 of 40 supplied
   states with the fourth grid missing; these assets were not available in this
   source checkout. This patch does not invent or certify missing images.
6. Before shared/cloud media writes, repair/test Redis TLS/auth/database
   handling, total-capacity enforcement, and user/owner namespacing. Current
   media storage remains global per state and is a staging cache, not durable
   account sync or a backup.

The pre-existing feature/runtime modules are not certified by these neutral
foundation tests. Existing BFCache restoration intentionally reloads because
the screen runtimes destroy themselves on pagehide and lack a resume hook.
