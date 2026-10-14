# Post-render visual review companion

Source-only integration. This change does not provision keys, change credentials, activate a deployment, or make live provider calls. It uses the bridge's existing explicitly configured server credential and signed-request boundary.

## Routes and request binding

- POST `/v1/meridian/visual/review`; GET the same path plus `/ready`.
- Readiness returns the exact `meridian-visual-review-v1` protocol, configured verification key ID, and a safe failure category. It requires bridge enablement, a valid Ed25519 verification key, HTTPS audience, and a normalized nonempty provider credential. Readiness does not probe OpenAI, assert entitlement, or spend money.
- Existing signature, audience, path, expiry, payload SHA-256, and $0.10 allowance checks apply. The signed envelope job ID must equal `visualRequestId(context.jobId)`.
- The shared strict contract rejects unknown input fields. Only the original selected image, generated image, frozen requested design, allowlisted product identity/unit/quantity fields, and approved reduced measured plan go to OpenAI. Internal job/manifests/hashes, separate contact records, ZIP, prices, private estimates, and aggregate generation prompts are excluded.
- Generated image bytes must match `context.outputSha256`. The hosted service owns validation against the saved job, original frozen payload, and current authenticated owner.

## Image validation boundary

Canonical base64 decoding, MIME/container framing, dimensions, static-frame restrictions, and byte limits use the existing render validator. The original is at most 1 MiB and 2048 px per edge; the generated image is at most 8 MiB and exactly 1024 by 1024. Total JSON input is capped at 13 MiB. Frozen image bytes are not transformed.

This is container validation, not server-side decompression or verification of compressed pixel integrity. OpenAI performs actual image decoding for vision. No `sharp` dependency or external image URL fetching is introduced. This limitation is intentional and must not be described as full server-side pixel validation.

## One-dispatch and accounting

The signed source job is reserved synchronously before asynchronous validation/dispatch. A tenant/source-job pair stays reserved for the process lifetime, including rejected, failed and unknown outcomes. New nonces, elapsed signature windows and signing-key rotation cannot trigger another call in that process. A bounded capacity fails closed instead of evicting reservations. Hosted D1 owns durable one-dispatch state across restarts and must retain unknown usage holds; this in-process set does not replace it.

A successful request makes one POST to OpenAI Responses, with exactly two labelled inline image inputs, no tools, no storage, no background/streaming, and 2,200 maximum output tokens. The transport has a 45-second deadline, 64 KiB provider-response cap and 32 KiB output-text cap; it never retries. Only strict validated output is returned. Safe complete usage evidence is preserved after validation/provider failures; missing or inconsistent evidence remains null. Never infer a zero charge from null accounting.

The result contains visible-object observations, possible layout drift, limitations, and brief appearance tips. It is not an exact takeoff, product/SKU verification, construction advice or a count of hidden supplies. The hosted/UI layer decides which conservatively validated count proposals a person may approve.

## Verification

Run `node --test test/*.test.mjs`. All tests inject the provider transport and use synthetic in-memory signing keys. No test requires or reads a real API credential.

Official request shape checked against https://developers.openai.com/api/docs/guides/images-vision on 2026-10-14: the Responses user content array accepts multiple `input_image` entries with base64 data URLs.
