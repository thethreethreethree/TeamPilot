# Demo readiness — 2026-09-24

**For:** the founder, before an investor presentation.
**Deployed:** `0081d5c6` on `origin/main`.
**Gate:** `npm run check` → `CHECK_EXIT=0`, 5511 passed, 15 skipped.
**Production build:** `npm run build` → compiled in 30.3s, full route table, **exit 0**.
(The twelve-step gate does NOT build — that is deliberate; CI runs `next build` with no secrets,
`.github/workflows/ci.yml:124`, and `npm run build:ci` reproduces it locally.)

---

## The honest headline

**I cannot tell you the system is ready, because nothing I did today ran against your database.**

Every fix below is verified by the twelve-step gate, by tests that fail when reverted, and — for
the visual ones — by screenshots I opened and described. None of it has been watched working on
real data, in a real browser, signed in as a real user. That is the single largest gap and no
amount of green CI closes it.

What follows is what I know, what I do not, and the three things worth doing before you present.

---

## 1. Do this before the demo, in this order

### a) Decide the demo path: with scored pitches, or without

The dashboards read `pitch_scores`. Until something scores pitches, **every Sales Coach dashboard
is empty by design** — Recordings, the leaderboard, best pitches, the breakdown, milestones, and
every Pattern Interrupt screen.

Coach Assessment now shows a panel — *"N recordings have never been scored"* — with a button. That
panel is honest and demoable in itself, but a room of investors seeing empty dashboards behind it
is a different presentation from one seeing populated ones.

### b) If you want populated dashboards, run this query FIRST

```sql
-- How many sessions the backfill would grade, and what it would cost.
select count(*) as would_be_scored
from coaching_sessions s
where s.company_id = '<your company id>'
  and s.session_kind = 'sales'
  and s.status in ('ended','reviewed')
  and not exists (select 1 from pitch_scores p where p.session_id = s.id);

-- And the one that could make it expensive: historical scores whose session link is gone.
-- `pitch_scores.session_id` is nullable with ON DELETE SET NULL (0252:92), so a row here means
-- a pitch that IS scored looks unscored to the backfill and would be graded again.
select count(*) as scored_but_unlinked
from pitch_scores where company_id = '<your company id>' and session_id is null;
```

**`would_be_scored` is the number of LLM grading calls the button will make.** If
`scored_but_unlinked` is above zero, tell me before pressing it — the anti-join needs a different
shape and I would rather fix it than have you pay twice.

### c) Walk the demo path once yourself, in the theme you will present in

Light mode in Sales Coach is **hours old** — it did not exist in that module until this morning.
I found and fixed four things that were invisible or unreadable on a light ground, and I have
rendered seven surfaces: the Sales Coach home, the Macro home, Recordings, Coach Assessment
(team AND rep-detail), the Door Log, and the backlog panel. Six more I have not.

**If you present in dark mode, you are on the path that has existed for months.** That is the lower
risk choice and I would take it.

---

## 2. What was fixed today, and how badly each one mattered

| Fix | What a viewer would have seen |
|---|---|
| `rejected_bonus` crash | The Recordings tab rendering **nothing** for any pitch where the scorer declined a bonus. `storePitchScore` writes those routinely. |
| No scoring pipeline | Every dashboard empty, permanently. `pitch_scores` had one writer reachable only from a button on one session page. |
| RepArena crash | A rep with one scored pitch opening Today's Metrics → Progress to a **blank screen**. Activated by the pipeline above. |
| Macro Mode one-way door | A rep turning Macro Mode on and being unable to turn it off, on mobile, forever. |
| Macro Mode settings | A Macro rep on a phone unable to reach settings at all — voice enrollment, rep goal, name, role. |
| Light-mode invisibles | A switch with no track, a pager showing one dot instead of two, cards with no borders, the pitch total washed out. |
| Duplicate sentence | The same line printed twice under "Needs your attention". |

Four of those seven are crashes or dead ends. Three are cosmetic in the sense that nothing throws,
and not cosmetic in the sense that a control you cannot see is a control you do not have.

---

