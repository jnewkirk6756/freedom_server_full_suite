# Aurelia 0.12 read-only staging host

This isolated deployment serves the existing device-local preview plus explicit readiness and backup controls. It is NOT the private account backend. No auth store is opened; all write APIs respond STAGING_READ_ONLY. No OpenAI credential is loaded and no AI calls are made.

Run: `node launch/server.mjs`
Render: Node runtime, free plan, build `node --check launch/server.mjs`, start `node launch/server.mjs`, auto-deploy disabled. Source parent: db2dd82ca101a7e639b961e3c9b4338fd71f51aa. Do not change Freedom main or the existing preview branch.

Private backend source, guard tests and offline account/media snapshot tooling are in `/Aurelia_Platform/01_SOURCE/AURELIA_V0.12_SOURCE.zip` in the owner's Library. That backend is not deployed by this staging branch. Real AI, durable storage and authenticated account sync remain pending.

Device backups contain private data, are not encrypted, and must not be uploaded to public source control. Restore only into an empty browser. Full browser automation was blocked by administrator policy; do not claim it passed.
