# Aurelia 0.18 — Stability and Loop Deck

Run `node launch/server.mjs`. This is the read-only staging host, not the private account backend.

- `/app/`: existing Studio with guarded startup, draft autosave and recovery controls.
- `/player/`: dedicated reviewed-loop player, camera-view/pose routing and optional WebXR flat-video theater.
- `/launch-status.json`: factual host status; live AI and account sync remain false.

The player reads existing device-local character IDs and media stores. It starts paused, requires human clip review, scopes footage to the selected character, avoids recent compatible variants and reports only successful playback. Corrupt metadata opens a recovery screen without automatically deleting it. Missing media can be reattached by checksum. Personal recovery exports are not encrypted; keep them private.

The WebXR prototype renders a flat video panel. It is not a volumetric or fully 3D avatar. Physical iPhone/Quest testing is not completed. Local browser navigation is restricted in the development environment; offline component tests used synthetic storage and real Chromium video decoding, with all network requests blocked. Local HTTP and domain tests are separate evidence.

No model credentials, live API calls, paid infrastructure, payment activation or cloud account writes are included in this deployment. Private Venice V0.17 candidate code is carried separately in the owner's full source/recovery archive, not exposed by this host. Freedom main and the old raw.githack preview branch are unchanged.

Rollback source branch: `aurelia-rollback-v014-before-v018` at `78f04212cc7610f004b78923952d94704d545e5d`.
