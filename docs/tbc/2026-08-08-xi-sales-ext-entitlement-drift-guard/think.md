---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T02:48:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 9
hypotheses: 1
---

# THINK — Sales Coach extension: lock the entitlement-gating invariant with a drift guard

(Build `xi` — post-9 daily builds sort after `x9` as xa..xi.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) recomputed this session, unchanged. The cited axioms were
re-read this session during the preceding xg/xh builds (same continuous session, <45 min ago); methodology in
the tree (A19), cited from content (A22).

## 2. The verified invariant, and why prose isn't enough (§0 → A30)
This session I read every sales extension tool route (summarize/dissect/coach/copilot/formulate) and the shared
`guardExtensionRequest` → `requireEntitledExtensionUser`. The invariant holds TODAY: all 5 gate server-side
(IP guard → Bearer + entitlement → per-user rate limit); `refresh` is unauthenticated by design (the expired
access token means the refresh_token itself is the credential). Enforcement is correct: unentitled → 402,
removed account → 403, bad token → 401, never trusts the client.

But the invariant is locked only by (a) the per-route 402 tests, which cover each CURRENT route, and (b) my
having read them. Nothing stops the NEXT route — a sixth tool added under coach/extension — from shipping
WITHOUT the gate. That is a billing/security hole (anyone with a valid Supabase token, entitled or not, burns
the paid AI tools), and A30 is explicit: a fix/known-invariant that lives only in prose + memory returns; the
boundary of the class is the GATE that prevents the next instance, not the last verified one.

## 3. The guard (§1.5.2 proactive + A30 gate-the-class)
A source-level drift guard in `salesExtensionConfigWiring.test.ts` (which already enumerates the routes via
readdirSync for the tool↔route wiring check): for every built `route.ts` under coach/extension, assert it
contains `guardExtensionRequest` OR is in an explicit `UNGATED_BY_DESIGN` set (`refresh`, with its documented
reason). Mirrors the existing both-directions wiring drift guard already in the file — same shape, a security
invariant instead of a wiring one. A new ungated tool route now fails CI; a new genuinely-unauthenticated route
forces a conscious entry in the exempt set (with the reason), rather than slipping past silently.

## 4. Interconnection trace (holistic)
- No route/behavior change — this is a test-only addition. The routes themselves are untouched.
- The exempt set (`refresh`) is load-bearing and PROVEN so: `refresh/route.ts` contains `guardExtensionRequest`
  zero times, so without the exemption the assertion fails on it — which demonstrates the guard genuinely
  detects an ungated route (detection-tested by construction, not a tautology).
- Companion to the existing reverse-drift guard (route → tool OR documented non-tool); this adds route → gated
  OR documented-ungated. A new non-tool route must now satisfy BOTH.

## 5. Hypothesis (§1.5.2)
- **H1:** the guard passes for all 6 current routes AND would fail an ungated one. Confirm: run it (6 pass:
  5 gated + refresh exempt), and prove detection via `refresh` lacking the guard string (grep = 0) so the
  exemption is load-bearing. **Held.**

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T02:52:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — read the actual guard chain before asserting it's enforced or locking it.", "how_this_build_will_embody_it": "Section 2 traces guardExtensionRequest→requireEntitledExtensionUser before adding the guard." },
  { "id": "§0.1", "read_at": "2026-08-08T02:52:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, hashes recomputed.", "how_this_build_will_embody_it": "Section 1 records the sha256 MATCH." },
  { "id": "§1.5.1", "read_at": "2026-08-08T02:53:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 (structure): the security invariant must be structurally enforced, not discretionary.", "how_this_build_will_embody_it": "The guard makes entitlement-gating a structural CI check for every future route." },
  { "id": "§1.5.2", "read_at": "2026-08-08T02:53:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — convert the verified invariant into a guard rather than leaving it in prose.", "how_this_build_will_embody_it": "The gate is the proactive follow-up to reading-and-confirming the routes gate today." },
  { "id": "§6", "read_at": "2026-08-08T02:54:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist — 'is this fix a gate or a promise?'", "how_this_build_will_embody_it": "This build answers it: a gate, detection-proven." },
  { "id": "A19", "read_at": "2026-08-08T02:57:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-476", "why_it_governs": "Methodology in the tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms opened this session." },
  { "id": "A22", "read_at": "2026-08-08T02:56:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-621", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a real read timestamp." },
  { "id": "A30", "read_at": "2026-08-08T02:55:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-789", "why_it_governs": "THE governing axiom here — a lesson in prose returns; encode the class in a gate that fails without the author.", "how_this_build_will_embody_it": "The entitlement invariant, verified by reading, is now a CI gate that fails on the next ungated route." },
  { "id": "A38", "read_at": "2026-08-08T02:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1020", "why_it_governs": "'Verified' = the canonical command by name, with its output.", "how_this_build_will_embody_it": "check.md pastes `npm run check` + exit code; the targeted run is pasted too." }
]
```