## 3. What I have NOT verified

- **Anything against a real database.** Every test mocks its reads. "The Recordings list will fill"
  is inferred from the code path, not watched.
- **The backfill end to end.** Its contract is tested — the count is free, `suppressed` halts
  loudly, the loop terminates, nothing is re-billed — and the query behind it has never returned a
  real row.
- **Seven of thirteen Sales Coach screens**, in either theme: Pitch Performance / report card,
  Roleplay, One Liners, Sessions, Analytics, Settings, and the three Pattern Interrupt screens.
- **Pattern Interrupt at all.** Its detection only ever ran inside the scoring route, so no pattern
  has ever opened. Once pitches are scored it will begin producing them, on data nobody has seen.
  **This is the surface I would be least willing to demo live.**
- **Two Door Log failure states** — the send-failure banner and the mic-stopped alert — which use
  colours chosen for a dark ground and measure under AA on cream. Inferred from the hex, not
  rendered; I tried three times and stopped rather than keep guessing.
- **~253 `white/N` uses across 47 files** and **33 `text-ember-400` uses**. Suspect lists. Two of
  the six screens I rendered were completely clean, so these are not defect counts. The schedule
  module is the largest unexamined cluster — 54 uses across six pages.

---

## 4. If something breaks mid-demo

- **A blank panel inside Sales Coach** is most likely a wire-shape crash. Every one found today had
  the same shape: a component casting a 200 body to a type the route does not always send. It
  breaks the panel, not the page — navigating away and back is safe.
- **Empty dashboards are not a bug today.** They mean no pitch has been scored. The panel on Coach
  Assessment says so in those words, which is a better thing for an investor to see than a number
  nobody can explain.
- **Do not press "Score them all" during the presentation.** It makes one LLM call per recording
  and takes as long as that takes.

---

## 5. My recommendation

Demo in **dark mode**, on the **manager path** — Coach Assessment → a rep → Recordings — which is
the most-rendered, most-tested path in the module and the one the partner's design was drawn for.

Decide the scored-pitches question before you start, using the query in §1b, and run the backfill
**well before** the room, not during it.

Avoid Pattern Interrupt unless you have opened it yourself first.

---

## 6. Added after the brief was written: a phantom I nearly reported

Rendering the rep-detail path showed a close rate of **`0.129%`** in the Reps table while the team
card above it read **13%**. That looks exactly like a number wrong by 100x, on a screen investors
would see, and two sibling call sites DO use the `pct()` helper the table bypasses — which made it
look like a real inconsistency.

**It was my test fixture.** `readTeamAssessment.ts:196` already converts
(`Math.round(kpis.closeRate * 1000) / 10`), so `RepRow.closeRate` arrives as `12.9` and rendering
it raw with a `%` is correct. I fed it the ratio.

Third fixture-induced phantom of the day, and the one that mattered: I came within a message of
telling a founder his demo had a 100x numeric error, hours before the room.

**What IS real** is why it was so believable. One response object carries `closeRate` in two units:

| Field | Unit | Rendered by |
|---|---|---|
| `wire.reps[i].closeRate` | percentage (12.9) | raw, with a `%` appended |
| `wire.team.kpis.closeRate` | ratio (0.129) | `pct()`, which multiplies by 100 |
| `wire.detail[id].kpis.closeRate` | ratio (0.129) | `pct()` |

Every consumer matches today. Nothing structural stops the next one picking the wrong renderer, and
that failure is silent and 100x wrong.

**Not fixed today, deliberately.** The rename that removes the trap (`closeRatePct`) changes a WIRE
KEY: the server would send the new name and a browser holding the previous bundle would render
`undefined%`. The afternoon before an investor demo is exactly when not to take a deploy-window
risk for a latent problem.

What shipped instead: both type definitions now state their units and point at each other, and a
drift-guard test asserts the rep row is above 1 while the team KPI is at or below it — so
"normalising" either side fails by name. Verified by reverting the conversion; the test caught it.

**Nothing on screen is wrong because of this.** It is a trap for the next change, not a defect in
the current one.
