# CHECK

```
$ MIGRATION_AUDIT_PSQL="docker exec -i ics-postgres psql -U ics" MIGRATION_AUDIT_MAINT_DB=ics npm run check

  ✓ typecheck   ✓ lint          ✓ theme:audit      ✓ rls:audit
  ✓ invariant:audit  ✓ reachability:audit  ✓ migration:audit (255 migrations, real Postgres 16)
  ✓ tbc:docs  ✓ tbc:manifest  ✓ tbc:artifacts  ✓ tbc:residual  ✓ tbc:freshness

  Test Files  677 passed | 1 skipped (678)
       Tests  4960 passed | 15 skipped (4975)

exit code: 0
```

`reachability:audit` is the one that matters most for this change — it is the gate that would
notice a module nothing reaches — and the nav restructure leaves it clean.

---

## Findings

### The screen explained itself with a dependency that had already been satisfied

class: a precondition copied into prose, which then drifts from its source. The same shape as a
  re-derived gate condition (§2.2), written in English instead of in a boolean, and therefore
  invisible to every mechanical check.
severity: medium
sweep: `grep -rn "Project 1\|Pitch Score engine\|pitch_elements\|pitch_events" src/` — the
  Pattern Interrupt files were the only surface asserting the engine had not landed. Also
  `grep -rn "coming soon\|not yet\|once .* is live" src/components/sales-coach/` for the wider
  class of time-conditional promises; the remaining hits are conditional on user action rather
  than on a build step.
- The note named `pitch_elements` and `pitch_events`. Neither has ever existed. Migration 0252
  created `pitch_score_elements` and `pitch_score_events`, so the claim was written from the build
  guide rather than from the migration — and the names being wrong is the tell that it was never
  checked against the thing it describes.
- Its user-visible half was a promise with a trigger: *"fills in once the Pitch Score engine is
  live."* The engine went live this session. The trigger fired and nothing happened, because the
  work it implied was never scheduled.
- Nothing failed. Types, lints, tests and the render all pass, because the claim is a sentence and
  no gate has a concept of a sentence whose truth conditions moved.

### The nav wired a link to a route the repository did not contain

class: a change split across a tracked and an untracked file, where the tracked half is meaningless
  and harmful alone.
severity: high
sweep: `git status --short` before committing, cross-referenced against every `href` added in the
  staged diff — `for h in $(git diff --cached -U0 | grep -oP 'href: "\K[^"]+'); do test -d "src/app$h" || echo "MISSING $h"; done`
- `SalesCoachShell.tsx` was modified and tracked; `pattern-interrupt/page.tsx` and
  `PatternInterrupt.tsx` were untracked. Committing what `git commit -a` would have taken puts a
  nav item into `main` pointing at a 404.
- This is the September reachability class from the other side. That one shipped a board reps
  could not reach; this would have shipped a door onto nothing. Both are the seam between a
  surface and its route, which is where A31 says a correct system silently becomes a nonexistent
  feature.

### Two screens will count "open" differently when the detector is built

class: one word with two definitions across surfaces of the same feature.
severity: medium
sweep: recorded at `docs/SYSTEM UPDATES AND REVISION/LOGIC-AND-CONTRADICTIONS.md` C8, from the
  mockups themselves; `grep -n "C8" "docs/SYSTEM UPDATES AND REVISION/LOGIC-AND-CONTRADICTIONS.md"`
- The manager rep-chips and the rep-detail panel count Improving as open (Anthony A. = 3); the
  rep-progress list excludes it ("1 fixed · 1 improving · 2 open"). Same rep, same moment, two
  numbers.
- Not introduced here and not resolved here — it is carried forward in the docblock so whoever
  builds the detector picks one sense and labels the other, rather than implementing both mockups
  faithfully and shipping the contradiction.
