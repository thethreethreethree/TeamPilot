---
started_at: 2026-09-24T07:14:16Z
trigger: Rendering the report card's failed-read state showed its error message in pale salmon on near-white — the class I could only INFER on the Door Log two hours earlier, now observed. And a fourth fixture built from the wrong `outcome` enum.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the message that was right and unreadable

## The inference, finally observed

At 05:45 I recorded two Door Log failure states as **[INFERRED, NOT RENDERED]** — the send-failure
banner at `text-red-300` and the mic-stopped alert at `text-red-400` — with their hex values and an
honest note that I had tried three times to reach them and stopped.

Rendering the report card's failed-read state reached the same class by a different door. Its
message is `text-red-300` on a theme-following card, and on cream that is roughly 2:1.

The message itself is one of the better sentences in this product:

> Couldn't load your pitches — this is an error, not an empty history. Check your connection and
> try again.

That distinction — an error is not an empty history — is a thing this codebase argues about in
half a dozen files. Rendering it in a colour a person cannot read on their chosen theme undoes the
whole argument.

## Why the light theme is not a side case here

A door-to-door rep works outdoors. Daylight is exactly when a person switches to light mode, and
a rep on a doorstep is exactly who must not miss "the mic stopped — audio isn't recording".

Sales Coach had no way to reach light mode until a ThemeToggle landed in its header this morning.
So these have been unreadable-in-principle for months and unreachable-in-practice, and are now
reachable.

## The fourth fixture phantom, and what it is really about

My first fixture for this screen used `follow_up` and `no_sale`. The screen rendered them raw,
underscores and all, beside a properly-styled "Sold" pill — a perfect picture of an incomplete
label map on a screen a rep opens daily.

`OUTCOME_BADGE` covers all five `knock_outcome` values and the route reads
`door_knocks!inner(outcome)`. I had supplied `pitch_scores.outcome` values. No defect.

**Fourth time this session, on a field called `outcome`.** The schema has five vocabularies for
that name:

| Values | Where |
|---|---|
| `no_answer, sold, go_back, non_decision_maker, not_interested` | `knock_outcome` (0215) |
| `sold, follow_up, no_sale, no_contact, undecided` | sales sessions (0077) |
| `sold, follow_up, no_sale` | `pitch_scores` (0252) |
| `won, lost, no_decision` | KPI foundation (0205) |
| `held, reopened, inconclusive` | care learning engine (0036) |

Three contain the token `sold`. Nothing at a call site says which is in hand. It is the same shape
as `closeRate` carrying two units, recorded an hour ago — and it is the systemic reason my fixtures
keep being wrong.

## What could go wrong with the fix

1. **Changing dark.** A rep knows what these look like today. `dark:` variants preserve the exact
   current value; a single mode-agnostic red would be a redesign nobody asked for.
2. **Pattern-matching a badge as if it were text.** `LiveCoachingPanel:523` is a pulsing badge on
   its own red-tinted fill — different contrast problem, needs looking at rather than sweeping.
3. **Touching something already handled.** Several sites already carry `dark:` variants and must
   not be doubled.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The understanding is that a correct message in an unreadable colour is not a cosmetic defect — it is the message failing to be delivered." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "Methodology in the tree at the moment of action.",
    "how_this_build_will_embody_it": "Verified; the five outcome vocabularies were read out of the migrations rather than recalled." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "Layer 2 is whether the feature delivers its intended result to a real user.",
    "how_this_build_will_embody_it": "An error message exists to be read. One at 2:1 on the reader's theme has not delivered its result, which puts this at layer 2 rather than layer 4 despite being a colour." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "THINK first, then search; a bug rarely lives alone.",
    "how_this_build_will_embody_it": "One observed instance, then the sweep: ten across five components, each verified to sit on a theme-following surface rather than the fixed-dark shell." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-225", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "A user-specified experience is layer-2, not waivable layer-4 polish.",
    "how_this_build_will_embody_it": "The founder asked for light/dark on these screens. A light mode whose error messages cannot be read is not the thing that was asked for, so this is finishing that request rather than polishing it." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "Everything is an event and events are append-only; entity state is derived by replaying them rather than edited in place, because retrospective analysis depends on the history staying intact.",
    "how_this_build_will_embody_it": "No migration and no writes. Class names and a capture." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "The confident answer was 'the label map is incomplete', with a screenshot behind it. Reading the route killed it in under a minute — the fourth time today the same reflex was needed." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "The checklist; 5d asks whether the user specified the experience.",
    "how_this_build_will_embody_it": "5d, answered yes — light mode was requested this morning, and these screens are part of it." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "Having the label is not having the content.",
    "how_this_build_will_embody_it": "`outcome` is a label with five contents. That is not a metaphor here — it is the literal cause of four errors today." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "560-566", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "One name meaning different things across modules is a category of confusion, not an instance.",
    "how_this_build_will_embody_it": "Five vocabularies for `outcome`, three sharing the token `sold`. The clause's own test — would a reader's mental model survive moving between them — fails." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "The five vocabularies were extracted from the migration files this session, not listed from memory." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-698", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "One instance of a class; sweep to the boundary, and a pattern match is a suspect.",
    "how_this_build_will_embody_it": "The sweep found 12 matches and 10 were fixed — the two excluded are a badge on a red fill and sites already mode-aware, both read rather than pattern-matched." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-778", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "A lesson in prose returns unless a gate fails without the author's cooperation.",
    "how_this_build_will_embody_it": "theme-audit's paleText category covers -100/200 and stops at -300, which is why none of these were flagged. Extending it is a real gate and is NOT done here — the reason is in remediate.md." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-24T07:14:16Z",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "npm run check with its exit code, and before/after captures in both themes — including confirming dark did NOT change." }
]
```
