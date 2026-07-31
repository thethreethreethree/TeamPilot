---
tbc_version: 1
trigger: fix
started_at: 2026-07-31T10:39:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — auth-gate the close-the-loop route (diagnosis/close)

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json.

## 2. Trigger (Rule 1.2 — retrospective, from the record)

A no-auth-route sweep over `src/app/api` (mutation routes lacking any auth check) surfaced
`diagnosis/close` as one of eleven candidates. Ten resolved cleanly under §0: the four `ai/*`
routes are deprecated static stubs (`POST()`, no `req`, no LLM); `care/durability-sweep` and
`diagnosis/task-overrun-sweep` are shared-secret-gated (the grep missed the custom header);
`care/extension/refresh` is intentionally credential-is-the-token + rate-limited; `pilot/validate`
and `llm/ping` are public by design.

`diagnosis/close` did NOT resolve: it uses the cookie-bound `createClient()` (not admin) with **no
`auth.getUser()` check**, then calls `close_problem()` which writes to the append-only
resolutions + events chain (Rule 3.1 — the immutable spine of the whole method).

## 3. Why it was safe TODAY (understanding earned before the fix — §0)

Verified live against the DB catalog, not assumed:

- `close_problem` is `prosecdef = false` → **SECURITY INVOKER** (runs as the caller, RLS applies).
- Its first statement is `select company_id into v_company_id from problems where id = p_problem_id`.
  Because the function is INVOKER, that SELECT is RLS-filtered. For an **anon** caller (auth.uid()
  null) or a **wrong-company** caller, `problems` RLS (verify:live confirms it is company-scoped,
  not `using(true)`) returns no row → `v_company_id` is null → the function `raise`s and writes
  nothing. It fails closed.

So there is no live hole. This is a LATENT-fragility finding, not an active leak.

## 4. Why it still must be fixed (Rule 1.5 holistic + the known class)

This is the previously-audited **"RLS-only mutation route = latent tenant gap"** class
(`reference_rls_only_route_is_latent_tenant_gap.md`): the route carries ZERO defense of its own.
Two one-line changes elsewhere turn it into anon cross-tenant injection into the immutable event
chain, with no route-layer backstop:

1. a `createClient()` → `createAdminClient()` refactor (service role bypasses RLS), or
2. a `close_problem` → SECURITY DEFINER change — and its finance-fn siblings in this very DB
   ALREADY are DEFINER, so this is the house style, not a hypothetical.

Sibling-asymmetry (the `reference_dead_surface_hides_silent_gap` lens) makes it concrete: the three
OTHER diagnosis mutation routes all gate — `outside-view` + `ripple-trace` via `getCurrentCompanyId`
after an `auth.getUser()` 401, `task-overrun-sweep` via a shared secret. `close` — the most
sensitive of the four (it writes the resolution + emits the closing event) — is the lone exception.

## 5. Hypothesis (single, high-confidence)

**H1:** Adding the sibling's exact `auth.getUser() → 401` gate to `diagnosis/close` closes the
latent anon path with zero behavioral change for the real caller.

Confirmation evidence: the only non-test caller is `src/app/dashboard/diagnose/page.tsx:322`, an
authenticated dashboard page → the gate is a no-op for it (§1.5 — traced the caller before acting;
no workflow breaks).

## 6. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-31T10:40:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",    "why_it_governs": "Understanding precedes solving — I verified close_problem's actual security model live (prosecdef=false, RLS-filtered SELECT) before concluding it was safe, rather than assuming a hole from the missing route check.", "how_this_build_will_embody_it": "think.md section 3 earns the safe-today claim from the live catalog; the fix targets the diagnosed latent-fragility, not a phantom active leak." },
  { "id": "§0.1",   "read_at": "2026-07-31T10:40:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",    "why_it_governs": "Methodology must be in the working tree and read this session, not cited from cached labels.", "how_this_build_will_embody_it": "Doc integrity MATCH recorded in section 1; every manifest read_at is this session." },
  { "id": "§1.5",   "read_at": "2026-07-31T10:40:00Z", "source_file": "CLAUDE.md", "line_range": "127-138",  "why_it_governs": "Holistic — trace what the change affects before committing: I enumerated the single non-test caller (authenticated dashboard) so the new 401 branch breaks no workflow.", "how_this_build_will_embody_it": "section 5 confirms the caller; the gate is a no-op for it." },
  { "id": "§1.5.1", "read_at": "2026-07-31T10:40:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",    "why_it_governs": "Four layers — a security gate that saves (layer 2 works) but blocks a legitimate flow (layer 3) is a net regression; I traced continuity first.", "how_this_build_will_embody_it": "The real dashboard flow is unchanged; only the anon/defense-in-depth path changes." },
  { "id": "§1.5.2", "read_at": "2026-07-31T10:40:00Z", "source_file": "CLAUDE.md", "line_range": "139-160",  "why_it_governs": "THINK then search — I hypothesised the no-auth sweep's candidates could fail or be safe-by-design, then read each of the eleven before flagging the one that didn't resolve.", "how_this_build_will_embody_it": "section 2 records why ten resolved cleanly and only close did not." },
  { "id": "§3.1",   "read_at": "2026-07-31T10:40:00Z", "source_file": "CLAUDE.md", "line_range": "257-266",  "why_it_governs": "Events are immutable and append-only — the route writes the resolution + emits the closing event, so an anon-writable path here corrupts the immutable spine the whole method derives from.", "how_this_build_will_embody_it": "The gate ensures only an authenticated caller can append to the resolutions+events chain." },
  { "id": "§6",     "read_at": "2026-07-31T10:40:00Z", "source_file": "CLAUDE.md", "line_range": "352-372",  "why_it_governs": "Checklist — is the constraint real, have I traced the holistic effect, am I explaining the why: all run before this fix.", "how_this_build_will_embody_it": "The commit + closure state the why (latent-class, sibling-asymmetry) and the traced blast radius." },
  { "id": "A19",    "read_at": "2026-07-31T10:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58",  "why_it_governs": "The governing methodology assets were read from the working tree this session, not recalled from cached labels.", "how_this_build_will_embody_it": "This-session read_at across all 11 entries." },
  { "id": "A22",    "read_at": "2026-07-31T10:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74",  "why_it_governs": "Constitutional citations without session-reading are undetected violations — the § in my code comments + docs each get a manifest entry.", "how_this_build_will_embody_it": "This manifest + the commit's Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-07-31T10:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "91-93",  "why_it_governs": "A fix is not complete until the class is encoded in a gate that fails without the author's cooperation — or the gate is explicitly declined with the hole named.", "how_this_build_will_embody_it": "The anon-401 detection test is the gate; closure.md explicitly declines the broader RLS-only-route sweep as a named residual (A33)." },
  { "id": "A38",    "read_at": "2026-07-31T10:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96",  "why_it_governs": "'Verified' is a claim about a command actually run — assurance words must sit beside pasted output + an exit code.", "how_this_build_will_embody_it": "check.md pastes the vitest 6-of-6 output at exit code 0." }
]
```
