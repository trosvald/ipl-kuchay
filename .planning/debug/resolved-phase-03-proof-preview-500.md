---
status: awaiting_human_verify
trigger: "Investigate the Phase 03 proof preview failure: browser POST to /functions/v1/get-proof-signed-url returns 500."
created: 2026-04-30T00:00:00Z
updated: 2026-05-03T00:12:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Fix has been applied in get-proof-signed-url; need real workflow verification that preview now succeeds for legacy prefixed proof_path records.
test: Confirm function strips optional `payment-proofs/` prefix, passes normalized key to createSignedUrl, and normalizes local signed URL host.
expecting: no `payment-proofs/payment-proofs/...` lookup; existing `payment-proofs/...` rows resolve to valid object key and endpoint no longer returns 500 for this root cause.
next_action: user verifies proof preview in actual UAT flow for previously failing submission.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Proof preview endpoint returns a signed URL for existing proof and browser can render preview.
actual: POST /functions/v1/get-proof-signed-url returns 500 with {"error":"Object not found"}.
errors: "Object not found" returned by get-proof-signed-url for submission 8b12c90f-8fe6-45c1-a559-e8cc7db503f9.
reproduction: Invoke get-proof-signed-url for submission 8b12c90f-8fe6-45c1-a559-e8cc7db503f9 where payment_submissions.proof_path is payment-proofs/uat-seed-proof.jpg.
started: Observed during Phase 03 UAT proof preview flow.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-30T00:00:00Z
  checked: UAT symptom report
  found: Endpoint fails with 500 and "Object not found" while proof_path includes `payment-proofs/` prefix.
  implication: Likely mismatch between stored path format and storage object key expected by createSignedUrl.

- timestamp: 2026-04-30T07:51:38Z
  checked: supabase/functions/get-proof-signed-url/index.ts
  found: Function calls serviceClient.storage.from("payment-proofs").createSignedUrl(row.proof_path, 300) without normalizing `row.proof_path`.
  implication: Any DB value including bucket prefix (e.g. `payment-proofs/...`) is treated as wrong key and returns "Object not found".

- timestamp: 2026-04-30T07:51:38Z
  checked: lib/storage.ts and supabase/functions/attach-payment-proof/index.ts
  found: Canonical proof paths are key-only (`proofs/{user}/{invoice}/{submission}.{ext}`), not bucket-prefixed; attach endpoint validates this pattern.
  implication: Existing prefixed records are legacy/data-shape drift; signed-url function should defensively normalize for backward compatibility.

- timestamp: 2026-04-30T07:51:38Z
  checked: supabase/functions/get-report-output-signed-url/index.ts
  found: Report flow includes signed URL host normalization for local runtimes (`kong` / `supabase_edge_runtime_*`) after URL creation.
  implication: Host normalization addresses caller reachability, not storage object lookup; it does not explain current 500 but may still be worthwhile parity improvement.

- timestamp: 2026-05-03T00:12:00Z
  checked: supabase/functions/get-proof-signed-url/index.ts
  found: Function now normalizes proof path via `normalizeProofPath()` (`payment-proofs/` prefix stripped), uses `normalizedProofPath` in `createSignedUrl`, and normalizes signed URL host for local callers.
  implication: Confirmed code-level fix directly addresses the double-bucket lookup root cause and includes local-host parity hardening.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "payment_submissions.proof_path for affected submission includes `payment-proofs/` bucket prefix, but get-proof-signed-url passed it directly to createSignedUrl on bucket `payment-proofs`, causing lookup of a non-existent object key and returning `Object not found` (surfaced as 500)."
fix: "get-proof-signed-url now strips optional leading `payment-proofs/` from proof_path before createSignedUrl, and also normalizes signed URL host for local runtime callers."
verification: "Static verification complete: function computes `normalizedProofPath` and uses it in storage signed URL generation; this removes the double-bucket key path. Pending human verification in real UAT flow."
files_changed: ["supabase/functions/get-proof-signed-url/index.ts"]
