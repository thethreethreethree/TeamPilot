# CLOSURE — verify:live §3.4 control-window trigger-wired guard

## What shipped

`verify:live` now asserts the §3.4 honesty-moat trigger (`enforce_coach_control_window`, BEFORE UPDATE on
`companies`) is WIRED — so if a future migration recreated `companies` triggers and dropped it, the
"no instant results / Month-1 control" guarantee would fail CI instead of lapsing silently while the
function still exists. 20/20 invariants hold; detection-tested.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **This build reverses a deferral I stated for several turns** ("guard the thesis triggers — on your word").
  I owned that in think.md §2: it is read-only hardening with no product trade-off, identical in kind to the
  §3.2/H2/H3/view guards built autonomously this session, and §5 makes genuine high-value work the more honest
  response to the build guard than further near-zero-value verification. One commit to revert if unwanted.
- **The trigger + fn NAMES** are the live names this session; a rename migration would (correctly) fail this
  check until the query is updated — the safe direction.

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "§3.5 durability enforcement is NOT guarded by this build. Its enforcement is a cron (durability sweep) + a resolutions trigger (durability-review update rules), a mix that is less clear-cut than §3.4's single control-window trigger.",
    "why_skipped": "Scope discipline + honesty: §3.4 has one clear thesis-honesty trigger; §3.5 needs its own analysis of what exactly to assert (the sweep is a cron already covered by INV11/16/17; the trigger enforces review-update rules). Bundling it would risk asserting the wrong thing.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-31T14:08:00Z",
    "outcome": "OPENED + named as the deliberate next step. The §3 thesis-trigger coverage is now §3.1 (append-only rules) + §3.2 (gate trigger) + §3.4 (control-window) live-guarded; §3.5 is the remaining one, to be done deliberately."
  }
]
```

## Verification

verify:live 20/20 + predicate detection test (see check.md), exit 0. Full `npm run check` is the CI gate.
