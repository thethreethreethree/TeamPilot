# Closure — AI Assistant + clear-schedule

## Built
- **AI Assistant** (assistant.ts + /api/schedule/assistant + assistant/page.tsx) — a plain-language command
  surface: the manager types an instruction, the LLM interprets it into proposed actions, the deterministic
  authority evaluates each, and the manager confirms with Apply. §3.3 guide-don't-overtake.
- **AI Assistance entry points** — first nav tab + a button on the Build page (founder mockup).
- **Clear-the-schedule** (/api/schedule/clear + Settings danger-zone) — append-only cancel of every shift.

## Changed
- ScheduleNav gained the AI Assistant tab (first). Build page gained the AI Assistance button. Founder approval
  SOUGHT: yes — the founder directed the AI surface as the priority and supplied the button mockup.

## Residual (A36) — ranked; the top (most-sure-it-doesn't-matter) is opened
```json
{ "id": "R1", "item": "The assistant re-reads the full event log + roster on EVERY message to build context (no caching), and caps the shift list sent to the LLM at 120 upcoming shifts.",
  "why_skipped": "Assumed cheap + bounded for a real schedule.",
  "confidence_it_does_not_matter": "high",
  "opened_at": "2026-08-20T09:32:00Z",
  "outcome": "OPENED + confirmed acceptable, with one real bound recorded: the fetch is company-scoped + paginated (fetchAllPaged) so it is O(events) per turn — fine for a normal company, but a very long-lived log would make each turn slower. The 120-shift cap means the LLM only sees the next 120 upcoming shifts; a company with more upcoming shifts than that would have later shifts invisible to a query. Neither breaks correctness of an APPLIED change (the authority re-derives full state server-side); both are answer-completeness limits on the LLM's view. Logged here rather than optimized now (no evidence of a large log yet)." }
```
```json
{ "id": "R2", "item": "After Apply, the assistant page does not refresh an inline schedule view; the manager navigates to Schedule to see the result.",
  "why_skipped": "Layer-4 polish; the Apply gives explicit success feedback and the reply confirms.",
  "confidence_it_does_not_matter": "medium", "opened_at": null }
```
```json
{ "id": "R3", "item": "Bulk 'Apply all' for a multi-change instruction (currently one Apply per proposal).",
  "why_skipped": "Flagged to the founder as a spec-fidelity point (§3.3 keeps per-change confirm); awaiting their call on whether one-click-all is wanted.",
  "confidence_it_does_not_matter": "low", "opened_at": null }
```
```json
{ "id": "R4", "item": "Live browser chat round-trip + live-LLM interpretation quality on real instructions.",
  "why_skipped": "Needs the deployed app + the founder's use; the deterministic layers around the LLM are tested.",
  "confidence_it_does_not_matter": "low", "opened_at": null }
```

## Verification (A38)
    npm run check    →    exit 0
    (typecheck, lint, theme:audit, rls:audit, invariant:audit, test — the && chain reaching 0 = all passed;
     test tail: 3351 passed | 15 skipped, 506 files; tbc:residual + tbc:freshness passed.)

## Push status
The feature is committed locally (07f566d5) and the gate passed (see Verification above, npm run check exit 0).
The push to origin failed on a transient DNS error (Could not resolve host: github.com) at closure time; it
will land when the network recovers — the commit is not lost. Deployment to elostate.com follows the push.
