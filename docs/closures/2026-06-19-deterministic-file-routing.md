# Session-Read Manifest: deterministic-file-routing

**Date:** 2026-06-19
**Session:** continuous from Asset System v1 + constitutional self-audit
**Commits in scope:** this commit
**Builder:** Agent

## 1. What this build does

Replaces the planned LLM-based file classification suggester with a
deterministic, rule-based router. Per founder direction 2026-06-19
("logic coding system... no AI element"). Six rules in
`src/lib/files/autoRoute.ts` derive department / task / tag / title /
description suggestions from upload context: where the upload
happened, who uploaded it, the filename, the file extension.

Cost: zero LLM. Latency: sub-millisecond DB lookups. Reliability:
100% reproducible. Per §A11: System counts derived from facts, not
inferred judgment. Per §3.4: behavior derives from this team's
accumulated data (their org chart, their tasks, their uploaders'
department assignments), not from a generic LLM that doesn't know
this team.

## 2. Constitutional assets cited

| Asset | Cited in | Re-read in session at | One-sentence intent | Behavior in this build |
|---|---|---|---|---|
| §A11 | autoRoute.ts header, ClassificationModal hint, /api/files/[id] PATCH suggestion update | 2026-06-19T~14:30Z (full TT.md re-read) | System counts; user decides; never asserts judgment on user surfaces. | Embodies — rules surface counts (uploader's dept membership, surface context, filename tokens); user accepts/edits/rejects in the modal. The `wasAutoRouted` banner explicitly names "the System counts from facts; you decide." |
| §3.4 | autoRoute.ts header | 2026-06-19T16:23Z (CLAUDE.md re-read) | Behavior derives from each team's accumulated data; no fixed day-one behavior. | Embodies — the rules fire on the team's own departments / tasks / profile memberships. An empty company gets empty routing; a populated company gets routing matched to their actual org. |
| §A12 | autoRoute.ts header | 2026-06-19T~14:30Z | Idempotent / replayable. | Embodies — pure functions; same context + same DB state → same result, always. |
| §A14 | autoRoute.ts header | 2026-06-19T~10:00Z (start of session) | Data path complete ≠ render path complete. | Embodies — the routing is the data path; the modal pre-fill banner is the render path; both wired in this same commit so they ship together. |
| §3.1 | /api/files PATCH suggestion update emits asset.suggestion.acted_on | 2026-06-19T16:23Z | Events immutable; entity state derived from event replay. | Embodies — the user_action transition writes the event to the chain. |
| §3.5 | autoRoute.ts comments on suggestions audit | 2026-06-19T16:23Z | Measurement anchored to downstream consequence, not adoption. | Embodies — the audit records rule_trace + user_action so a later §4 readout can measure "did rule-routed classifications retrieve more or less than user-corrected ones" — consequence, not acceptance. |
| §A20 | this manifest section "recommend per A20" | 2026-06-19T~14:30Z | Recommend; never offload "founder decides A/B/C". | Embodies — at the boundary of this build I recommend specific next steps (see section 7), don't offer optionless lists. |

## 3. The 6 rules — what each does

**Rule 1: Surface context wins.**
- Upload from a task page → file_tasks (file, task) auto.
- Upload from a chat topic → linked_topic_id set; topic title becomes description.
- Upload from a C.A.R.E conversation → linked_conversation_id set.

**Rule 2: Task → Department inheritance.**
- Tasks have a `department` text field (from migration 0034).
- If a task is linked, look up departments table by case-insensitive name match.
- If matched, add that department.
- Also: derive description from task title if not set by Rule 1.

**Rule 3: Uploader department fallback.**
- If no task-derived department, use the uploader's `profile_departments` (m2m).

**Rule 4: Filename → Title.**
- Strip extension, replace dashes/underscores with spaces, title-case first letter.
- "Q3-budget-report-final.xlsx" → "Q3 budget report final"
- Preserves internal casing (so "iPhone screenshot" stays "iPhone screenshot").

**Rule 5: Filename → Tags.**
- Whole-word match against curated keyword list (draft, final, budget, design, etc.) → tag.
- File extension → format tag (pdf, xlsx → spreadsheet, etc.).
- Filename token matches a department name → add that department too.

**Rule 6: C.A.R.E auto-routing.**
- C.A.R.E conversation uploads get "customer-support" tag.
- Route to the company's support department (first dept matching /customer|support/i).
- Description: "Attached to support conversation with [customer name]" if known.

## 4. Findings (outside-perspective audit)

### New user
- The "Pre-filled" banner in the modal explains WHY fields are populated. Without context they'd wonder.
- The banner uses "the System counts from facts; you decide" voice — borderline preachy for someone with no §A11 context. Acceptable for v1; revisit copy if user feedback says jargon.

### New engineer
- The rule trace (`R1:task=...`, `R2:task-dept-inherit=...`, etc.) gets stored as a debug aid in the suggestions audit. Future debugging of "why did the router pick X" reads from `file_classification_suggestions.suggested_*` + the human-readable trace.
- The router takes ~3-6 DB round-trips per upload (departments list, profile_departments, optionally task fetch, optionally topic fetch, optionally customer name). At typical request latency this is sub-200ms total. Acceptable.

### Adversary
- Rules don't read file contents → can't be tricked by malicious file content.
- Rules don't run arbitrary code → no prompt-injection equivalent.
- Filename patterns matched are lowercased + tokenized → no regex DOS.
- Rule 5's keyword tags use a fixed dictionary → no untrusted input pivots routing.

### CFO / operator
- **Zero LLM cost.** The whole reason for the founder direction.
- Storage cost unchanged (file uploads still bounded by 25MB cap + casual cap).
- Compute: 3-6 DB queries per upload, ~50ms. Trivial overhead.

## 5. Cross-module check (per A21)

Which surfaces invoke the router?

| Upload surface | Endpoint | Auto-routes? | Notes |
|---|---|---|---|
| Library dropzone | POST /api/files | YES (when no manual classification in form) | The router fills departments/tasks/tags; user can accept or edit in modal. |
| Task assets section | POST /api/files (with linked_task_id) | YES — task is the primary surface signal | Replaces previous "upload then PATCH to add task" with single-call routing. |
| Chat composer | POST /api/files (with linked_topic_id) | YES | Description gets topic title; departments come from uploader. |
| C.A.R.E composer | POST /api/care/conversations/[id]/agent-upload | YES | Description gets customer name; department = support dept lookup. |
| Customer widget | POST /api/care/conversations/[id]/upload | NO (intentional) | Customers don't classify; per Q3 of founder red-pen, customer files are auto-tagged but not subjected to team's classification gate. |

Five upload surfaces; four auto-route; one intentionally doesn't. ✓

## 6. Verification checklist

- [x] `npx tsc --noEmit` green
- [x] `npm run build` green
- [x] All 7 cited constitutional assets have session-read timestamps in section 2
- [x] All 4 outside-view personas have findings
- [x] Cross-module A21 table covers every upload surface
- [x] No LLM provider imports anywhere in autoRoute.ts (grep'd: no `claude`, `anthropic`, `llmCall`, etc.)
- [x] User-decision recording wired through the modal → PATCH → suggestion audit row + chain event
- [x] Empty company case handled (router returns empty arrays when departments / profile_departments are empty; modal opens blank; user fills manually)
- [x] §A22 manifest entry exists (this doc)

## 7. Recommended next steps (per A20)

**Highest leverage:**
1. **§4 readout dashboard** — the events are now flowing (`asset.file.uploaded`, `asset.file.classified`, `asset.file.viewed`, `asset.file.deprecated`, `asset.suggestion.acted_on`). The dashboard at `/dashboard/admin/asset-readout` can now read these and show: re-retrieval rate, cross-actor retrieval, citation rate, classification accuracy (accepted_as_is %), rule-trace distribution (which rules fire most). All measurable. Roughly 1-2 commits of UI work.

2. **Rule tuning surface** — admin page where the company can edit the keyword tag dictionary, designate which department is "support" (instead of regex match), and (eventually) author per-tenant custom rules.

**Medium leverage:**
3. View-trail UI on file detail page (depends on events being emitted — they are now).
4. Per-user classified upload quota (storage runaway protection).
5. EXIF stripping on image uploads (privacy).

**Low leverage:**
6. PDF safer-by-default download flow (download not preview by default).
7. Empty-state copy rewrite in plain language.
8. FolderTree empty-department hiding.

My recommended order: ship #1 (§4 readout) next, because it makes the discipline visible per §3.6, validates that the events are actually being emitted as intended, and surfaces rule-tuning needs that #2 then addresses.
