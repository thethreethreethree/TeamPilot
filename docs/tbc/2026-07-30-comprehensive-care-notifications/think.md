---
tbc_version: 1
trigger: feat
started_at: 2026-07-30T14:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 3
---

# THINK — Comprehensive module settings, pillar 3: C.A.R.E Notifications

Founder-approved full spec. Pillar 3 gives C.A.R.E a real, per-user Notifications preference. I searched
the notification infra FIRST (§1.5.2): C.A.R.E has exactly ONE push event — `notifyAssignedAgentOfCustomer
Message` (careNotify.ts), which pushes the assigned agent on a customer reply, all-or-nothing, no per-user
control. So the section is well-defined: one toggle, "notify me when a customer replies to a conversation
I'm handling," default ON (= current behavior, no silent change for anyone).

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json this session.

## 2. Why real, not a fake toggle (honesty-first, via A31)

A settings toggle that stores a value nothing reads is dead surface. So this wires END-TO-END: the pref is
read by the actual send path (careNotify) before it pushes. It is NOT a placeholder.

## 3. A34 safety (the reason it can't break)

The send path reads the pref A34-guarded: if the column is absent (migration 0204 unapplied), the select
errors and careNotify FALLS THROUGH to send — i.e. exactly today's behavior. Default value is true. Only an
EXPLICIT false opts out. So pre-apply: nothing changes; post-apply: unset users still get notified. careNotify
is already fire-and-forget + swallows errors, so even a pref-read failure can never break message handling.

## 4. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-30T14:01:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding precedes solving — I read careNotify.ts to learn there is exactly ONE C.A.R.E push event before designing the section, so the toggle maps to a real event, not an invented taxonomy.", "how_this_build_will_embody_it": "One toggle for the one real event; no speculative event list." },
  { "id": "§0.1",   "read_at": "2026-07-30T14:01:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Integrity MATCH with this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-30T14:01:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — layer 2 (does it actually work): a preference is only 'built' if the send path reads it. I traced write→store→READ-at-send.", "how_this_build_will_embody_it": "careNotify reads the pref and skips on explicit false; test-locked end-to-end." },
  { "id": "§1.5.2", "read_at": "2026-07-30T14:01:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Think then search — I grepped the notification senders + C.A.R.E events BEFORE building, which is how I found there's one event (not the multi-event section I'd have guessed).", "how_this_build_will_embody_it": "Scope set by the code (one event), not by assumption." },
  { "id": "§6",     "read_at": "2026-07-30T14:01:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — trace what a send-path change affects: careNotify is customer-facing (must not break message handling) + the migration must degrade.", "how_this_build_will_embody_it": "careNotify stays fire-and-forget; A34 guard; default true." },
  { "id": "A19",    "read_at": "2026-07-30T14:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology assets read from the working tree this session — CAT-001 defense.", "how_this_build_will_embody_it": "This-session reads across all 13 entries." },
  { "id": "A22",    "read_at": "2026-07-30T14:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "500-520", "why_it_governs": "Every cited asset paired with an in-session re-read timestamp.", "how_this_build_will_embody_it": "The manifest pairs each clause with a this-session read_at." },
  { "id": "A24",    "read_at": "2026-07-30T14:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "540-560", "why_it_governs": "Don't manufacture work — I built ONE toggle for the one real event, not a padded multi-event UI that the backend doesn't support.", "how_this_build_will_embody_it": "The section grows as C.A.R.E gains more push events." },
  { "id": "A28",    "read_at": "2026-07-30T14:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "620-645", "why_it_governs": "Precedent decides — /api/me/theme + learning-mode establish the per-user-pref-on-profiles + A34-guard pattern; this mirrors it exactly.", "how_this_build_will_embody_it": "profiles column + /api/me/care-notifications GET/PATCH + isMissingColumnError guard, same as theme." },
  { "id": "A30",    "read_at": "2026-07-30T14:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "660-685", "why_it_governs": "Encode the gate structurally — the opt-out is enforced at the send chokepoint (careNotify), not merely stored.", "how_this_build_will_embody_it": "careNotify returns early on explicit false; the toggle can't be a no-op." },
  { "id": "A31",    "read_at": "2026-07-30T14:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "700-725", "why_it_governs": "Schema-complete ≠ built — a stored pref nothing reads is dead surface.", "how_this_build_will_embody_it": "write path (route) + read path (careNotify) both exist + are test-locked (8/8)." },
  { "id": "A34",    "read_at": "2026-07-30T14:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "760-785", "why_it_governs": "Migration-coupled code must degrade, not assert — 0204 adds a column both the route and the send path read.", "how_this_build_will_embody_it": "isMissingColumnError in the route (409/degraded); the send path falls through to notify on any pref-read error; test 'STILL pushes when column missing'." },
  { "id": "A38",    "read_at": "2026-07-30T14:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "820-845", "why_it_governs": "Verified = named commands — tsc + the send-path gating test + verify:live after apply.", "how_this_build_will_embody_it": "tsc 0; careNotify 8/8; 0204 applied → verify:live 14/14." }
]
```

## 5. Hypotheses

1. One toggle maps to the one real event; wiring careNotify makes it real, not a fake toggle. (Confirmed: 8/8.)
2. A34 guard + default true = zero behavior change pre-apply and for unset users. (Confirmed by tests.)
3. 0204 is additive + safe → verify:live stays 14/14 after apply. (Confirmed.)
