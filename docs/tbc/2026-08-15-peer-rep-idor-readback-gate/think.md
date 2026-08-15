---
tbc_version: 1
trigger: fix
started_at: 2026-08-15T09:00:00Z
doc_hashes:
  CLAUDE.md: 3325eedc1e905b2798d196dae087664e3da7031a66005b1f89379b6da959a9e3
  ThinkerThinker.md: 19d6ff103082c1f29ee98653b84cce2a26308352511756f6e104a8db36df84c9
manifest_entries: 12
hypotheses: 1
---

# THINK — peer-rep IDOR on coaching-artifact readbacks

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (3325eedc…) + ThinkerThinker.md (19d6ff10…) in-tree; hashes equal the current
DOC_MANIFEST.json. This fix does NOT amend the constitution, so the hashes are unchanged.

## 2. Why (from the record §1.2) — the finding
The full Sales-Coach audit (2026-08-15) surfaced a MEDIUM IDOR: three GET readback routes
return a session's stored coaching artifacts by filtering `events` on `kind` + `subject =
sales_session:<id>` ONLY, with no ownership check. The `events` table RLS is company-wide
(migrations 0004/0103), so a same-company PEER rep who supplies another rep's session id
reads that rep's private dissect / growth-review / factual-summary. The founder selected
"Peer-rep IDOR only" to fix.

- `dissect/route.ts` GET `?sessionId=` — reads `coach.dissect_generated`.
- `review/route.ts` GET `?sessionId=` — reads `coach.sales_review_generated`.
- `[id]/summarize/route.ts` GET — reads summary/moments/pivot/intel by `sales_session:<id>`.

The POST handlers of all three ALREADY gate with `getSession()`; only the read-back GETs
skipped it. The asymmetry is the defect: the same file authorizes the write but not the read.

## 3. Root cause (not the symptom)
`events` is the append-only spine and is intentionally company-wide readable (§3.1). Authz for
a rep-private artifact therefore CANNOT live on the `events` read — it must be a prior gate on
`coaching_sessions`, whose RLS IS owner-or-manager (0083/0084). `getSession()` uses the RLS
user client, so a non-null return proves the caller is the session owner OR a same-company
manager; null means "not yours." The GETs read `events` directly without that prior proof.

## 4. Hypothesis
H1: adding a `getSession(<id>)` gate (404 on null) before each single-session `events`
readback closes the leak with zero behaviour change for legitimate callers (owner + manager),
because `getSession` returns exactly the owner-or-manager set the artifact should be visible to
— the same gate the sibling POST handlers already use, and the sibling `/why` route.

## 5. Not the fix (rejected)
- Tightening `events` RLS to per-actor: breaks the company-wide event spine (§3.1) that
  managers, KPI, and the list view depend on. Wrong layer.
- Owner-only (drop managers): regresses the manager-visibility feature (§A18) — managers are
  SUPPOSED to see a rep's coaching artifacts. `getSession`'s owner-or-manager set is correct.

## Session-read manifest (A22 / A35)

```json
[
  { "id": "§0", "read_at": "2026-08-15T09:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understanding precedes solving — diagnose the IDOR's root cause (company-wide events RLS) before patching.", "how_this_build_will_embody_it": "Traced why events is company-wide and where authz actually belongs before adding the gate." },
  { "id": "§0.1", "read_at": "2026-08-15T09:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "CLAUDE.md + ThinkerThinker.md hashes verified equal to DOC_MANIFEST; no amendment this build." },
  { "id": "§1.5.1", "read_at": "2026-08-15T09:01:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 operational effectivity — the read side must actually enforce what the write side does.", "how_this_build_will_embody_it": "Gate the GET readbacks to match the already-gated POST handlers; no owner/manager regression." },
  { "id": "§1.5.2", "read_at": "2026-08-15T09:01:20Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search + quality-over-quantity — audit adjacent read surfaces, not just the reported one.", "how_this_build_will_embody_it": "Swept list/why/after-pitch; guard refined to the defect shape after it false-flagged list." },
  { "id": "§6", "read_at": "2026-08-15T09:01:40Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Decision checklist — holistic ripple + real vs incidental constraint.", "how_this_build_will_embody_it": "Ripple traced: events spine unchanged, only a prior coaching_sessions gate added." },
  { "id": "A19", "read_at": "2026-08-15T09:02:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read all three routes + the /why model + getSession + the 0083/0084 RLS before editing." },
  { "id": "A22", "read_at": "2026-08-15T09:02:20Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Every section/migration cited here was opened this session." },
  { "id": "A30", "read_at": "2026-08-15T09:02:40Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate, not prose.", "how_this_build_will_embody_it": "sessionArtifactReadGate.test.ts fails CI on a new ungated single-session readback; detection-proven." },
  { "id": "A38", "read_at": "2026-08-15T09:03:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md + closure.md paste `npm run check` output and exit code." },
  { "id": "§1.2", "read_at": "2026-08-15T09:03:20Z", "source_file": "CLAUDE.md", "line_range": "200-210", "why_it_governs": "Retrospective identification — the fix comes from the audit record, and the write side already showed the correct gate.", "how_this_build_will_embody_it": "The gate mirrors the sibling POST + /why handlers that the record already established as correct." },
  { "id": "§3.1", "read_at": "2026-08-15T09:03:40Z", "source_file": "CLAUDE.md", "line_range": "307-320", "why_it_governs": "Events are immutable + company-wide — the very property that makes subject-only filtering unsafe.", "how_this_build_will_embody_it": "Authz placed on the prior coaching_sessions gate, NOT by narrowing the events spine." },
  { "id": "A18", "read_at": "2026-08-15T09:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "54-58", "why_it_governs": "Manager-visibility is intended — the fix must not regress a manager's legitimate read of a rep's artifacts.", "how_this_build_will_embody_it": "getSession's owner-or-manager set keeps managers in; only peers are 404'd." }
]
```
