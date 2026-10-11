# Bundled neutral portraits

Local candidate based on source tree `2e04eabcf6b8daa7c6614253b48b5d4ca42aab11`, matching the deployed PR #14 merge `76e8ae6e3f5e5fe67fb6adedbfb0fac8f2c22e4d`.

## Changes

- Two generated, fully clothed fictional-adult head-and-shoulders still portraits, visually inspected: Calm and Friendly.
- Same-origin bundled WebP assets replace the low-resolution default only after successful loading and decoding. The original embedded image remains available immediately and after a failed request.
- A native manual selector uses only the new `nocturne.builtin-portrait.v1` preference. It does not follow session telemetry. Existing imported grids continue to render above the fallback and are not changed, reset, uploaded or replaced.
- The chosen portrait is remembered across Live and the VR launcher. No animation, expression sequence or new performance states are included.
- The VR static fallback redraws after a delayed image load and invalidates the GPU texture. Its backing canvas is capped at 720×1200, resets the 2D transform before drawing, and avoids re-uploading unchanged frames. A local grid that finishes first keeps precedence.
- Fresh-device empty optional packs no longer show a missing-image warning when the new portrait is available. Actual storage, decoder and runtime failures remain visible. Failed portrait switches retain the last working image and report the failure.
- Routes use a fixed asset allowlist behind the existing owner-access policy. Service-worker handling covers only the two bundled portrait paths and retains the existing private-response purge/no-cache behavior.

## Assets

The generated PNG masters are retained separately, unchanged. WebP files use format compression only, at their original dimensions; there is no crop, retouch or resize.

| File | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| `launch/portraits/neutral-20261011.webp` | 944×1667 | 264764 | `4934955104e50e0a038c34b3e3838842d56862f1a268c92079c93c13aeead8dd` |
| `launch/portraits/friendly-20261011.webp` | 944×1666 | 228492 | `d48ee59013e7ce28a294c6b69ed7a7e8028b208c9b51797b6a384c02682bdd82` |

Both files were decoded with ImageMagick to verify the actual dimensions and visually inspected. The combined transfer size is 493256 bytes (approximately 482 KiB). The page loader fetches only the selected image; explicit shell download may cache both.

## Local validation

- Full supported `npm test`: 168/168 passed.
- Changed JavaScript syntax and diff whitespace checks passed.
- Focused tests cover fresh-device loading without IndexedDB, decode gating, request/decode failure, timeout, explicit retry, stale selections, deduplication, blocked storage, image dimensions, preserved imported-grid precedence, VR texture invalidation, DPR 1/2/3 bounded sizing, real binary HTTP responses/MIME/HEAD, owner-access/private headers and service-worker behavior.
- Independent code review found no remaining blocking scope, security or loader-race issues after the retry, MIME and diagnostics fixes.

## Browser and release gates

Local Chromium launch fails before opening a page because the execution environment rejects its process socket (`socket() failed: Operation not permitted`). One approved escalation attempt failed with the same restriction. No local browser rendering checks passed or failed: they did not run.

The updated `npm run test:browser` includes `test/portrait-browser.cjs`, with external browser requests blocked and backend responses mocked. It checks actual WebP decoding and dimensions on desktop, phone, narrow phone and landscape; manual choice and reload; VR fallback backing size; blocked IndexedDB; failed requests and recovery; and an existing synthetic local grid staying stored and in front. It captures only the neutral portrait element. Run and inspect these checks in CI before merge or deployment.

Physical iPhone/Android browser and Quest behavior remains unverified. No providers, live AI, credentials, security settings, account permissions, existing simulation or anatomy modules were changed or tested by this work. Home video behavior is separate and unchanged.
