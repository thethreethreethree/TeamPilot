# CLOSURE — verify:live §3.5 durability-emit trigger-wired guard

## What shipped

`verify:live` now asserts the §3.5 durability-review EMIT trigger (`resolutions_emit_durability_review` on
`resolutions`, UPDATE) is WIRED — so if it were dropped, durability reviews would fail CI instead of silently
ceasing to reach the event chain (which would erase the §3.5 moat metric + the §3.6 learning-visible signal).

**This COMPLETES the §3-thesis trigger-wiring live-coverage:** §3.1 (append-only rules), §3.2 (understanding
gate), §3.4 (control-window / honesty moat), §3.5 (durability emit) are each now asserted-wired by verify:live,
in addition to their existence. The product's honesty / anti-overtake / measurement mechanisms are protected
from silent trigger-removal at run-time, not just at migration-text time.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **The trigger is an EMIT, not a raise.** I corrected my own prior "less clear-cut" read by reading the fn
  body live. The guard asserts wiring; it does NOT assert the emit's payload shape (out of scope — the event
  chain's own well-formedness is separately verified).
- **Trigger + fn NAMES are live-current;** a rename migration would (correctly) fail this check until updated.

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "The §3-thesis trigger-wiring class is now complete across the raise/emit triggers (§3.2 gate, §3.4 control-window, §3.5 durability) + the §3.1 append-only rules. No further §3-mechanism trigger is checked by fn-existence alone.",
    "why_skipped": "Verified against the enumerated §3 mechanisms; nothing of this class remains for §3. Generic (non-§3) guarantee triggers (fin_freeze_creator x15, care/chat immutability) remain a deliberate founder-scope decision, NOT auto-expanded.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T14:23:00Z",
    "outcome": "OPENED + confirmed the §3-thesis class is complete; the generic-trigger set stays founder-scope."
  }
]
```

## Verification

verify:live 21/21 + detection test (see check.md), exit 0. Full `npm run check` is the CI gate.
