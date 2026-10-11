# Mobile shell and neutral viewer interruption audit

Local candidate, 2026-10-11. Based on the exact source tree published at PR #14
head `99e5b061000933b94977c834519e5bc378907082`:
`6b4ef0a2469cb5fcc904a5f7be970fe76ac889d4`.
The matching local source commit was `f617b416e8743a5e64f25fc42626ce3844ada885`.

## Reproduced defects and changes

1. **Landscape touch keyboard.** At an 844 × 390 layout with a 190px visual
   viewport, a focused navigation search reported a 200px keyboard inset but
   did not activate keyboard placement. Detection had been limited to 600px
   layout width. The policy now recognizes coarse-pointer devices, and its
   keyboard-placement CSS also applies in landscape. Ordinary fine-pointer
   desktop resize behavior is unchanged.
2. **Pinch zoom with a focused field.** A smaller visual viewport at scale 2
   was treated as an on-screen keyboard. The policy now checks visual scale
   before applying keyboard positioning.
3. **Graphics restoration while suspended.** The neutral viewer could stay in
   `starting` with disabled controls if a context-restored event arrived after
   pagehide and before pageshow. On return, pending initialization now resumes.
   Shape, surface and transform choices are preserved; suspended pages do not
   start drawing.

The three new regression tests failed against the unmodified source and pass
with these changes. The archived BEFORE log records those failures.

## Verification

- `npm test`: **152/152 PASS** with Node 24.19.0. This is the supported root
  unit/HTTP suite, including all existing access and private-cache checks.
- Added coverage for third-touch rejection, transition from two touches to one,
  pointercancel/lost capture, blur/visibility/pagehide/context interruption,
  repeated graphics recovery, accessible disabled state and status text,
  changing system reduced motion, and old XR setup completion/rejection after
  a replacement session has already become active.
- Existing native neutral scale-range browser assertions are retained.
- New browser helper covers synthetic visual viewport shrink and zoom at each
  existing viewport, navigation/menu bounds, reachable search, repeated Close
  and Escape, and focus restoration. The original visual viewport is restored
  at the end of each check.
- `node --check` passed for all changed JavaScript/test files.
- `git diff --check` passed.

## Verification limits and release gates

Local Chromium could not start: its process-singleton socket was rejected by
this executor (`Operation not permitted`), including one permitted escalation
retry. **No new browser suite pass, screenshots or real-hardware pass is claimed.**
Run `npm run test:browser` in an approved Chromium-capable environment/CI on the
final reviewed commit. Real iPhone Safari, Android and Quest checks remain
necessary. The synthetic lifecycle/viewport tests do not emulate the OS keyboard,
physical touch, an actual screen reader, raster output, or headset hardware.
The shared navigation still reloads on a persisted pageshow/BFCache return.
Transform preservation above is a module-level restoration assertion, not a
claim that unsaved transforms survive real browser Back navigation or reload.

The XR lifecycle audit found no new production-core defect in the tested stale
setup/replacement-session flows. Those additional tests pass without changing
XR production code.

No provider calls, owner-password setup, credential/configuration changes,
cache-policy changes, asset rewrites, merge or deployment occurred. This
candidate does not establish a fix for unspecified legacy sliders, missing
saved face assets, or an unidentified live-page crash. It is not yet live and
requires independent review before publication.
