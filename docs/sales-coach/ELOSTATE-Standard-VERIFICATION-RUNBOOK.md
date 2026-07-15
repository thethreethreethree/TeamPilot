# ELOSTATE Sales Coach — Standard-Mode Verification Runbook

**Purpose.** Everything in the 2026-07-15 Standard-mode simplification is **BUILT and gate-verified**
(tsc · lint · theme · 695 tests) but **not yet TESTED** in a live session. This runbook is the exact
sequence that converts it to TESTED. Per the project's discipline, *your* confirmation is completion —
the automated gates are not.

**Two accounts make this fastest:**
- one profile with `experience_mode = 'standard'` (the default for new users), and
- one with `experience_mode = 'expert'` (toggle via the experience dial, or set `profiles.experience_mode`).

Every **Standard** step below has a matching **Expert-unchanged** check — because the one hard requirement
was "keep Expert exactly how it is."

---

## A · Standard — the happy path (do this as the `standard` user, on a phone-width viewport)

| # | Do | Expect (PASS) | Watch for (FAIL) |
|---|----|---------------|------------------|
| A1 | Open Sales Coach **Home** | Start card shows **In-person** pre-selected; the title field reads "Name it later (optional)"; **Start session** is tappable with the field empty | Online video pre-selected; Start disabled when empty |
| A2 | Tap **Start session** with no title | Session starts; lands on the live screen | "Give the session a title" error |
| A3 | On the live screen, look at the controls | **One** cue-mode button (Suggestion); **no** "Prep me", **no** "Generate growth review", **no** "Upload the call recording"; "Ask the coach" prompt reads **"What are you struggling on?"** | Two mode buttons; any of the removed items present; old prompt text |
| A4 | If this is a brand-new rep (first session <3 days), start live coaching | A notice: *"The coach is learning your style — listening this call, not coaching yet… cues switch on after your first few days (date)."* No proactive cues fire | Silence with no notice (reads as broken); or cues fire anyway |
| A5 | Speak a short mock call, then **End** the recording | You are taken **straight to the After-Pitch Summary** — not the dense session page | You stay on a page full of transcript/tools/buttons |
| A6 | Read the After-Pitch | Shows **scores + "what you did well" + "opportunities to grow" + cue loop**, and a **"How did it go?" outcome row** + **one "Start Next Door"**. **No** moments timeline, **no** "What happened", **no** breakdown 3-up. The read is **short** | Timeline/breakdown present; long multi-paragraph read; no outcome row |
| A7 | Tap **rename**, type "angry customer", Save | Title updates to "angry customer" | Rename missing or errors |
| A8 | Tap an outcome (e.g. **Follow-up**) | It highlights as recorded | No response |
| A9 | Tap **Start Next Door** | A new session opens, carrying context | Dead-ends |
| A10 | Go to **Sessions** tab | **No** "Start a coaching session" card — only growth opportunities, where-sessions-stand, search, history | Start card present |
| A11 | Go to **Analytics** | **Six skill tiles /10** (Talk/Listen, Tone, Speed of speech, Questions, Objection, Closing) each with a short line; **no 1515 ELO number**, **no Team aggregate**. Un-scored skills show **"—"**, never 0 | ELO number present; team aggregate present; a skill showing "0/10" for no-data |
| A12 | Reopen the session from A5 (Sessions → tap it) | The **conversation summary + timeline are still there** to relive | They were deleted |

---

## B · Expert — must be UNCHANGED (do this as the `expert` user)

| # | Do | Expect (PASS = same as before this build) |
|---|----|-------------------------------------------|
| B1 | Home start card | Online-video default; title **required** (Start disabled when empty) — exactly as before |
| B2 | Live screen | **Both** mode buttons (Suggestion / Guide my response); Prep me, Generate growth review, Upload all present; original "Ask the coach" copy |
| B3 | End a recording | Stays on the **full session page** (summary, prep, generate review, outcome, why, transcript, coach tools) — no auto-jump to After-Pitch |
| B4 | Open After-Pitch (via its link) | **Full** version: moments timeline, "What happened", breakdown 3-up, scores, narrative, cue loop — all present |
| B5 | Sessions tab | Start-a-session card **present** at the top |
| B6 | Analytics | **1515 ELO number present**; team aggregate present (if manager) |
| B7 | Cues in a brand-new Expert rep's first days | Cues fire **immediately** — no 3-day observe window |

If any B-row differs from "before this build", that's a **regression** — capture which row and I'll fix it.

---

## C · Known / flagged (not failures — decisions or a low-severity item)

- **F1 (LOW, cosmetic):** an Expert user may see a ~150 ms flicker of the *simplified* layout on page load
  before their mode resolves (the mode is fetched client-side; the pre-fetch default is Standard). It
  self-corrects. A flash-free fix is SSR-aware and scoped as its own task. **Not a functional failure** —
  note it only if it's more than a brief flicker.
- **Scoring bands** (Talk/Listen, Speed) live as named constants in `src/lib/coach/v5/skillAnalytics.ts`.
  If a score feels wrong (e.g. a 60/40 call scoring too low), that's a tuning call, not a bug — tell me the
  band you want.
- **3-day window + on-demand:** during the observe window a rep tapping "coach me now" **is** answered
  (they asked). If you want the window fully silent, it's a one-line change. Decide after A4.

---

## D · What "TESTED" means here

When A1–A12 pass for the Standard user **and** B1–B7 confirm Expert is unchanged, the build is **TESTED**
and the manifest can move off BUILT. Until then it stays BUILT — honestly labelled, because a screen that
compiles is not a screen that was watched to work.
