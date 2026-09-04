# REMEDIATE - INVARIANT 26

### F1 - one-hop reachability analysis - FIXED

- closes: check.md F1.
- clause: A26 (sweep to the boundary) + A30 (encode it in a gate) + A21 (across
  modules, not within them).
- what changed: the boundary is now computed on every `npm run check` by walking the
  import graph, instead of being eyeballed once per incident and written into prose
  that the next session inherits as fact.
- what remains: nothing for the static shape. See F3.
gate-or-promise: GATE, and this build IS the gate the previous three owed. It fails
without my cooperation because it runs inside the canonical command, and it is
mutation-proven against the real defect: removing one allowlist entry makes it name
`care/extension/coach`.

### F2 - the circular heuristic - FIXED, and encoded

- closes: check.md F2.
- clause: SS2 + A38 ("a guard that silently stops detecting is worse than no guard").
- what changed: `careAgentAuth` is excluded from the Bearer regex and listed with the
  cookie front doors, and a self-test asserts the exclusion BY NAME:
  `st("INV26 bearer regex does NOT count careAgentAuth ...")`.
- what remains: nothing. The specific wrong answer is now a failing test if reintroduced.
gate-or-promise: GATE. The self-test block is run by the audit itself.

### F3 - runtime-only paths - DECLINED, and declared

- closes: check.md F3.
- clause: A33 (decline explicitly, name the hole) + A26 (name the coverage boundary).
- what changed: nothing. A static import walk cannot follow a dynamic import, a
  string-keyed dispatch, or an injected dependency.
- what remains: that shape. It caused none of the four incidents - all four were
  ordinary static imports - so the guard closes what actually happened rather than
  what might.
gate-or-promise: DECLINED, with the hole named in check.md F3 and its grep recorded.
Widening a static analyser to chase shapes that have never occurred here would trade
precision for coverage and train people to ignore it, which A33 warns against.

## Re-run (A38)
The canonical gate is run whole after these edits; output and exit code in closure.md.
