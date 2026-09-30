# Aurelia 0.13 read-only staging

The Render preview serves the existing device-local application plus explicit launch status, personal-device backup controls and 0.13 polish. It NEVER opens the private account store, reads an OpenAI credential, or makes an AI request. All account/photo/AI write APIs remain closed.

0.13 adds local About You text autosave, older local-media lookup, mobile/desktop navigation fixes, keyboard focus, and explicit AI-unconnected wording. Consent switches still require Save. The original preview and Freedom main branches remain unchanged.

Render service: aurelia-staging, free plan, Virginia, manual deploy. Start `node launch/server.mjs`. The hosting URL is https://aurelia-staging.onrender.com . Render deploy state must be checked separately from browser functionality.

The PRIVATE backend candidate is a different build: `/Aurelia_Platform/01_SOURCE/AURELIA_V0.13_PILOT_CANDIDATE_SOURCE.zip` in the owner's Library. It adds explicit per-message photo selection, context preview, repeat-request receipts, owned session controls and profile revision checks. It is not deployed by this staging service. Do not mark live AI or account sync ready based on this preview.

Device backups contain private data, are NOT encrypted, and must not be committed or uploaded publicly. Restores require an empty browser. The local HTTP staging test checks route contracts with an HTML fixture; browser automation and physical phone/Quest validation are separate, not passing by implication.
