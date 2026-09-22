# EVIDENCE — the fourteen sources behind `MOBILE-BUILD-PLAN.md`

**Read 2026-09-22.** Every file in `source-files/` was opened and looked at before the plan was
written (R7: reading is Phase 0). The copies in `source-files/` are byte-identical to the
originals in `TeamPilot/docs/SYSTEM UPDATES AND REVISION 09-22-2026` — verified by md5, all 14.

One line per file, with **a fact from inside it** rather than from its name (R1). Images get one
line each, opened one at a time (R3, LAW 1a).

---

## Specs

| File · size | A fact from inside |
|---|---|
| `EloState Coaching Build Plan  Engineering Guide.pdf` · 8 pp · 268,288 B | Step 2 is titled "Build the rep dashboard (**mobile**)" and its item 4 says the Scoring rubric is "read-only, rendered from `rubric_config` so it never goes stale". Page 2's dependency graph is `A[1.Pitch Score engine] --> B[2.Rep dashboard]`, `C --> D[4.Recordings tab]`, `D --> E`. The KPI block defines Presentations as "recorded pitches (**confirm this with John before building**)". Page 7's launch checklist demands "Every period reconciles: sections sum to base; base + bonus − violations = avg score". Page 8 lists five Open decisions; #3 is Partial-as-miss, "The mockups count Missed." |
| `EloState AT&T Fiber Pitch Scoring Rubric.pdf` · 7 pp · 227,106 B | Delivery is 8+7+7+5+4+4 = 35, and "**If no objection occurs, the other delivery skills are scored out of 27 and scaled to 35.**" Discovery→Speed test is 4 pts, "Run live; calling the number before it appears is required for the full 4." Four things "must never be graded for accuracy": bill/speed numbers, promo prices, timeline claims, the customer's current provider. Page 7: "keep the existing letter grade and skill scores in Debrief; the Pitch Score runs alongside it." |
| `WHATSAPP.txt` · 143 B | The whole file, verbatim: *"Pages 1-2 will one on the app. Page 3 will be on the web version. Page 4 will be the "score rubric" button that is on page 1 and 2 (on the app)"* — the instruction that assigns mobile scope. |

## The rep boards — the mobile source

| File · size | A fact from inside |
|---|---|
| `EloState Rep Pitch Dashboard.pdf` · 4 pp · 3,483,269 B | p1's milestone strip shows a caption **only when unearned**: amber *First pitch 12 Aug*, *Triple digits 18 Sep*, *In the door 10 Sep* carry dates; grey *Full bundle* "DTV + Wireless + ADT in one pitch", *Clean sweep* "Every phase fully hit", *Century* "100 scored pitches" carry criteria. p2 carries **exactly one** callout and the LOWEST section expands **inline inside its own card** to "Catch: qualification 2.4/3 — 72% hit · 16% partial · 12% missed"; its footer reads `68.9 base + 14.6 bonus − 3.2 = 80.3 avg`. p3's violation row is "Talking over customer ▶ **5:12** −2". p4 states "Buying questions **+2 ea, Max +6**" and "Talking over customer −2 ea, **Max −6**". Bottom tab bar on p1/p2: Home · Pitch Performance · **Today's Metrics** · Role Play. |

## Manager boards (context — none of these is a mobile surface in this revision)

| File · size | A fact from inside |
|---|---|
| `Coach Assessment  manager dashboard (web).pdf` · 1 p · 3,035,030 B | "Needs your attention · 4 items" leads with *Anthony A. · Rude or dismissive flag — Pitch on Thu 17 Sep, −10 applied. Confirm or remove.* The reps table has **no Counted column** and is "Ranked by total points this week". The rep panel's SKILL SCORES read Talk/listen **D·3**, Tone B·7, Speed of speech **—**, Questions B+·8, Objections C−·5, Closing C−·5. |
| `Coach Assessment  Recordings tab open (web).pdf` · 1 p · 3,180,115 B | Player header: "Sep 18 · 4:40 PM · 11:02 / **Maple Ct** · Sold" with "58.5 base +5.0 −2.0 = **61.5**". The 44.0 row shows "**Not counted**" in the position where other rows show their pattern-moment count. KEY MOMENTS ends "9:05 · You: 'This clarifying question saved the sale.'" and the transcript at 7:22 is **speaker-labelled** (Humza / Customer / Humza). |
| `Pattern Interrupt  rep (web).pdf` · 1 p · 1,572,847 B | Rep nav is **MY COACHING**: My Progress · Pattern Interrupt [NEW] · Role Play. Strip legend: ● Missed ● Done right ● **Not applicable**. Rep actions: **Practice in Role Play · Reviewed ✓ · This clip looks wrong**. COACHING NOTES carries both voices — *Manager · Sep 18* and *Humza Khan · Sep 18 "Reviewed. Running it before shifts this week."* |
| `Pattern Interrupt  manager Patterns (web).pdf` · 1 p · 1,832,671 B | Opened at full resolution earlier this session. Banner: *"Reps see their own Pattern Interrupt page, **clips and your notes included**, so nothing here is a surprise."* Four actions: Assign Role Play drill · Add note · Mark as coached · Schedule check-in. Cards 12 / 5 / 2 / 6. |
| `Pattern Interrupt  manager Rep progress (web).pdf` · 1 p · 1,649,160 B | Opened at full resolution earlier this session. Five cards including **AWAITING REP REVIEW 1** "Coached, clips not opened" and **POINTS RECOVERED +10.0**. Table rows print the first-5-vs-last-5 comparison literally: `3/5 → 3/5 →` (Stalled), `4/5 → 1/5 ▼` (Improving). Timeline legend Ⓒ Coached · Ⓓ Drill assigned · Ⓡ Rep reviewed. |

