> Historical module notes. For current startup, access controls, validation and release limits, use [the root README](../README.md).

# Aurelia 0.19 — Spatial Rooms

Run `node launch/server.mjs`. Existing free read-only staging host; private account writes and live AI remain disabled.

- `/world/`: actual procedural 3D bedroom, bathroom and living room, with controller-ray menus and a keyboard inside immersive WebXR.
- `/app/`: existing Studio with guided appearance dropdowns and one-character new free-plan limit.
- `/player/`: reviewed local video player retained from 0.18.

Inside spatial mode: switch rooms, light mood, create/rename a character, select appearance traits, edit selected About You fields, save/load loop-generation drafts, select/review/play saved local clips, recenter controls, and end VR. File picking/export exits immersive mode for system dialogs. Not every production application feature exists: live AI, actual generation and account sync are still unconnected.

Rooms use genuine meshes, approximate shading and procedural surfaces. Optional 4096-by-4096 surface texture is real; it is NOT a photoreal 4K room pack or a promise of 4K per-eye rendering. This is the first functional room-art pass. Physical Quest/controller testing remains outstanding. Browser tests use real WebGL with synthetic storage and synthetic XR events; network blocked.

New free character creation is capped at one. Existing multiple beta characters remain accessible. No payments, provider calls, credentials or recurring infrastructure were activated.

Loop recipes are saved as DRAFT_NOT_SUBMITTED, never passed off as completed videos. No avatar footage is prepopulated. Device data stays private to the browser and independent backups remain necessary.

Rollback: aurelia-rollback-v018-before-spatial at e1117fe154d0fa9b22d870238888e35c9dbc7837. Mac Freedom/Omega, repo main and original raw.githack preview remain unchanged.
