# BUILD

## Files

**`scripts/reachability-audit.mjs`** (new) — flags every module that exports something and is
reached by no non-test file.

Shaped on `invariant-audit.mjs` deliberately: same allowlist-with-reasons convention, same
self-test block that exits 3 and declares its own result untrustworthy if a matcher stops working.

Three reference forms are recognised, and missing any one produces a false positive:

| | Example |
|---|---|
| `@/` alias | `@/lib/coach/pitchScore/aggregate` |
| directory alias, for an index file | `@/lib/brain` → `src/lib/brain/index.ts` |
| relative path | `./aggregate`, `../pitchScore/aggregate` |

Plus a fourth for referrers outside `src/`: a path ending in the module's src-relative path, which
is how `scripts/pilot-generate.mjs` names `../src/lib/pilot/generateCode.ts`.

**`package.json`** — `reachability:audit` added, and inserted into `check` between
`invariant:audit` and `tbc`.

**`.github/workflows/ci.yml`** — its own step before Test, with the three orphans that motivated
it named in the comment.

## The allowlist, and why it says DEBT

Six modules. Three are deliberate and say so in their own files. Three are debt nobody decided.

Every entry opens with **DELIBERATE** or **DEBT**, and each DEBT entry carries the decision that
created it, the date, and what is wrong *now* because of it. Without that distinction the
allowlist is just the place findings go to be silenced, which is the §5 shortcut — fast for the
builder, worth nothing to the system.

The sharpest one:

> **`src/lib/coach/emit.ts`** — dead since commit `7904f180` (2026-06-13), which deleted its only
> caller and said *"Future cleanup will retire emit.ts + the v3 readout together."* Three months,
> no cleanup. `/api/admin/coach-readout` and `/api/brain/learning-summary` still read
> `coach.suggestion_*` events that nothing has written since June.

## Three detector bugs

**A comment counted as an import.** `body.includes(alias)` matched a docblock in `observe.ts`
saying *"same pattern as coach/emit.ts"*. Tightened to a quoted import — A19 at the detector
level, a dependency's label with none of its substance.

**Referrers outside `src/` were invisible.** `tailwind.config.ts` imports the design tokens;
`scripts/` imports library code. Both reported as orphans. Config files and `scripts/` are now
searched as referrers without being audited themselves, and `generateCode.ts` came off the
allowlist as a result — a fact the scanner can see beats a standing exception.

**The audit found itself.** Once `scripts/` was scanned, the audit's own allowlist — module paths
as string literals — counted as a reference to everything in it. The planted-orphan self-test
started passing when it should have failed, and caught it. `SELF` is now excluded, and a self-test
asserts that it is.
