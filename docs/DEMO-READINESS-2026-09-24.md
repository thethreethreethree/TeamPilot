# Demo readiness — 2026-09-24

**For:** the founder, before an investor presentation.
**Deployed:** `1fac5e91` on `origin/main`. *(Was `0081d5c6` when this was written; six commits have
landed since, and the sections below are amended in place rather than appended to — advice that has
become wrong is changed where you would read it, not corrected in a footnote.)*
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

**AMENDED — all thirteen Sales Coach screens have now been rendered in both themes and looked
at.** When this was written, seven had been. See section 8 for what the remaining six turned up;
the short version is that Roleplay was the worst screen in the module on a light ground and is
fixed.

**Dark mode is still the lower-risk choice, but for a smaller reason than before.** It is no longer
"light mode is unverified in this module" — it is "dark mode has been in real use for months and
light mode has been in real use for a day." Within Sales Coach, the two are now close. Outside it —
the schedule module in particular — light mode remains unexamined.

**Walk it once yourself either way.** Nothing in this document replaces that.

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
- ~~**Seven of thirteen Sales Coach screens.**~~ **AMENDED: none. All thirteen have been rendered
  in both themes, one image at a time.** Sessions and Settings were reached through the surfaces
  that embed them. See section 8.
- **Pattern Interrupt's real output.** Its detection only ever ran inside the scoring route, so no
  pattern has ever opened on live data. **See section 7 — I rendered it and withdrew my advice to avoid
  it.** What remains unverified is what REAL detection produces, not whether the screen works.
- **Two Door Log failure states** — the send-failure banner and the mic-stopped alert — which use
  colours chosen for a dark ground and measure under AA on cream. Inferred from the hex, not
  rendered; I tried three times and stopped rather than keep guessing.
- **~253 `white/N` uses across 47 files** and **33 `text-ember-400` uses**. Suspect lists, and now
  known to be an **UNDERCOUNT of unknown size**: every sweep I ran today matched `border|bg|text`
  and the full property list is `border | bg | text | stroke | fill | divide | ring | from | to |
  via`. The unlit ticks on your dial gauges were `stroke-white/15` and were invisible to all of it
  — found by looking at a picture, not by grepping. The schedule module is still the largest
  unexamined cluster: 54 uses across six pages.

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

That recommendation has not changed, but the margin has narrowed: all thirteen screens now render
correctly in light mode too (section 8). The reason to prefer dark is now usage history, not
verification.

Decide the scored-pitches question before you start, using the query in section 1b, and run the backfill
**well before** the room, not during it.

Pattern Interrupt is fine to show — see section 7. That reverses what this document said an hour ago.

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

---

## 7. Correction: Pattern Interrupt is worth showing

Sections 3 and 5 originally told you to avoid this screen. That advice was honest and **unverified** — I
had never seen it. I have now rendered both states and I am withdrawing it.

**The empty state — which is every account today — is a selling point, not a liability.** It reads:

> **Nothing has been scored yet**
> Patterns come from scored pitches. Once your recordings are scored against the rubric, repeated
> misses show up here.

Above it sits an explainer: *"Patterns, not one-off mistakes. A pattern appears when the same miss
shows up in 3 or more of a rep's last 10 pitches. Your manager sees this same page. Use the clips
to hear it for yourself, then practice the fix in Role Play."* Four counters read 0 with honest
captions — "Yours right now", "Not coached yet", "Trending the right way", "5 clean pitches in a
row".

That is the no-instant-results thesis made visible: the product declining to invent a number it has
not earned, and saying exactly what would make it real. An investor asking "what happens on day
one?" is answered by this screen better than by a slide.

**The populated state renders correctly too.** A pattern card with a ten-dot miss strip and its
legend; a detail panel giving the cost in points per pitch, the days open, the resolved verdict
("Coached 6 days ago; no clean streak yet"), an explicit PATH TO FIXED ("Done right in 5 pitches in
a row. Clears automatically" · "0 of 5 clean pitches in a row"), a link from the pattern back to the
recording it came from, and the coaching note threaded with its author and date.

**What is still unverified:** I rendered it with a pattern I constructed from the type definitions.
Real detection output — rubric labels, strip contents, edge cases — has never been seen, because
nothing has ever produced one. So the SURFACE is sound and its DATA is untested, which is a much
narrower caution than "do not demo this".

---

## 8. The render pass is finished — thirteen of thirteen

Six more screens since section 3 was written: Pitch Performance, Analytics, Roleplay (three
phases), One Liners (three states), and the two Pattern Interrupt states. Both themes, one image at
a time, twenty-six images opened in this stretch alone.

### What it found that matters to you

**Roleplay was the worst screen in the module on a light ground, and it is the one an investor is
most likely to ask to see.** Three defects on one page:

- Half the conversation had **no bubble**. The rep's lines rendered as solid ember; the AI
  prospect's rendered as bare text on cream. A messenger where only one side has a shape.
- A rep **could not read the sentence they were typing**. The composer sits on a deliberately dark
  bar, and its text colour followed the theme — so on light mode it was near-black letters on a
  near-black field. It is the only input on the page.
- Every card in the practice review **lost its border**, turning a four-card report into a wall of
  text.

**Your dial gauges had no rings.** On the Macro home — the screen a door-knocking rep lives on —
"3 of 80" rendered as the number with a single ember tick floating below it. The unlit ticks were
white at 15% opacity, which is a ring on black and nothing at all on cream.

**I had been fixing the same defect one screen at a time for eleven screens.** The twelfth showed
it on a page with no such value in it — which located the cause: `ui/deck.tsx`, the shared card kit
the whole module imports. Fixing it there corrected One Liners without that file being touched.
That is why the last screen took one line instead of thirteen.

### The honest arithmetic of the whole pass

**Fifteen real defects. Eight false alarms. Four screens that were already clean.**

One finding in three was not real, and every one of them was convincing. Two of them looked like
numbers wrong by 100× — the `0.129%` close rate in section 6, and a `-6750` on a rep's headline
score gauge that appeared in both themes and was really in the page. Both were my own test
fixtures. I came close to telling you twice today that your demo had a numeric error.

I am telling you the false-alarm rate because a tool that is wrong a third of the time is dangerous
if its output is trusted rather than checked, and you should know which one you are being handed.
Every finding above was checked against the code that produces it before it reached this document.

### What this does not cover

A capture proves how a shape **renders**. It never proves the shape **arrives**. Every populated
screenshot in this pass was drawn from a fixture I wrote, so what remains untested is exactly what
section 3 said at the top: nothing here has run against your database.

**Not opened:** six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in the webstore promo kit, and the two WhatsApp JPEGs.
