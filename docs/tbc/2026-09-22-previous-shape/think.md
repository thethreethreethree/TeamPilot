---
started_at: 2026-09-22T12:42:13+08:00
trigger: Three surfaces crashed on the same thing in one session, and I wrote the defence for the first two before shipping the third without it. That is not a memory failure, so the correction cannot be "remember harder".
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the response shape a client was not compiled for

## The three, in order

| Field | What it did | When |
|---|---|---|
| `PatternRow.events` | `undefined.filter` inside `useMemo` — took the whole Rep progress tab down | morning |
| `StatusVerdict.comparison` | `undefined.thenMisses` — took the "where each pattern stands" table down | morning |
| `reviewFlags` | `undefined.length` — six Coach Assessment board tests red | an hour ago |

**I wrote the hardening for the first two.** Then I added a third field to a response and wrote
`flags === null` for it.

## Why it is not a memory failure

At the moment of writing, the field always exists. I had edited the route that returns it seconds
earlier. The state where it does not exist is **a browser holding its JS bundle across a deploy**
— a client compiled against today's response being handed yesterday's — and that state is
invisible from inside the edit. Nothing on screen, in the types, or in the test run is a reminder.

A correction of the form "check for undefined on new wire fields" fails for the same reason the
first two hardenings did not prevent the third: it is a rule that has to be recalled at exactly
the moment when everything looks fine.

## What cannot see this class

- **Typecheck** — the type says the field is there. Over a wire, a type is a promise, not a fact.
- **Lint** — nothing syntactically wrong.
- **`writer:audit`** — asks whether a table has a writer. Not this.
- **`enum:audit`** — asks whether a declared mirror is complete. Not this.
- **The existing render tests** — they build fixtures at *today's* shape, which is the shape that
  works. The third crash was only caught because six OLD fixtures happened to predate the field,
  and that was an accident of timing rather than a check.

## The options, and why one of them is wrong

1. **A `wire<T>()` helper at the fetch boundary.** Doesn't help — TypeScript still claims every
   field exists after the cast.
2. **Make every wire type's fields optional.** Structurally correct and a very large refactor that
   would put a `?.` on several hundred access sites, most of which are not at risk.
3. **A test that mounts each surface against the previous shape.** Targeted, cheap, and converts
   "handle the undefined case" from a thing to remember into a thing a suite proves.

Option 3, and the reason is A30: a gate must be precise or not exist. Option 2 is precise and
disproportionate; a helper that guessed which fields are new would be imprecise.

## What it deliberately will not do

**It cannot know which fields are new.** That is the author's knowledge and it is passed in. A
helper that inferred it would either miss the field that matters or assert against every optional
property in the wire — the second is the allowlisted-into-silence outcome.

So this is a harness, not a gate. It does not sweep; it makes the case cheap to write, and it
fails loudly when someone reverts a hardening.

## What could go wrong, before I look

1. **A harness that cannot fail.** The reason both audits today were probed. This one needs a
   planted throw proving the detector detects.
2. **Mutating the caller's fixture**, which would make the *next* test in a file fail for an
   unrelated reason — the worst kind of failure to diagnose.
3. **Asserting "renders correctly" rather than "renders".** A surface handed an older response
   legitimately cannot show what it does not have. The bar is that it degrades rather than
   throwing, because a thrown render takes the whole tree with it.
4. **Swallowing React's error output** permanently and hiding an unrelated warning later in the
   run.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T12:43:13+08:00",
    "why_it_governs": "Understanding precedes solving; a misdiagnosis fed more effort is an error loop.",
    "how_this_build_will_embody_it": "The diagnosis is that this is not a memory failure. Three instances where I wrote the fix for two and missed the third is evidence that the rule is unrecallable at the moment it applies, not that I forgot it." },

  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "252-281", "read_at": "2026-09-22T12:43:33+08:00",
    "why_it_governs": "No error loops — a repeated failure means the identification was wrong, not the implementation.",
    "how_this_build_will_embody_it": "Directly. Hardening a third field by hand would be the third instance of the same fix; the third occurrence is the signal to stop fixing instances." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "78-84", "read_at": "2026-09-22T12:43:53+08:00",
    "why_it_governs": "Holistic — trace the ripple.",
    "how_this_build_will_embody_it": "The harness touches no production code. It adds one test file and one helper, so nothing it gets wrong can reach a user." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "404-418", "read_at": "2026-09-22T12:44:13+08:00",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "The confident answer here is 'be more careful with new wire fields', which is what I would have said after the first two and which demonstrably did not work." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T12:45:53+08:00",
    "why_it_governs": "The methodology defining understanding for this work must be in the tree at the moment of action, not recalled.",
    "how_this_build_will_embody_it": "The clause and this build are the same idea at two altitudes. §0.1 exists because feeling-confident-from-cached-labels passed §0 without consulting the source; this harness exists because feeling-confident-from-having-fixed-it-twice passed the wire boundary without checking the shape. Both are corrected structurally rather than by intending to do better." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T12:46:13+08:00",
    "why_it_governs": "Four layers, foundation up; a broken lower layer is not survivable by the ones above.",
    "how_this_build_will_embody_it": "This is a layer-1 change with no layer-4 surface at all: two test-only files, nothing a user can reach. The layer it protects is 2 — a board that throws does not deliver its intended result no matter how correct its markup is." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T12:46:33+08:00",
    "why_it_governs": "THINK first about what could fail, then search; the agent audits as it works rather than when asked.",
    "how_this_build_will_embody_it": "Nobody asked for this. It came from noticing that the same defect had appeared three times in one session while I was closing an unrelated build — which is the proactive half of the clause, and the reason the third instance became a build rather than a one-line fix." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T12:46:53+08:00",
    "why_it_governs": "The pre-action checklist; item 3 asks whether I am about to repeat a failed approach.",
    "how_this_build_will_embody_it": "Item 3 exactly. Hardening a third field by hand would have been the third instance of an approach that had already failed to prevent the second and the third. The checklist's answer is to stop and re-diagnose, which is what the think doc does." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T12:44:33+08:00",
    "why_it_governs": "A discipline documented where the next author will not encounter it is documented for nobody.",
    "how_this_build_will_embody_it": "The first two hardenings carry long comments explaining the class. The comments are in the files that were already fixed, which is precisely where the next author does not look. A test in the suite is somewhere they cannot avoid." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-22T12:44:53+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Every id here was opened today." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T12:45:13+08:00",
    "why_it_governs": "Gate the class; a gate must be precise or not exist.",
    "how_this_build_will_embody_it": "This is why option 2 was rejected and why the harness does not guess which fields are new. It is deliberately a harness rather than a sweep — an imprecise version would assert against every optional property in the codebase." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-22T12:45:33+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code on its own line, plus a probe that reverts both real hardenings and confirms the harness names them." }
]
```
