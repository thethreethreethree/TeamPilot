# BUILD — mounting a surface against yesterday's response

## What was built

Two files, no production code changed.

| | |
|---|---|
| `src/test/previousShape.tsx` | `withoutField()` and `survivesWithout()` |
| `src/components/sales-coach/__tests__/previousShape.render.test.tsx` | the four cases, plus two that prove the harness can fail |

## The bar, and why it is that one

**"Renders without throwing", not "renders correctly."**

A surface handed an older response legitimately cannot show what it does not have. The correct
behaviour is to omit that part or say so. What it must never do is **throw**, because a thrown
render takes the whole React tree with it — and in all three real cases the missing field belonged
to a small card on a large board. The Rep progress tab went down over a marker strip; the Coach
Assessment board would have gone down over one attention row.

So `survivesWithout` accepts an empty container as a pass. Degradation is the goal; a crash is the
defect.

## Four cases, being the three real crashes plus one

- `PatternRow.events` → `RepProgressBoard`
- `StatusVerdict.comparison` → `RepProgressBoard` (nested, so the whole verdict is replaced)
- `PatternRow.events` → `PatternActions` — the same field, a second consumer
- `reviewFlags` → `ReviewFlagQueue`

The third is there because a field with two readers has two places to crash, and only one of them
was found by accident the first time.

## Two design decisions worth their comments

**It does not guess which fields are new.** That is the author's knowledge, passed in. A helper
that inferred it would either miss the field that matters or assert against every optional
property in the wire — and A30 is explicit that an imprecise gate is worse than none. This is a
**harness, not a sweep**: it makes the case cheap to write and fails loudly when a hardening is
reverted.

**It does not mutate the caller's fixture.** `withoutField` returns a copy. A helper that deleted
a key in place would make the *next* test in the file fail for a reason that has nothing to do
with it, which is the worst kind of failure to diagnose.

**It restores `console.error` in a `finally`.** React logs a thrown render before rethrowing, so
the harness silences it — and puts it back immediately, or an unrelated warning later in the run
would vanish.

## Why a harness and not a fix

The obvious alternative was to make every wire type's fields optional. That is structurally
correct and would put `?.` on several hundred access sites, most of which are not at risk. The
other alternative — a `wire<T>()` helper at the fetch boundary — does nothing, because TypeScript
still claims every field exists after the cast.

The thing that actually failed was **recall at the moment of writing**, and a test is the only one
of the three that does not depend on it.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
