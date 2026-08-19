# Phase 5 (part 1) — Closure

## Verdict
The roster API is **SHIPPABLE**. It closes the Phase-2 S2 write-path gap + enforces the RQ6 manager gate. One
tested write path both the manual add-form and the file-upload will reuse (no duplicate roster writers to drift).

## Acceptance
- ✅ Create staff (manager-only) + list roster (RLS-scoped, paged).
- ✅ company_id server-resolved (tenant-pin); a hostile body.companyId is ignored (tested).
- ✅ Honest read error (500, never a false empty roster).

## Changed
- Code only (schedule_employee table already applied in 0221).

## Residual queue (A36 — read from the TOP)
```json
[
  {
    "id": "R5-1",
    "item": "Is the roster write path truly manager-gated + tenant-pinned (RQ6/S2 closed)?",
    "why_skipped": "Most sure it is, so opened per A36.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-19T04:00:00Z",
    "outcome": "OPENED + confirmed: POST returns 403 unless ctx.isAdmin; company_id is ctx.companyId, never body; the full invariant gate passes the mutation-route auth + tenant-scope checks. The Phase-2 'no writer' note is resolved for create/list. UPDATE/deactivate ([id] PATCH) is a small follow-up in the next unit."
  },
  {
    "id": "R5-2",
    "item": "The manual add-form UI + the grid schedule view are not built yet.",
    "why_skipped": "The founder picked grid + roster/upload-first. This unit is the roster API (the seam); the React surfaces are the next Phase-5 units.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  },
  {
    "id": "R5-3",
    "item": "The PDF/Excel/CSV file-upload parser is not built yet (S3).",
    "why_skipped": "The largest Phase-5 unit — a parser that turns a staff x date shift grid (samples HK.pdf / HUB SCHED.pdf / frendz.xlsx) into roster rows + schedule events, with the file-upload hardening stack (auth-first, size cap, allowlist, decompression-bomb, CWE-209). Its own build unit; writes through this roster API + the event-append API.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  },
  {
    "id": "R5-4",
    "item": "Employee UPDATE / deactivate ([id] PATCH) not built.",
    "why_skipped": "Create + list first; edit/deactivate is a small additive route in the next unit (same manager gate + tenant-pin).",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```

## Checkpoint
Roster write path proven. **Phase 5 continues** with the manual add-form + grid view, then the big one — the
PDF/Excel/CSV file-upload parser (S3). Ready on your go.

## Verification
See `check.md` — the `npm run check` block (A38).
