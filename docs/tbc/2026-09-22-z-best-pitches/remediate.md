# REMEDIATE — a rep's best pitches had no list

### F1 — the board draws three cards and nothing served them
gate-or-promise: gate

The route exists and nine tests cover it. Three assert the ranking rules directly by recording every
filter the route applies, so "qualifying only", "ordered by total descending" and "limit three" are
checked rather than read.

### F2 — "best" could have meant something other than the total
gate-or-promise: gate

`expect(calls.eq.qualifying).toBe(true)` and `expect(calls.order).toEqual({ col: "total", ascending:
false })`. Ranking by base, or dropping the qualifying filter, each fail one named test.

### F3 — a deleted session would have erased a real score
gate-or-promise: gate

A test passes a row with `session_id: null` and asserts it is returned with a null link and its
total intact.

Also gated, though neither was a finding: an unbounded `limit` is clamped to ten, and a failed read
answers 500 rather than an empty list — because an empty list says "you have no counted pitches",
which is a real and discouraging statement that a failed read has not earned.
