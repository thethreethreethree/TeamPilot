# CLOSURE — required session naming (Phase 4)

## What shipped
Finishing a Sales Coach session (manual End OR recording-complete) now REQUIRES naming it in a
non-dismissible modal; submitting ends + names the session in one PATCH and lands on After-Pitch (Your Read +
scoreboard auto-generate there). Satisfies the founder's "auto-ask to name after finishing → then After-Pitch
+ Your Read", with the founder-chosen hard gate.

## Un-named reliance (not self-evident)
- The session PATCH schema already accepts `clientLabel` alongside `status`, so ending + naming is one call —
  verified by reading PatchSchema, not assumed.
- After-Pitch auto-generates its summary (incl. Your Read) on load when no stored summary exists, so no
  separate "trigger Your Read" call is needed — landing there IS the trigger.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No automated render test for the naming gate (open on finish → required → PATCH → navigate).", "why_skipped": "Inline component state; a render+interaction harness is heavy for a modal. Typecheck clean; founder verifies live.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-01T10:00:00Z", "outcome": "OPENED." },
  { "id": "RES-02", "item": "After-Pitch section ORDER (scoreboard → summary → next-door) not re-verified against the founder's mockup this phase.", "why_skipped": "Those elements already exist on the After-Pitch page; order is a follow-up check.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-01T10:00:00Z", "outcome": "OPENED — verify order next." }
]
```

## Verification
Typecheck exit 0 (see check.md). Full `npm run check` is the CI gate.
