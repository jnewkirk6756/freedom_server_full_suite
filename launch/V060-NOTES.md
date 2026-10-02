# Nocturne 0.60.0 — Devices and geometry

## Shipped implementation

The shared navigation adds Devices between Live and VR. The single root URL still opens Anna Home. No provider settings, account tables, voice logic or character-model parameters were changed by this package.

The Devices screen saves up to 100 browser-local tool profiles. Each profile records a name, length, maximum diameter, usable travel, color, material, texture, shape, finish and notes. Display units are millimeters or inches; stored dimensions use millimeters. The material menu has 15 descriptive categories, including silicone, TPE, TPR, TPU, rubber, plastics, glass, steel and other/unspecified. Texture has seven categories. Shape has cylinder, rounded and tapered; finish has matte, satin and gloss. These are descriptions, not material certifications or physiological predictions.

Profiles can be edited, duplicated, deleted, selected, exported and imported. Imports validate dimensions, enums, color, schema, duplicate IDs and size limits; they merge with new IDs rather than replacing the existing library. Only device profiles are exported, not conversations. A stale storage revision is rejected. Browser-local storage is not account synchronization or end-to-end encrypted cloud storage.

The non-graphic geometry preview shows a reference origin, target marker, dimensioned silhouette and side/top/isometric projections. Pitch and yaw define the actual path orientation. Tool color, outline and texture markings follow the selected saved profile. The direction indicator distinguishes forward, return and still. Speed, active depth and target depth are separate readouts. Speed is calculated in mm/s or in/s when dimensions are provided; otherwise the preview uses percentage units and says unmeasured.

On Live, a read-only observer attaches to the existing session object. It reads the actual phase and does not run an independent movement clock. The previous decorative trajectory and waveform remain as hidden legacy nodes for compatibility; the visible geometry and displacement curve share one phase. Idle stays at the reference origin, zero target produces zero travel, and Hold pauses the actual session through its existing pause control. Device changes pause and reset the preview. Visibility/page changes pause rather than advancing unseen motion. Readouts stay visible independently of the old trajectory toggle.

Live pitch uses the existing approach-angle field, while yaw is exposed on the geometry card. The Devices inspection preview also has pitch, yaw, target travel and cycle-duration controls. Inspection does not unlock Live, alter Anna or send commands to physical hardware. Custom preview curves are clamped and closed at the reference origin; no claim of sensor or actuator equivalence is made.

## Validation performed

- All new JavaScript modules and the modified live-engine module passed local Node syntax checks.
- 18 Node regression tests passed: conversions, invalid dimensions, metadata validation, idle/zero/paused positions, target bounds, speed units, angle vectors, custom-path bounds, import validation, storage/revision behavior, clock refresh-rate equivalence and hidden-gap behavior.
- 12 isolated Chromium DOM checks passed: initial idle state, profile saving, restoring a serialized profile in a fresh document, preview play/pause, zero target, 390px layout without horizontal overflow, Live adapter idle, visibility independent of the old toggle, Hold pausing a session fixture, pitch source, shared phase and absence of JavaScript errors.
- The environment blocked browser URL navigation. Browser checks used injected local source and mock storage in isolated documents, not a network-loaded app or a physical iPhone/Quest.
- Local blob hashes were compared to the uploaded core/view/UI/adapter and live-engine versions.

## Remaining checks and scope limits

Test the deployed page on the actual iPhone: Devices -> New tool -> Save -> select -> Live -> verify origin, Start and Hold. Voice is unchanged and remains unverified on the phone. Quest-specific geometry integration, real hardware control and account-based cross-device syncing are not part of this release. Calculated positions/speeds are not measurements of physical movement, sensations, force or safe-use limits.

Run the pure regression suite with: `node --test test/device-core.test.mjs`.
