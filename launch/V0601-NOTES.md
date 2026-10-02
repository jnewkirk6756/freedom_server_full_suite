# Nocturne frontend patch 0.60.1

## Changes

- Devices includes sticky, standard HTML Back to Live and Home links. They work without page JavaScript. The shared bottom navigation remains unchanged.
- New libraries default to inches. Old libraries using the previous metric default display in inches without changing any stored lengthMm, widthMm or travelMm values. A displayUnitsVersion marker preserves subsequent explicit unit choices; millimeters remain selectable.
- Tool cards show up to three decimal places rather than rounding a 1.25-inch dimension to a tenth. The editor still uses its previous five-decimal conversion precision.
- A Live controls test switch appears on the Live screen and in its setup dialog. It bypasses only the preview relationship gate on the staging host (or local development), only on /live/, only in that browser tab, and for two hours. It does not change Anna's scores, events, memory, or identity.
- Entry, restore, exit and expiry leave/pause motion rather than auto-starting. Start remains explicit. Normal rules return on exit. The bypass does not grant access on VR or other hosts.
- Faster, Slower, More and Ease are deterministic local commands while testing. Other test messages explain that Anna chat remains on Home. The test does not invoke model response APIs.
- Mobile/controller output and bridge publication are suppressed during controls tests, including after an expired test until explicit exit. This mode tests UI/geometry, not voice, physical hardware, or character behavior. Ordinary chart/UI persistence remains shared; this is not a separate account or a reset of normal chart history.
- No provider credentials, deployment settings, account data, or Home voice implementation were changed. The host status version is still 0.60.0; the Devices and Live bridge frontend modules identify this patch as 0.60.1.

## Checks performed locally

All six changed JavaScript modules passed Node syntax checks. Sixteen regression tests passed, covering inch defaults, legacy display conversion with no resizing, explicit metric preference, save/reload conversion, unchanged source storage on read, geometry units, test enable/exit, host/route isolation, expiry, malformed flags, unchanged Anna data, no hardware bridge publication, bounded local commands, output suppression and static return links.

Eleven Chromium fixture checks passed: enable from setup, no automatic start, Start with low relationship score, local Faster/no provider call, intercepted test Send, Hold, restored normal gate on exit, unchanged Anna data, return-link visibility without JavaScript and while scrolled, inch default markup. Browser URL navigation was blocked in this environment. These used an injected DOM fixture with mock storage/location and the exact new bridge source, plus Tool markup; they are NOT network-loaded full-app or physical iPhone/Quest checks.

All seven uploaded file blob hashes matched the locally checked files.

## Phone test

Refresh the app. Open Devices and confirm Back to Live / Home and Inches (US). On Live select Use Live controls test from setup, or Enable Test Mode in the Live controls test panel. Press Start Live, then Hold; change target/angle in Advanced. Exit Test Mode to restore ordinary relationship gating. Voice and hardware still need separate device testing.
