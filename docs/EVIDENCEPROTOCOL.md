# Evidence protocol

**Attach this to any build spec that tells an agent to examine source material.**

---

## The problem this solves

"Read everything in this folder" cannot be verified. The only evidence is the
agent's own claim, and a claim is cheap to produce without doing the work.

The specific failure is predictable and has a name: **summary substitution.**
When a folder contains both a raw source and a summary of it, the agent reads
the summary, finds it coherent and sufficient, and reports the folder as read.
It isn't lying. The summary genuinely felt like enough.

A second failure travels with it: **filename inference.** Given
`Four_models_arranged_in_row.png`, an agent will describe its contents from the
filename and present that as observation.

Both are invisible in a normal progress report.

---

## The principle

> **Never ask "did you read X." Require an output that is impossible to
> produce without having read X.**

Every rule below is an application of that one idea.

---

## Rule 1 — The evidence manifest comes first

Before any analysis, design, planning or code, the agent produces
`EVIDENCE.md`: one row per item in scope.

| Column | What goes in it |
|---|---|
| Path | Exact file path |
| Bytes | Actual size on disk |
| Opened | YES / NO |
| Proof | **A specific fact that could only come from inside** |

**The Proof column is the whole mechanism.** It must be a detail that is
checkable in under ten seconds and impossible to guess.

Not acceptable: "contains design tokens," "a list of pages," "styling data."
Those are descriptions of the file's *purpose*, available from its name.

Acceptable: "entry 34 is `/plans`; its most-used background is
`rgb(247,248,249)` at 61 occurrences."

**No work begins until this manifest is delivered and approved.**

---

## Rule 2 — A summary never substitutes for its source

If both a raw source and a derived summary are in scope, reading the summary
counts as reading **the summary only**.

The spec must name these pairs explicitly. Example:

```
design-values.json   raw, 59 records     ← MUST be opened
design-values.md     summary of it       ← does not substitute
```

**Proof requirement for structured data:** cite **three records by index or
key**, each with a value from a different field. The agent picks which three;
you pick different ones when spot-checking.

---

## Rule 3 — Images require per-image output, and filenames prove nothing

For any image set:

- **One line per image**, describing what is actually depicted
- **Filename-derived claims are forbidden.** State it in the spec as a named
  failure mode so the agent recognises itself doing it
- Every line must include: subject, whether any **text** appears in the image
  (and what it says), and whether it is a **near-duplicate** of another in the set
- Flag anything that doesn't match its filename — that mismatch is often the
  most valuable finding in the batch

**Proof requirement:** the count of described images must equal the count of
files. If 48 files, 48 lines. A missing line is a missing read.

---

## Rule 4 — "Live site" means the live site

Captures are not the site. A screenshot has no hover states, no current
banners, no responsive behaviour, no DOM.

**Proof requirement:** cite one thing present on the live site that is
**absent from the captures.** A hover colour, a current promotional bar, a
footer link, a value visible only in the DOM.

This is deliberately impossible to satisfy without visiting.

---

## Rule 5 — The "not read" declaration is mandatory

Every report — the manifest, every phase report — ends with:

```
## Not opened
- <path> — <reason>
```

If nothing was skipped, the line reads `Not opened: none`. It is never absent.

The point is to make omission an **active statement** rather than a silence.
Silence is how skipped files disappear.

---

## Rule 6 — Inference gets labelled at the point of use

Any claim not directly observed is marked inline:

- `[OBSERVED]` — read it, this is what it says
- `[INFERRED]` — reasoned from something else; the basis is stated
- `[ASSUMED]` — neither; needs confirmation

An unmarked claim is treated as `[OBSERVED]` and must survive a spot-check.

This is what would have caught `Four_models_arranged_in_row → SHAPE-05` before
it was presented as a mapping. Marked `[INFERRED from filename]`, it's a
reasonable working guess. Unmarked, it's a fabrication.

---

## Rule 7 — Reading is a phase, and it is gated

Reading is not preamble to the work. It is Phase 0, its deliverable is
`EVIDENCE.md`, and it ends in a hard stop.

No design, no planning, no code until the manifest is approved.

Two hours of silence is a process failure, not an effort failure. A gate makes
it surface in ten minutes.

---

## Your spot-check — 60 seconds

When the manifest arrives, don't read it. Test it.

1. **Pick three items yourself**, ones the agent did *not* choose to quote.
2. Ask for a specific detail of each. For JSON: "what's the third gradient in
   record 12?" For an image: "what's in the bottom-right of image 31?" For a
   live site: "what colour does the primary button go on hover?"
3. **Verify one.** Just one — grep the file, open the image.

If the manifest holds under three random probes, it's real. If any answer is
vague, hedged, or arrives instantly with suspicious confidence, the read
didn't happen and nothing downstream is trustworthy.

Do this every time until it's boring.

---

## Paste-in block

Drop this into the top of any spec:

```markdown
## Evidence requirement — before any other work

Produce `EVIDENCE.md` before analysis, planning or code.

One row per file in scope: path, byte size, opened yes/no, and a specific
fact from inside that file that could not be guessed from its name.

Rules:
- A summary does not substitute for its raw source. Both are in scope.
- Structured data: cite 3 records by index/key with values from different
  fields.
- Images: one line per image describing actual content, any text visible,
  and near-duplicates. Never describe an image from its filename.
- Live sites: cite one thing present live and absent from any capture.
- End with "Not opened:" listing every skipped file, or "none".
- Label claims [OBSERVED] / [INFERRED] / [ASSUMED].

STOP after delivering EVIDENCE.md. Do not begin work until approved.
```

---

## Why this works when instructions don't

"Be thorough" and "read everything carefully" are unfalsifiable. An agent can
satisfy them sincerely while skipping the hard parts, because there's no point
at which the shortcut becomes visible.

An evidence manifest changes what's being asked. It doesn't request diligence,
it requests **artifacts that diligence produces as a side effect** — a hex
value from record 34, a description of what's in image 31, a hover colour that
only exists on the live page.

Those can be checked in seconds. That's the entire difference.
