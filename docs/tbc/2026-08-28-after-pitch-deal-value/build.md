# BUILD — deal-value capture on the After-Pitch page

### recordOutcome carries the deal value
- write-path: `after-pitch/page.tsx recordOutcome(outcome, dealValue?)` now sends `dealValue` when provided (omit =
  unchanged), mirroring the session page. `saveDealValue` validates (≥0) and routes through it (the append-only
  latch chokepoint). Session type gains `dealValue`.
- read-path: the POST returns the updated session; "Recorded: X" shows once saved.

### Optional inline input on 'sold'
- write-path: an inline "Deal value (optional)" input + "Save value" button renders when `outcome === "sold"` —
  copied field-for-field from the session page (same styling/behavior).
- read-path: a rep who closes on the after-pitch screen (the Standard flow) can enter the value; Revenue /
  Avg-deal-size then fill instead of staying "building". Skipping it logs the sale anyway (low friction, founder's pick).

## Files
- `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` — Session.dealValue, recordOutcome(dealValue),
  dealDraft/savingDeal state, saveDealValue, the inline input

## Ripple (§6 item 5)
- Backend reused UNCHANGED: `/outcome` already accepts `dealValue`; `setSessionOutcome` writes `deal_value` +
  returns it in the mapped session (verified salesCoach.ts). No API/schema change.
- The session page is untouched (it already had this). The append-only double-write latch already guards
  recordOutcome, so the value-save path inherits it — no new double-write class.
- Optional means no behavior change for reps who skip it (they log 'sold' exactly as before).

## Honest limit (verify)
- The inline input's render + the save round-trip on the after-pitch page are founder visual-verify (this client
  page has no jsdom harness). The wiring is typechecked, the pattern mirrors the tested session page, and the
  `/outcome` route (incl. dealValue) is already unit-tested.
