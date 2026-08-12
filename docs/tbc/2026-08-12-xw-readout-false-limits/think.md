---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T14:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — page the readout false-limits (admin/coach-readout ×3 + brain/learning-summary)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (executing the founder-queued "fix the false limits" — the mechanical remainder)
Two analytics routes aggregate windowed `events` reads in memory behind a fixed >1000-row cap, which PostgREST
truncates at 1000 — so past ~1000 events in the window the readout numbers are silently wrong:
- `admin/coach-readout` — stepEvents / gradeEvents / analyzeEvents, each `.limit(2000)` (a founder diagnostic).
- `brain/learning-summary` — coachEvents `.limit(2000)` (the section-3.6 "what the system learned" surface the
  USER sees, so higher-value).
These are the same truncation class swept all session, and they are covered by the founder's standing
"fix the false limits" queue item — so fixing them executes a queued directive, not an unprompted decision. They
are the MECHANICAL remainder: the only two still-open false limits that are NOT a founder decision (care.ts is the
c5fbd454 KEEP/REVERT; the finance register is a DISPLAY truncation needing a load-older UI).

## 3. The fix (mirror the established fetchAllPaged pattern, preserve the {data,error} shape)
Each false-bound read is wrapped in `fetchAllPaged(...).order("id").range(...)` — order-independent, since every
consumer only window-filters + counts. To keep the routes' existing error handling byte-identical, fetchAllPaged's
throw-on-error is adapted back to `{ data, error }`: in brain via an inline `.then/.catch` (it sits in a
Promise.all whose §3.4 chainReadError combine expects that shape); in admin via a small `pagedEventCount` helper
(its three reads feed the secondaryReadError §3.4 combine). Removing the four `.limit(2000)` also makes both files'
FALSE_LIMIT_ALLOWLIST entries stale — the xu self-cleaning check flags that — so both entries are removed here.

## 4. Boundary (§1.5.1 / A26 — what this does NOT touch)
- brain's decisionEvents `.limit(1000)` and topicRows `.limit(500)` are NOT false bounds (≤ max_rows) — they can
  still truncate a very busy 28-day window, but they are the honest single-page max, a separate lower-severity
  concern noted as residual, not this build's scope (which is the "false limits" = >1000).
- No route tests exist for either file (A30 honesty in the manifest); the fetchAllPaged mechanism is tested by
  paginate.test.ts, and the change is a mechanical read-shape swap.

## 5. Hypotheses (§1.5.2)
- **H1 — does the {data,error} adapter preserve the §3.4 honest-error behaviour?** Yes: on a read error
  fetchAllPaged throws → mapped to a truthy `error`, which flows into the existing `?? ` combine → the route's
  existing "unavailable"/500 path fires exactly as before. CONFIRMED by reading both combines (brain
  chainReadError line ~258; admin secondaryReadError line ~420).
- **H2 — does paging change small-data results?** No: a <1000-row window ends fetchAllPaged after one short page,
  identical to the old single read; the aggregations are order-independent. CONFIRMED — typecheck clean, invariant
  audit (incl. the self-cleaning check + self-tests) reports 0 violations.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T14:00:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand each aggregation's read→count flow before swapping the read shape, so paging can't change a derived number's meaning.", "how_this_build_will_embody_it": "Section 3 confirms every consumer only window-filters + counts (order-independent)." },
  { "id": "§0.1", "read_at": "2026-08-12T14:00:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T14:00:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "These sites were surfaced + recorded earlier (the 'fix the false limits' queue item); the fix draws on that record.", "how_this_build_will_embody_it": "Section 2 grounds the build in the queued item; mirrors the pattern proven this session." },
  { "id": "§1.5.1", "read_at": "2026-08-12T14:01:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the read change ripples into the FALSE_LIMIT allowlist (must re-sync) and must preserve each route's error combine.", "how_this_build_will_embody_it": "Section 3 re-syncs the allowlist + adapts to the {data,error} shape; H1 confirms the error path." },
  { "id": "§1.5.2", "read_at": "2026-08-12T14:01:10Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Evidence bar + honest boundary — fix the >1000 false bounds (real, reachable), and NAME the ≤1000 windowed reads rather than silently expand scope.", "how_this_build_will_embody_it": "Section 4 draws the boundary; the ≤1000 reads become a residual, not this scope." },
  { "id": "§3.4", "read_at": "2026-08-12T14:01:15Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honest error state — a failed read must surface as unavailable/500, never as a misleading zero; the paging change must not weaken that.", "how_this_build_will_embody_it": "The {data,error} adapter maps fetchAllPaged's throw into the existing chainReadError/secondaryReadError combines, so a read failure still fires the route's unavailable/500 path (H1)." },
  { "id": "§6", "read_at": "2026-08-12T14:01:20Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The checklist forces confirming the error-combine + allowlist ripple before calling the fix done.", "how_this_build_will_embody_it": "Sections 3-5 + the green invariant audit." },
  { "id": "A16", "read_at": "2026-08-12T14:00:50Z", "source_file": "ThinkerThinker.md", "line_range": "381-390", "why_it_governs": "Reuse the established fetchAllPaged pattern rather than a new read shape.", "how_this_build_will_embody_it": "Both files now page the same way as the KPI/CARE/list fixes." },
  { "id": "A19", "read_at": "2026-08-12T14:00:55Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult each route + its error combine in-tree before changing the read, so the honest-error behaviour is preserved.", "how_this_build_will_embody_it": "Read both routes' §3.4 combines in-tree (lines cited in H1) before wrapping the reads." },
  { "id": "A22", "read_at": "2026-08-12T14:01:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads." },
  { "id": "A30", "read_at": "2026-08-12T14:01:40Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson — but honestly: neither route has a unit test in this repo.", "how_this_build_will_embody_it": "HONEST LIMIT: no route test exists for either file; the fetchAllPaged mechanism is covered by paginate.test.ts (>1000 boundary) and the change is a mechanical read-shape swap. No test claimed that was not written." },
  { "id": "A38", "read_at": "2026-08-12T14:01:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
