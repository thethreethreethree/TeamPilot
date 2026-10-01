# Website + Mobile App — Unified Pipeline Plan

**Written 2026-09-25.** For the founder, and for the agent who builds it. Everything marked
[OBSERVED] was read or run on 2026-09-25; nothing here is assumed without saying so.

---

## The two requirements (the founder's words, and the acceptance test for every phase)

1. **"This needs to be a seamless and flawless connection."**
   → A change to anything the app and website share is made **once**, in one place, and a build
   **fails** if one side would break. Sync is enforced by structure, never by someone remembering.

2. **"It is vital that our current app and website do not suffer from this connection."**
   → No phase may change what the live website or the app does, until that phase's evidence shows it
   didn't. Every phase is measured against a baseline taken **before** it starts, and can be undone.

A phase is done only when it passes both. Passing one is not done.

---

## What exists today

| | Website | Mobile app |
|---|---|---|
| Where | `TeamPilot` repo, branch `main` | **Same GitHub repo**, branch `elostate-sales-coach-app`, a **separate history** (no common ancestor with `main`) — local copy at `C:\Users\johns\IOS-APP\Elostate-Sales-coach` [OBSERVED] |
| Stack | Next.js 16, React **19.2.6**, TypeScript **5.9**, Vitest | Expo SDK 57, React Native 0.86, React **19.2.3**, TypeScript **6.0**, `node --test` [OBSERVED] |
| Ships to | Vercel project `team-pilot` → elostate.com | EAS (`elostate-tech`), App Store Connect app `6808480147`, bundle `com.elostate.salescoach` (iOS + Android) [OBSERVED] |
| Backend | Supabase + its own API routes | The **same** Supabase (anon key + the rep's own login) and the **same** website API routes, via a Bearer token the website accepts on 44 routes since 2026-09-03 [OBSERVED] |
| Gate today | 12-step `npm run check` — 5,538 tests pass | `tsc` clean, **1,551 tests pass** (the README's "930" is stale) [OBSERVED] |
| Proven on a phone? | n/a | **It has run on one; it has not been formally checked.** The founder's `REV 1.pdf` shows it on a real iPhone on 10 Sep (recording queue, "15 recordings waiting to be sent") [OBSERVED]. `DEVICE-CHECK.md` (26 checks) has essentially none marked done [OBSERVED]. *Corrected 2026-09-29 — this row first said "No".* |

### The gap this plan closes

**25 files in the app declare themselves hand-copies of website code** [OBSERVED] — API response
types (`types/backend.ts`, "checked against the web repository on 4 September"), pitch-score types
("copied from aggregate.ts on 2026-09-22"), speech-presence and voice/pitch detection ("PORTED TERM
FOR TERM"), the rubric, KPI scope, day target, chat, crash reporting, and more.

Every copy is a place where the website changes and the app silently goes stale — nothing fails.
Two live examples from today alone:
- The website gained a new scoring refusal, `provider_out_of_credit`. The app has never heard of it.
- The app calls `practice-scenario/from-pitch`, which has returned 402 since 2026-09-22 (the DeepSeek
  balance) — the app's copy of the error handling was written before that failure mode existed.

### A risk that existed, now closed

The app's rules and design gates live in `C:\Users\johns\IOS-APP\`, which is not under git [OBSERVED].
*Corrected 2026-09-29:* this first said the constitution and gates were at risk. On inspection, **52 of
the folder's 61 files are byte-identical to files already tracked** in the app's `BUILD-STARTER V3 APP
SYSTEM/` kit folder — the constitution and G1–G4 included — and `IOS-APP/.gitignore` keeps the kit's law
files out of git on purpose. **Nine files existed nowhere else** (the app's `DESIGN-CONTRACT.md`, the
founder's `REV 1.pdf`, the customised settings and read gate, the LAW 1 ledger, three scripts). They are
now backed up in the app's `governance/` folder — commit `c5b3891f` on `elostate-sales-coach-app`.

---

## The shape we are building

```
TeamPilot/                    ← one repo, one `main`
├── src/ …                    ← the website, EXACTLY where it is today (Vercel untouched)
├── mobile/                   ← the Expo app, moved in WITH its full history
│   └── (its own package.json, its own node_modules, its own lockfile)
└── packages/core/            ← the ONE copy of everything both sides must agree on
    ├── contract/             ← API request/response shapes + runtime validators
    ├── rules/                ← pure logic both run (scoring labels, speech presence, …)
    └── enums/                ← closed sets both must handle (refusal reasons, statuses, periods)
```

### Three decisions inside that shape, and why

**1. The website does not move.** It stays at the repo root. Moving it into `apps/web` would change
every path, the Vercel build and the CI — maximum disruption for zero gain. Requirement 2.

**2. Separate installs, shared source.** [OBSERVED] the website runs React 19.2.6, and React Native
pins React 19.2.3 exactly. A single shared install (npm workspaces with hoisting) would force one
side onto the other's version — the website suffering, by construction. So each side keeps its own
`node_modules` and lockfile, and `packages/core` is **plain TypeScript source** that each side
compiles itself: the website through its `@/` path alias plus Next's `transpilePackages`; the app
through Metro's `watchFolders` plus a TS path alias. Nothing is installed from it.

**3. `packages/core` may import nothing platform-specific.** No `next`, no `server-only`, no Node
built-ins, no Supabase server client, no React Native. Enforced by a new invariant in
`scripts/invariant-audit.mjs` that fails the build — not by a comment asking nicely.

### What makes it "flawless" rather than "careful"

- **Closed sets are types.** A refusal reason, a pitch status, a period is a union exported from
  `core/enums`. The app maps each one exhaustively (`Record<Reason, …>`), so the day the website adds a
  reason, **the app stops compiling** until it says what to show. Today's `provider_out_of_credit`
  would have been caught this way.
- **Responses are validated at runtime on both ends.** Each shared route has a validator in
  `core/contract` (Zod — the website already uses Zod 4; the app adds it). Website route tests assert
  the route's real output passes its validator; the app parses every response through the same one. A
  shape change fails the **website's** CI before it can deploy — not a rep's phone a week later.
- **An installed app is always older than the website.** A phone that hasn't updated still calls
  today's API. So: API changes on shared routes are **additive only** (new optional fields, new
  routes); removing or renaming anything requires a versioned route and a minimum-app-version check.
  This is the rule that most protects requirement 2 once the app is in reps' hands.
- **One CI run tests both.** Any change runs the website's 12 steps, the app's `tsc` + tests + design
  gates, and the contract tests. Path filters only ever *add* jobs; they never skip the contract.

---

## The phases

Every phase has an **entry baseline**, an **exit test** against both requirements, and a **rollback**.
No phase begins until the previous one's exit test is green.

### Phase 0 — Safeguard and baseline *(nothing moves)*

1. ~~Put `IOS-APP/`'s governance under version control.~~ **Done 2026-09-29** (`c5b3891f`): the 9 files
   not already tracked via the kit, verbatim; app `tsc` clean and 1,551/1,551 tests after.
1b. Find out what became of the founder's `REV 1.pdf` requests (Home "start knocking" button placement,
   Door Log "doors knocked" + "Next 5 door focus", Macro Mode wording, automatic pitch titling/labelling,
   "practicing", a separate manager dashboard). **Checked 2026-09-29** against the app's history
   [OBSERVED]: six shipped in `8dec5e94` (09-11) — "Doors knocked", "See today's metrics" and "Undo last"
   removed, "Next 5 door focus", the Macro Mode wording, "practicing". Automatic naming after a pitch was
   built later (`66e39029`). **Still waiting on the founder since 09-11:** "start knocking at the bottom",
   "take out today's performance", and whether Macro Mode ON means short-form (the builder's reading).
   All of it goes on the device-check list — none of it has been seen on a phone.
2. **Prove the app on a real phone** — `DEVICE-CHECK.md` Part 1 (a development build via EAS; no Mac
   needed, EAS builds in the cloud), then Part 2's 26 checks. **The founder's phone is required here;
   nothing on this laptop can substitute.** Findings are fixed in the app as it is today.
3. A **TestFlight build** to the founder and John — the first time the app meets real use.
   **Build 28 submitted 2026-10-01** (founder's go-ahead in a picker): iOS production build of the app's
   main line at `04246628`, EAS build `0827c8db`, submission `33c6f5da` finished 14:16Z to App Store Connect
   app 6808480147. Apple's processing into TestFlight was not observed from here. It carries everything since
   build 27 (22 Sep), including the quiet undo (merged `62b738f5`); `DEVICE-CHECK.md` checks 42-44 cover the new parts.
4. Record the baseline: website gate + a production smoke of the routes the app calls; app `tsc`,
   1,551 tests, G1–G4, and the device-check results.

**Exit:** device check done and recorded; TestFlight build installed on two phones. *Rollback:* none
needed — nothing was changed.

### Phase 1 — Bring the app into the repo *(still no shared code)*

1. Merge the app into `main` under `mobile/` **with its full history** (a subtree merge of
   `elostate-sales-coach-app` — unrelated histories are expected and allowed).
2. Fence the website off from it: `mobile/` excluded from the website's `tsconfig`, ESLint, Vitest,
   the invariant audit's scan, and the Vercel build (`.vercelignore`), so a website build cannot see
   the folder exists.
3. Point EAS at `mobile/` and rebuild. CI gains a mobile job.

**Exit:** the website gate's output is identical to Phase 0's; a production deploy from the new `main`
serves the same build; the app's 1,551 tests, `tsc` and G1–G4 pass from `mobile/`; a new TestFlight
build behaves identically on the same device checks. *Rollback:* revert one merge commit — the old
branch is left in place, untouched, until Phase 3 is complete.

### Phase 2 — Shared contract types *(types only, zero runtime change)*

Create `packages/core` with the closed sets (`enums/`) and the response types for the routes the app
calls. Both sides import them; the hand-written copies (`mobile/src/types/backend.ts`, etc.) are
deleted **only after** both sides typecheck against the shared version.

**Exit:** both typecheck; both test suites unchanged in count and result; no runtime file changed.
*Rollback:* per-file — each move is its own commit.

### Phase 3 — Shared logic, one module at a time *(the strangler)*

For each of the 25 copied modules, in this order — lowest risk first:
labels & enums → pure calculations (day target, KPI scope, rubric) → parsing (pitch-score types,
pitch detail) → **audio and voice logic last** (speech presence, pitch separation, enrollment).

For each one:
1. **Parity test first.** Run the website's original and the app's copy on the same inputs. If they
   differ, **that is a finding** — the two have already drifted, and which one is right is decided
   (by the founder where it's product behaviour) **before** anything moves.
2. Move the agreed version into `core/rules`; both sides import it; delete both copies.
3. Both gates, and for audio/voice modules a device re-check.

**First parity run, 2026-10-01** (ahead of Phase 1, because it changes nothing): 9 comparisons across
speech presence, pitch detection, calibration, roles and score labels; one difference, a label's
capitalisation, fixed in the app. Method, script and results: `docs/mobile-parity/README.md`.

**Exit (per module):** parity proven; both suites pass; no user-visible change. *Rollback:* that
module's commit.

### Phase 4 — Runtime contract

Add validators for each shared route. Website: a test per route asserting its real output passes.
App: every response parsed at the boundary; an unknown enum value or extra field degrades to an
honest "update the app" state rather than a crash or a silent zero. Add the minimum-app-version check.

**Exit:** changing any shared route's response shape fails the website's CI (proven by mutation — break
a field, watch it fail, restore). *Rollback:* validators are additive.

### Phase 5 — The release pipeline

- **Website:** unchanged — `main` → Vercel.
- **App, JavaScript-only changes:** EAS Update (over-the-air) on a `production` channel — reps get it
  on next launch, no store review.
- **App, native changes** (a new native module, an SDK upgrade): EAS Build → TestFlight → App Store /
  Play internal track, then production.
- A shared-code change ships to **both** the same day; the additive-only rule means the website can
  deploy first safely.

**Exit:** one change to a `core` module reaches elostate.com and the installed app through the
pipeline with no manual copying. That is the definition of "seamless".

---

## What only the founder can do

| When | What | Why it can't be done from here |
|---|---|---|
| Now | **Top up DeepSeek** (separate from this plan, but the app's AI features share it) | Billing account |
| Phase 0 | Run the device check on your phone; install TestFlight | Needs a real phone |
| Phase 0 | Confirm EAS / Apple Developer access for `elostate-tech` | Account credentials |
| Phase 3 | Decide which version wins wherever a parity test finds the two have drifted | Product behaviour |
| Phase 5 | Approve the first App Store submission | Store account |

## What can be built from this workspace

Everything else: the repo merge, `packages/core`, every parity test, the invariants, the validators,
CI, and EAS configuration. iOS builds run in EAS's cloud, so no Mac is needed; they are **started**
from here and **installed** on your phone.

---

## Risks, named

| Risk | Where it bites | Defence |
|---|---|---|
| The website's React is shifted by the app's | Phase 1 | Separate installs; nothing hoisted (decision 2) |
| A website deploy breaks installed apps | From Phase 5 on, forever | Additive-only shared routes + min-version check |
| A "shared" module quietly behaves differently on one platform | Phase 3 | Parity test before every move; device re-check for audio |
| `core` pulls in a server-only import and the app bundle breaks | Phase 2+ | Invariant that fails the build |
| The app's design gates are lost | **Now** | Phase 0 step 1, before anything else |
| The app has a defect nobody has seen because it has never run on a phone | Phase 0 | The device check comes before any restructuring, so a later bug can't be blamed on the move — or hidden by it |

## Not opened

The app's `SALES-COACH-BUILD-ARCHITECTURE/` (8 docs), `APP-STORE-SUBMISSION.md`, `APP-STORE-LISTING.md`,
`SALES-COACH-DASHBOARD-REPLICATION-SPEC.md`, the full text of `DEVICE-CHECK.md` beyond its headings, and
`IOS-APP/01-CONSTITUTION.md`. They were located and their existence is cited; their contents were not
read and nothing in this plan relies on them. The phase that touches each reads it first.
