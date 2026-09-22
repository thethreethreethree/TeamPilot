# REMEDIATE — "No files attached yet" is three different sentences

### A failed read returned as an empty collection — the two survivors of an earlier sweep

gate-or-promise: promise

The class was swept once before, on 2026-08-18, founder-directed. That sweep fixed the
Sales-Coach Team page and left INVARIANT 22 behind as the structural defence: it flags a
data-layer **catch** block that swallows an error into a value. All three survivors are
`if (error) return []` — not a catch — so the detector was looking at the right class through a
predicate that could not see them.

Remediated in place:

- `src/lib/data/files.ts` — `listFiles` returns `FileRecord[] | null`; `/api/files` answers 500 on
  null. Seven cases in `listFiles.filterBeforeLimit.test.ts`, including both directions (a failed
  read is `null`; a successful read of nothing is still `[]`).
- `src/lib/data/departments.ts:139` — `listProfileDepartments` returns `null`, for the same
  reason: an empty answer there is a claim about a person.
- `src/lib/data/departments.ts:55` — `listDepartments` **keeps** returning `[]`, and now carries
  the reason. See the closure's R4.
- `src/components/files/TaskAssetsSection.tsx` — the surface half, four cases.

**Why a promise and not a gate.** Extending INVARIANT 22's predicate from `catch { return [] }` to
`if (error) return []` is one regex away, and I did not write it, for a reason I want on the
record rather than discovered later:

`if (error) return []` is **not always wrong.** `listDepartments` is the proof — it is the same
line, in the same file as one that was wrong, and it is correct. A gate that fired on the pattern
would flag it, and the only way to keep the gate green would be an allowlist entry beside a line
that is already correct. That is the shape A30 warns about from the other side: a gate imprecise
enough to need an allowlist is a gate people learn to silence.

What would make it gateable is the thing the codebase does not yet have: a way to say *this read's
emptiness is a claim about the world* versus *this read's emptiness degrades a control*. That
distinction is real, it is what separated the three sites, and it is currently carried in prose.
Encoding it — a marker, the way `enum:audit` takes an opt-in `// enum-source:` comment — is a
build, and it is the honest next step rather than something to bolt onto this one.

Until then this is a promise with a boundary and a command attached, which is the weakest of the
three outcomes A30 allows, and it is named as such rather than dressed up:

```
grep -rn "if (error[^)]*) return \[\];" src --include=*.ts --include=*.tsx
```

Three hits before this build. One after, and it is the one that is meant to be there.

### A wait budget that only holds when the suite is quiet

gate-or-promise: declined

`RecordingsTab.render.test.tsx` raised to `configure({ asyncUtilTimeout: 4000 })`, with the
measurement — 1061ms inside the gate against a 1000ms default, 1.97s for the whole file
standalone — written above the line so the number is not a guess anyone has to re-derive.

**Declined, not promised, and the distinction matters.** The gateable version is a `setupFiles`
entry setting the budget once for all 706 test files. That is the right answer and it changes the
environment every test in this repository runs in. Making that change inside a build about
`listFiles` would be a wide, unmeasured edit smuggled in beside a narrow one — and if it slowed
the suite or masked a real hang, the cause would be buried in a commit about the Files module.

It is a build, with a before/after measurement of the full gate. Named here so it is asked for
rather than forgotten.

### The wait budget, revisited — declined, then done

gate-or-promise: gate

The entry above declined the structural fix. One gate run later the class produced its third
instance of the day (`envDocsComplete`, killed by vitest's own 5000ms), and the decline was wrong.

What I got right in declining: a `setupFiles` entry that imports Testing Library into all 706
files is a real change to every test's environment, and it did not belong in a build about
`listFiles`.

What I got wrong: I let that reasoning cover a different change. `testTimeout: 20_000` in
`vitest.config.ts` is one value, adds no import, runs no code, and alters no behaviour except how
long a test may take before it is killed. The blast radius I was protecting against was the
setup file's, not the timeout's, and I did not separate them.

Now in `vitest.config.ts` with all three measurements above it. The per-file exceptions stay:
the two audit suites at 30s (above the new global) and `RecordingsTab`'s `asyncUtilTimeout` at 4s
(a different mechanism — Testing Library's wait, not vitest's kill).

Still declined: the global `asyncUtilTimeout`. That one does need a setup file, and it still
deserves its own build.
