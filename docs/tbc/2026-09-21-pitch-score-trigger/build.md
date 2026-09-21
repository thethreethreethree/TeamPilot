# BUILD

## Files

**`src/app/api/coach/sales-session/pitch-score/route.ts`** (new)

POST `{ sessionId }` → scores and stores. GET `?sessionId=` → reads back.

Shaped on the sibling `sales-session/dissect` route deliberately: same rate limit, same
`callerScopedDb(req) ?? createClient()` resolution, same `getSession` gate, same
`maxDuration = 60`. A second convention for the same job is a second thing to keep right.

The five resolutions it makes, each with its own test:

| | Resolved as | Not |
|---|---|---|
| Whose score | `session.agentId` | `auth.user.id` |
| When | `session.startedAt` | `now()` |
| How long | `audioDurationSeconds`, else `endedAt − startedAt`, else null | wall-clock always |
| Which sessions | `sessionKind === "sales"` only, 409 otherwise | anything with a transcript |
| Outcome | three values mapped, others null | forwarded |

The session-kind refusal sits **before** the LLM call. Scoring a huddle and then discarding it is
the empty-but-billed shape (A40 question 4) with the cost paid and nothing to show.

`FAILURE_MESSAGE` maps each engine failure to something a person can act on, and the status splits
422 (`no_agent_turns` — your recording, and you can fix it by recording again) from 502 (the other
three — our fault, and saying so is the point).

**`src/lib/coach/pitchScore/readPitchScore.ts`** (new)

Reads through the **caller's** client, not the service role: `pitches` RLS already encodes who may
see a score, and reading with the service role would replace that rule with whatever the route
remembered to check.

Section totals come from the stored verdict. This is the one place the read side could have undone
0254 — summing element rows is the obvious implementation and it is wrong on every objection-free
pitch. A pitch stored before 0254 has no `section_points` and gets an **empty list**, not a
re-summed guess: a wrong reconciliation on this screen is worse than an absent one, because the rep
would see a Delivery figure contradicting their own score with no way to tell which is right.

Three smaller decisions, each tested:

- Elements are returned in **rubric order**, not the order the model graded them. A rep reading
  their pitch back expects Introduction before Close.
- A **retired** element id is kept, labelled with its raw id and a null section, rather than
  dropped. Its points are in `base`; hiding the row leaves points nothing on screen accounts for.
- A null timestamp stays **null**, never 0. Zero is a real offset — the start of the recording —
  so coercing sends the play button to the beginning and presents that as where the evidence was.

**Tests:** 30 route + 10 reader.

## Not built

- **No UI.** Nothing renders a Pitch Score yet.
- **No automatic trigger.** Scoring is on-demand only. Whether it should run on session finalize
  is a founder decision, not an implementation detail — it spends an LLM call per session. R1.
