# Session-Read Manifest: rule-trace-and-toast

**Date:** 2026-06-19
**Session:** continuous
**Commits in scope:** this commit
**Builder:** Agent

## 1. What this build does

Two small pieces bundled per the previous closure's recommendation:

1. **Rule trace storage + surfacing.** Migration 0061 adds a `rule_trace text[]` column to file_classification_suggestions. The upload routes now write `routeTrace` / `routed.ruleTrace` into the audit row. The §4 readout dashboard reads the trace, groups by rule prefix (R1/R2/...), and renders a horizontal-bar distribution with constitutional commentary.

2. **Auto-classification toast.** Per the inspection finding that silent uploads from chat / C.A.R.E composers auto-classify without surfacing the System's decision, the FileDropzone now emits a toast on every successful upload, branched on the response's classification_lane. Lives in the dropzone (single source of truth) so all 4 upload surfaces benefit; the chat-composer page-level duplicate toast was removed.

## 2. Constitutional assets cited

| Asset | Cited in | Re-read in session at | Intent | Behavior |
|---|---|---|---|---|
| §3.1 | migration 0061 header | 2026-06-19T16:23Z (CLAUDE.md re-read this session) | Events immutable; entity state derived. | Embodies — rule_trace is set on INSERT alongside suggested_* columns; the row remains append-only in spirit (user_action is the only mutable transition). |
| §A11 | asset-readout page rule-trace section copy + autoRoute.ts header | 2026-06-19T~14:30Z | System counts derived from facts, never judgment. | Embodies — the trace is a literal list of which rules fired; the readout displays counts; no verdict on whether the routing was "good" or "bad." Distribution shows where the router's value comes from. |
| §A12 | migration 0061 | 2026-06-19T~14:30Z | Migrations idempotent. | Embodies — `add column if not exists` + default `'{}'`. Safe to re-run. |
| §A14 | this manifest section 5 | 2026-06-19T~10:00Z | Data path complete ≠ render path complete. | Embodies — write path (suggestion inserts) AND read path (readout query + render) are in this commit. |

## 3. Findings + remediations

### Resolved this commit
- Rule trace now persisted in the audit row + surfaced in the §4 readout. The previous "gap documented" line in assetReadout.ts is now closed.
- Auto-classification toast surfaces every upload's lane so the user knows what happened. Per §A11 transparency — closes Finding 1 from the deterministic-router audit.

### Deferred (per A20)

1. **Decision archived view + Resolutions list view chip rendering** — per the previous closure's recommendation. Small commit; should ship before the §4 citation rate metric reads >0 from those surfaces in production (otherwise the historical text shows raw `@file[Title](UUID)` markers when an admin scrolls back).
2. **Toast click-to-navigate** — toast says "open library to edit" but isn't a link. Small enhancement; defer.
3. **Toast localization for "routed to <department>"** — current toast says "routed" without naming the department. More informative would name it. Defer; requires the response to include the routed department names.
4. The remaining medium/low findings from earlier audits.

## 4. Outside-perspective audit

### Persona 1 — User uploads from chat composer
- Toast appears top-of-screen: "Attached & routed — open library to edit" (when auto-routed) or "Attached" (when casual / no fields filled). ✓
- Disappears in ~3s. ✓
- **Concern (LOW):** The toast doesn't say WHICH department it routed to. The user has to open the library to see. Acceptable for v1; could improve by including dept names in the route response.

### Persona 2 — Admin viewing the §4 readout
- New section "Router rule distribution" appears below the existing metric cards.
- Each rule (R1–R6) labeled in plain language with a horizontal bar.
- Empty state copy when no router activity: "Upload a few files to see which rules fire most often." ✓ Per A7 — constructive.
- The explainer at the bottom names the §A11 reason for the surface.
- **Concern (LOW):** Rule labels are hardcoded. If a future R7 is added in autoRouteFile, the readout shows the raw key "R7" until the label is added. Acceptable v1; falls back gracefully.

### Persona 3 — Adversary
- The rule trace is exposed only to admins (RLS + admin check on /api/admin/asset-readout). ✓
- Trace strings include UUIDs (e.g., "R2:task-dept-inherit=<uuid>") — these are department/task UUIDs the admin already has access to via other admin surfaces. No new exposure. ✓
- Migration 0061 is type-safe and idempotent. ✓

### Persona 4 — CFO/operator
- Migration 0061 is `add column if not exists` — instant on any size of `file_classification_suggestions`. Zero downtime.
- Reading rule_trace in the readout adds one column to the existing select — no new query. Negligible cost.
- Toast adds zero server cost (client-only).
- Zero LLM cost.

## 5. Cross-module check (per A21) + render-branch walkthrough (per A14)

### A21 — Toast consistency across upload surfaces

| Upload surface | Uses FileDropzone? | Toast fires? |
|---|---|---|
| Library page dropzone | YES | ✓ |
| Task assets section | YES | ✓ |
| Chat composer | YES | ✓ (previously had a duplicate page-level toast which I removed in this commit) |
| C.A.R.E agent composer | YES | ✓ |
| Customer widget upload | NO (uses CustomerUploadButton, different path) | INTENTIONAL — customers don't classify; toasting "routed" doesn't apply |

**Consistent surface across all FileDropzone uses; the customer-widget exception is intentional and named.**

### A14 — Render-branch walkthrough on rule trace

- Migration 0061 adds the column.
- Upload routes (library + C.A.R.E agent-upload) write `rule_trace`.
- The Customer widget upload route does NOT auto-route (intentional — customers don't go through the deterministic router), so no rule_trace write. ✓
- assetReadout.ts reads the column and groups by prefix.
- Asset readout page renders the rule distribution.
- Render path complete.

### A14 — Toast paths

- FileDropzone fires the toast.
- The ToastProvider context must be available where FileDropzone is mounted. Library page, task detail, chat composer, C.A.R.E composer all live inside the dashboard layout which mounts ToastProvider via the app root layout — verified by grep.

## 6. Verification checklist

- [x] `npx tsc --noEmit` green
- [x] `npm run build` green
- [x] All 4 cited assets have session-read timestamps
- [x] All 4 outside-view personas walked
- [x] A21 + A14 audits documented
- [x] Page-level duplicate toast removed (chat composer)
- [x] Customer widget path explicitly named as intentional non-target

## 7. Recommended next steps (per A20)

1. **Decision archived view + Resolutions list view chip rendering** — make historical text render @file chips, not raw markers. Should ship soon to keep the visible product consistent with the citation events being emitted.

2. **Toast click-to-navigate** — small ergonomic improvement on the auto-routing toast (link to the library, pre-filtered to the just-uploaded file).

3. The remaining medium/low findings from earlier audits: hardcoded support-dept regex, hardcoded keyword dictionary, per-user upload quota, EXIF stripping, PDF safer-by-default, FolderTree empty-department hiding, signed URL lifetime, default access_role decision.

**Migration 0061 needs to be applied on prod before the rule-trace surface in the readout reads anything.** Same procedure as before: Supabase SQL Editor → paste 0061 → Run.
