---
tbc_version: 1
trigger: fix
started_at: 2026-08-11T17:45:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 2
---

# THINK — Audit every signed-upload "sign" endpoint (bearer-capability surface); fix the one CWE-209 leak

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes unchanged.

## 2. Why this audit (§1.7 ground-up, §1.5.2 proactive)
F2 added the third and fourth signed-upload "sign" endpoints to the app. A signed upload target is a **bearer
write-capability the moment it is minted** (the token authorizes a PUT to a specific object, independent of the
later finalize) — the `reference_signed_url_ungated_bearer_capability` lens. So the correct sweep after F2 is:
does EVERY sign endpoint mint a target only behind a gate at least as strong as its finalize, and only under
the CALLER's own tenant prefix? The full surface (via `createSignedUploadTarget` callers):

| Sign endpoint | Auth gate | companyId source | Mint-error handling |
|---|---|---|---|
| `care/conversations/[id]/upload/sign` | x-care-session token → conversation | `conv.companyId` (server) | log + generic ✓ |
| `care/conversations/[id]/agent-upload/sign` | requireCareAgent + company match | `auth.companyId` (server) | log + generic ✓ |
| `coach/sales-session/[id]/upload-recording/sign` | owner-or-manager (INV19) | `getCurrentCompanyId()` (server) | log + generic ✓ (F6) |
| `files/upload-url` | `getCurrentAuthContext` (authed) | `auth.companyId` (server) | **returned `target.error` RAW** ✗ |

## 3. The finding (confirmed by reading all four)
- **Tenant safety: CLEAN across all four.** Every endpoint derives the storagePath's companyId from
  SERVER-side auth (never a client field), and `buildStoragePath` mints a fresh `randomUUID()` object — so no
  endpoint can be steered to mint a target under another company's prefix or overwrite an existing object. The
  finalize prefix-check is a second layer, but the mint itself is already tenant-safe.
- **One real defect — `files/upload-url:68`** returned `{ error: target.error }` RAW. `createSignedUploadTarget`'s
  error string can carry backend/storage-config detail (e.g. "bucket does not exist — create it via the
  Supabase Dashboard…" or the raw Supabase message). That is the CWE-209 class the three sibling sign
  endpoints already guard (log raw, return generic). This older route was the un-updated instance — the **A16
  apply-here-miss-there** pattern. Authenticated-agent-only, and the leaked string is a config hint not a
  secret, so **LOW severity** — but a real, in-class inconsistency.
- **Detection blind spot (residual):** the `no route returns a raw error to the client` invariant PASSES on
  this line because it keys on `.message`, not a custom `{ ok:false, error }` field. So the invariant did not
  and would not catch this class of leak.

## 4. Record check (§1.2 — a finding is a SUSPECT, not automatically a fix)
Is the raw return intentional? No: the log-raw-return-generic posture was established AFTER this route
(recording-sign F6 + the F2 sign endpoints, both 2026-08-11). `files/upload-url` simply predates it. The
record supports aligning it, not preserving a deliberate exception.

## 5. The fix
Mirror the sibling sign endpoints: `console.error` the raw cause (with companyId for triage), return a generic
retry message + 500. Lock it with a test (no test dir existed) asserting: 401 unauth, mint under the caller's
own companyId, and generic-not-raw on mint failure.

## 6. Hypotheses (§1.5.2)
- **H1 — is the leak actually reachable?** → Yes: any storage misconfig (bucket missing / transient Supabase
  error) makes `createSignedUploadTarget` return `{ok:false, error}`, which line 68 echoed. CONFIRMED.
- **H2 — should the invariant be widened to catch `{error}` fields too?** → Tempting, but widening risks
  false-positives on every route that legitimately returns a controlled `{error: "..."}` string; that's a
  broader change needing its own care. NAMED as a residual, not done here (A33 — don't ship a noisy gate).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-11T17:45:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understanding precedes solving — read the whole sign-endpoint surface before changing one.", "how_this_build_will_embody_it": "Read all four sign endpoints + the mint primitive before concluding." },
  { "id": "§0.1", "read_at": "2026-08-11T17:45:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Governing-doc hashes verified in-tree." },
  { "id": "§1.5.1", "read_at": "2026-08-11T17:46:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — a guard on one route of a class must hold across the class.", "how_this_build_will_embody_it": "Compared all four sign endpoints; aligned the one that diverged." },
  { "id": "§1.5.2", "read_at": "2026-08-11T17:46:15Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — THINK about the bearer-capability surface, then read to confirm.", "how_this_build_will_embody_it": "Swept every createSignedUploadTarget caller, not just the F2 ones." },
  { "id": "§1.2", "read_at": "2026-08-11T17:46:20Z", "source_file": "CLAUDE.md", "line_range": "178-182", "why_it_governs": "Retrospective identification — check the record for whether a finding is intentional before treating it as a fix.", "how_this_build_will_embody_it": "Confirmed from the commit record that the generic-error posture postdates files/upload-url, so the raw return is an un-updated instance, not a deliberate exception." },
  { "id": "§1.7", "read_at": "2026-08-11T17:46:30Z", "source_file": "CLAUDE.md", "line_range": "174-205", "why_it_governs": "Ground-up auditing produces honest flags on the record; an empty flag list is itself suspicious.", "how_this_build_will_embody_it": "This build is a §1.7 audit of the sign-endpoint layer — three clean, one flagged + fixed, plus a named detection blind spot." },
  { "id": "§3.4", "read_at": "2026-08-11T17:46:45Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a raw backend string to the client is a leak, not a helpful error.", "how_this_build_will_embody_it": "The route now returns a generic, honest retry message; the raw cause goes to the log." },
  { "id": "§6", "read_at": "2026-08-11T17:47:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The decision checklist forces record-check + holistic before acting.", "how_this_build_will_embody_it": "Section 4 checks the record (not an intentional exception) before fixing." },
  { "id": "A16", "read_at": "2026-08-11T17:47:15Z", "source_file": "ThinkerThinker.md", "line_range": "40-52", "why_it_governs": "Apply-here-miss-there — the same guard must be applied to every sibling.", "how_this_build_will_embody_it": "The sibling sign endpoints' generic-error handling is now applied to files/upload-url." },
  { "id": "A19", "read_at": "2026-08-11T17:45:45Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Re-read all four routes in-tree before concluding." },
  { "id": "A22", "read_at": "2026-08-11T17:47:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-11T17:47:45Z", "source_file": "ThinkerThinker.md", "line_range": "66-72", "why_it_governs": "A found bug is a CLASS — sweep it to the codebase boundary before 'fixed'.", "how_this_build_will_embody_it": "Swept ALL four sign endpoints for the CWE-209 class, not just the reported line." },
  { "id": "A30", "read_at": "2026-08-11T17:48:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class in a test.", "how_this_build_will_embody_it": "A new test asserts generic-not-raw on mint failure + the tenant property." },
  { "id": "A38", "read_at": "2026-08-11T17:48:15Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check runs with exit codes." }
]
```
