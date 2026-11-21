# 01 — Scope

**ELOSTATE Remote Sales System (RSS):** the part of Sales Coach that captures, scores and coaches
**phone and video** sales sessions. It is brought to Gong's level on coaching, and it is added to
the live ELOSTATE (TeamPilot) app, not built as a new app. [ASSUMED — D1]

Source of every gap named here: the *Gong vs ELOSTATE* comparison (code at commit `0214913`) and
the follow-on doc *Gong vs ELOSTATE: what it takes to match* (Part A). Feature IDs (F15.15, …) are
the Gong Teardown's.

## The entity and its lifecycle

**Entity:** a remote sales session = a `coaching_sessions` row with `session_kind = 'sales'` and
`context in ('phone','video')`. `phone` is new (0272). The single source of the lifecycle is
`src/lib/coach/remote/session/state.ts`.

| State | Who moves it here | What must be true first |
|---|---|---|
| `live` | Rep starts a session | Rep has completed voice enrollment (existing gate) |
| `uploading` | Rep or system | Audio is arriving (live chunks or a file) |
| `awaiting_outcome` | Rep ends the call, or the system ends a stale one | — |
| `transcribing` | **Rep, only through `closeWithOutcome()`** | An outcome from `sold · follow_up · no_sale · no_contact · undecided` |
| `analyzing` | System | Transcript landed |
| `scoring` | System (first time) · **manager only** (re-score, with a reason) | It's a sales call above the scoring floor (D5) |
| `scored` | System | Score saved with provenance (model, prompt version, rubric version) |
| `not_scored` | System | Reason `BELOW_SCORING_FLOOR` or `NOT_A_SALES_CALL`, recorded |
| `failed` | System | Reason from the closed list in `session_failures`, recorded |

Retry: `failed → transcribing` by the system or a manager, never the rep. Points are banked once
per session (existing ledger, `bankPoints.ts:23`) and a re-score never changes them.

## Who uses it

| Role (existing) | What they can do in RSS |
|---|---|
| **Rep** (`sales_coach_role = 'staff'`) | Run and upload remote sessions; must pick an outcome to close; see own scores, stats, trackers, evidence; dispute (existing); request feedback from anyone above them; build personal library folders and saved searches; do assigned practice. **Cannot** re-score, trim, delete, or change a due date. |
| **Manager** (`sales_coach_role = 'admin'`) | Everything for **their own reports, at any depth** (new: today they see the whole company). Comment, override (existing), re-score with a reason, clip snippets, create company folders, create trackers and scenarios, assign training, trim recordings. |
| **Company admin** (role in `admin_roles()`) | Whole company (D2 stand-in). Retention setting, erasure requests, audit log, webhooks. |
| **ELOSTATE vendor admin** (existing back office) | AI cost ledger and prices. Tenants can't see these. |

## What carries across from the live app (reused, not rebuilt)

Transcription and diarization (ElevenLabs Scribe, versioned segments 0269/0270) · voice enrollment
and "which voice is you" · the pitch-score engine with evidence, overrides with a reason, disputes,
backfill · points ledger, scoreboards, praise alerts · recording comments and the rep-consent share
flow (0259/0260) · Pattern Interrupt · team training brief · Tasks module · Chrome extension live
copilot · KPI layer and CSV.

## What does NOT carry across

- **Door Log machinery:** knocks, door outcomes, the day target, macro mode. Door sessions don't
  change except for the shared foundations (Phase 0).
- **Pitch-score rubric content:** the AT&T Fiber door rubric is not a phone or video rubric (D6).
- **The "any manager sees everything" rule:** replaced by the reporting tree, once admins have set
  managers.
- Anything in the "Deliberately not built" table in `00-OPEN-DECISIONS.md`.

## Done means

A phone rep uploads (or live-records) a 20-minute call and closes it with an outcome. They watch it
go Uploading → Transcribing → Analysing → Scoring → Ready. They open a session page with talk-time
lanes, interaction stats, tracker hits, a scored rubric with evidence, and, if no phone rubric
exists, the caveat. Their own manager (and only their manager chain) gets the strong-session alert,
can listen (logged), clip a snippet, comment, and answer the rep's feedback request.
