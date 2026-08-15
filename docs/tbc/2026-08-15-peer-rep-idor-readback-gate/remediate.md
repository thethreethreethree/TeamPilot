# REMEDIATE — peer-rep IDOR readback gate

## During-build corrections
- **The guard first over-fired (false positive).** The initial guard demanded `getSession(` in ANY
  handler reading a `sales_session:` events row. That flagged `list/route.ts` — which is NOT a leak:
  its `subjects` come from a `coaching_sessions` query already scoped by `company_id` + (for staff)
  `agent_id`, then read via `.in("subject", subjects)`. That IS the owner-or-manager gate at list
  grain. Corrected the guard to match only the single-session `.eq("subject", `sales_session:${…}`)`
  shape — the request-id readback that is the actual IDOR — and documented the exclusion in the test.
  Lesson: a structural guard must match the DEFECT SHAPE, not a keyword; too-broad guards manufacture
  false positives that erode trust in the gate (§1.5.2 quality-over-quantity).

## Adjacent surfaces checked (§1.5.2)
- `list/route.ts` — confirmed safe (scoped session query feeds the subjects; excluded from guard with rationale).
- `[id]/why/route.ts` — already correctly gated (getSession + explicit owner-or-manager); it is the model.
- `after_pitch` / `summary-scores` — owner-only endpoints (0080, §A18); a different, tighter gate — out of scope here.
- POST handlers of the three fixed routes — already gated; unchanged.

## Residual / follow-ups (flagged, not fixed — founder-gated per the audit)
- ask-coach missing prompt-injection fence (MEDIUM) — separate finding, not selected.
- Contradictory "not recording yet" STT-outage banner (MEDIUM) — separate finding, not selected.
- Naming-modal trap + unvalidated subject (LOW) — separate finding, not selected.
These remain on the audit record for a future founder decision; this build was scoped to "Peer-rep IDOR only."