## Images (R3 — one line per image, 2 files, 2 lines)

| File · size | A fact from inside |
|---|---|
| `WhatsApp Image 2026-09-20 at 04.50.33.jpeg` · 382,356 B · **rendered** | The interactive canvas: four dark phone frames on a light-grey ground, each with an outlined **▷ PLAY** button beside a truncated title — "Progress", "Breakdo…", "Pitch det…", "Scoring r…". **All four are drawn in phone frames**, which is why the guide called all four mobile; `WHATSAPP.txt` then reassigns p3 to web. Board 1 shows the amber WEEK 38 SHOWDOWN card, the radial gauge at 80.3, and the four digit tiles `1 4 4 5`. Lower resolution than the PDF; three values read off it were later corrected against the PDF. |
| `WhatsApp Image 2026-09-20 at 05.45.13.jpeg` · 234,820 B · **rendered** | A light-theme **screenshot of the live Training page**, not a mockup. Left rail: Home, Meeting Coach; MANAGER DASHBOARD → Coach Assessment · Score Calibration; TEAM TOOLS → Roleplay · **Training** (active) · Team, then Team Chat, KPI Analytics, Scoreboard, My Progress, Browser extension, Settings. Body: "Ready — generated **Sep 18 at 11:00 PM**", WORK ON AS A TEAM carrying the same three priorities *verbatim and in the same order* as the manager dashboard's priority cards, RUN THIS DRILL "Bill Anchor to Called-Shot Speed Test" in five steps, ONE FOCUS EACH for four named reps. **Neither JPEG is the rejected banner image** that `LOGIC-AND-CONTRADICTIONS.md` §H describes. |

## The project's own records

| File · size | A fact from inside |
|---|---|
| `LOGIC-AND-CONTRADICTIONS.md` · 39,944 B · 717 lines, read in full | §C1: Transitions **4.7** is the lowest absolute section score, yet **Close 8.6** carries the LOWEST badge — because `8.6/15 = 57.3%` < `4.7/8 = 58.8%`. §B3: a presentations definition that produced "18 spoken to, 3 recorded, and 10 sold — a close rate of **333%**". § L(resolved): the founder's rep-visibility ruling and its test, *"is this a target or a position?"* |
| `TWO-SCORING-SYSTEMS.md` · 5,132 B, read in full | The milestone row: *"UNBUILT, AND TWO ALREADY OVERLAP. `spark` is 'First pitch scored' and the design has 'First pitch'. `century` is '100 sessions' and the design has 'Century — 100 scored pitches'. Built fresh, a rep earns two First-pitch badges and two Centuries under different names."* And the rank row: `competitionRanks` is **standard** competition ranking (1-2-2-**4**), not dense. |
| `EVIDENCE.md` (the source folder's own) · 13,517 B | Records three rubric records checked against `src/lib/coach/pitchScore/rubric.ts` — `disc.speedTest` 4 pts, `trans.closeToQualify` 2 pts, `deliv.spokenYes` 4 pts, all matching verbatim. Also its own correction: three values first read off the canvas JPEG were wrong (buying questions cap **+6** not +8; talking-over **−6** not −8; "not enough questions" below **3** not 5). |

---

## Three records checked against the target repo (R2 — the source is not discharged by a summary)

Read from `C:\Users\johns\IOS-APP\Elostate-Sales-coach`, not assumed:

| Claim in the plan | Checked against | Result |
|---|---|---|
| The bottom tab bar already matches the mockup | `src/app/(app)/(tabs)/_layout.tsx` lines 88–127 | `Home` · `Pitch Performance` · `Today's Metrics` · `Role Play` ✅ exactly the four drawn on p1 |
| The app calls no Pitch Score endpoint | `grep -rn "pitch-score\|pitchScore" src/` | **one** hit, and it is not one: `after-pitch-card.tsx:45` imports `@/lib/after-pitch-scores` — a substring collision with an unrelated module. `grep -rn "api/coach/sales-session/pitch-score" src/` returns zero. ✅ The conclusion holds; the first grep I cited for it did not, and is corrected here rather than left to be re-run by someone who would find the same line. |
| Gamification milestones are already built on the phone | `src/lib/gamification/arena.ts`, `src/lib/gamification/milestone-dates.ts` | both present ✅ — this is the collision in plan §3 |

A fourth, which changed a sentence in the plan: `src/app/(app)/pitch/[pitchId].tsx` exists (318
lines), and reading `pitches.tsx`'s docblock shows it mirrors the web's **Door Log report card** —
a different feature from the Pitch Score detail the mockup draws. Same name, different thing; the
plan says so rather than treating the route as already built.

---

## Not opened

- **The "EloState Rep Pitch Dashboard canvas" interactive mockups** — a link named on guide page 1
  ("Hit Play on any board to click through it"), not a file in the folder. The four ▷ PLAY buttons
  in the canvas JPEG are its entry points. **Never visited.**
- **"Pitch Score System — Engineering Implementation Guide"** — named on guide page 2 as holding
  the full scoring detail for Project 1. Not in the folder. **Never read.**
- **`SalesCoach-KPI-System.md`** — the authority behind the rep-visibility ruling in plan §4. Lives
  in the web repo, not in `source-files/`. **Not read for this plan.**
- **No screen was rendered.** Nothing in this plan comes from running the mobile app in a simulator
  or the web product in a browser. Every claim about the phone is from its source; every claim
  about the API is from having built it.
- The **16 images in `public/`** and the **11 in `docs/sales-coach/webstore-promo-kit/assets`** of
  the web repo — outside this task's folder, not opened.
