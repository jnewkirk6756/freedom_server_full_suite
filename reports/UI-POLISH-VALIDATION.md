# Nocturne mobile and XR interface candidate

## Provenance and scope

- Exact upstream source: PR #14 head `396ba2ee89fe893d58e2de8152eb97d78972138d`.
- Local immutable baseline: `1704534474e4f7c2ac7ade45bebfb6f50fbfc9ce`.
- All 162 tracked source blobs were matched to the upstream Git tree before edits.
- Local-only candidate. No commit has been pushed, no PR changed, and no deployment, provider request, credential or permission configuration performed.
- Safe scope is shared interface ergonomics, generic display transforms and XR lifetime handling. Existing scene geometry, simulation, provider logic, body interaction and telemetry generation remain unchanged.

## Implemented

1. Shared interface shell on every server-rendered screen: visible keyboard focus, 44px controls, readable mobile inputs, constrained scrollable dialogs, skip-to-content, compact Home card sizing, accessible Home settings focus trap and restoration.
2. More menu: searchable screen list, explicit Close, keyboard tab navigation, screen-aware current-page indication, and local display preferences for reduced interface animation and higher contrast.
3. Keyboard viewport policy: ordinary text entry can reclaim bottom-navigation space; screen search keeps its menu visible and lifts it above the keyboard. Real iOS keyboard behavior remains a hardware gate.
4. Neutral Model Studio at `/model-viewer/`: actual WebGL cube/sphere/prism geometry; normal-based lighting and matte/satin/gloss surfaces; bounded move/rotate/scale/reset controls; pointer, pinch and keyboard inputs; quality/DPR bounds; reduced-motion, interrupted input and context-loss recovery. Shape/material/quality persist; automatic motion does not resume from storage.
5. Existing XR fallback: direct user-gesture request, duplicate-entry latch, early end listener, late permission cancellation, reference-space fallback, explicit exit retry, cleanup on exit/pagehide/context loss, per-source button edges, tracking-loss cleanup and non-gamepad select handling. Display yaw/scale is elapsed-time-based with a deadzone and bounded pause delta.
6. Both offline-shell manifests include new first-party assets, retain fail-closed private caching behavior, and use a new cache generation. New routes retain the existing access boundary.

## Reference direction adopted

The supplied Grok archive was inspected as source only, never executed. Borrowed its large central viewport, compact phone-first stack, rounded dark-violet cards and expandable secondary controls. Model Studio keeps rendering options and input help in labeled disclosures. The current lifecycle/recovery implementation was retained rather than copying the reference's unmanaged rendering/session loop. No images, meshes, sexual controls or motion from the archive were imported.

## Verification

Run `npm test` for the prior 68 foundation checks plus 60 new focused checks: **128/128 pass** on Node 24.19.0 in this cloud workspace.

New coverage:
- 24 neutral geometry/viewer-core/DOM-fake-WebGL checks, including preferences persistence, pointer/pinch/cancel, keyboard/reset, resize quality, reduced motion, unavailable/retry, context recovery and BFCache lifecycle.
- 27 XR lifecycle and exact fallback-function checks with neutral rendering stubs, including refresh-rate equivalence at 30/60/72/90/120 Hz, pending grant/denial navigation, mid-setup end, repeat clicks, failed exit retry, stale frames, drift and tracking loss.
- 9 shared-shell viewport/navigation and local HTTP/access checks.
- `node --check` passes for changed JavaScript and both browser suites; `git diff --check 1704534474e4f7c2ac7ade45bebfb6f50fbfc9ce HEAD` passes for the complete candidate diff.

`npm run test:browser` retains the existing four Chromium smoke cases and adds four desktop/phone/narrow/landscape release-gate cases covering all screen navigation, settings focus, menu search, preferences and the neutral viewer. It denies external page requests and mocks backend routes. Only neutral viewer screenshots are created by the added suite.

**The candidate browser suite has not run here.** Independent review rechecked `/usr/bin/chromium`; it aborts with `socket() failed: Operation not permitted` (process_singleton_posix.cc, exit 134). No workaround was attempted around that restriction. The earlier 4/4 Chromium result belongs to upstream PR #14 CI, not this candidate.

Mocks prove state/control behavior, not visual appearance, performance, comfort or real headset compatibility. There are no candidate screenshots or measured FPS results.

## Reproduced historical test failures

Running the historically unselected `test/video-state-core.test.mjs` against a pristine archive of the exact local PR14 baseline reproduces 4 pass / 2 fail:
- `catalog contains A00-A20 plus nine alternates`: A18F and A19B order differs from the expected alternate list.
- `good vertical metadata has no quality warnings`: 8-second fixture now produces `Duration 8.0s; target is about 10s.`.

Those feature sources/tests are unchanged. Raw baseline evidence is in `reports/pr14-legacy-test-baseline.txt`. This candidate does not claim the historical entire test directory is green. The supported root test command retains prior scope and adds the new neutral checks.

## Remaining release gates

1. Independently review the final candidate diff and repeat `npm test` against that exact revision.
2. With publication approval, run the complete browser command on normal CI Chromium and inspect neutral screenshots at 320px, portrait and landscape; fix any failures before release.
3. Test real iPhone Safari and Android keyboard/safe-area/Back behavior and actual Quest controller entry, setup interruption, hand/select inputs, exit/re-entry, reference-space fallback, context interruptions and refresh-rate feel.
4. Reconcile legacy feature test expectations separately. Actual backend/provider responses and previously unavailable media assets remain unverified.
5. Merge/deploy and access/TLS configuration still require separate authorization. This candidate does not change deployment state.
