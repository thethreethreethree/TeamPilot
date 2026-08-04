# Proposal — Rewrite `/help`'s mechanism copy to experience-language (close the live IP leak)

> Status: **DRAFT — not applied.** Founder trigger: `"rewrite /help"`.
> Why: `/help` is publicly reachable (not in the middleware matcher) and linked from the now-LIVE landing
> footer (`src/components/landing/Footer.tsx:32`), so cold marketing/competitor traffic reaches it. Its copy
> quotes the exact method-mechanism phrases the IP rule keeps off external surfaces. This rewrite removes the
> mechanism framing while keeping every user-facing meaning intact — the same treatment applied to the sales
> demo. It preserves the public help link (so a prospect can still find help); it just stops the copy from
> explaining *how the method works internally*.
>
> Scope: 4 passages in `src/app/help/page.tsx` (the "60-day cycle" section + the privacy line), plus the two
> `LearningHint` metadata strings that echo the same phrasing. Nothing else on the page changes.

## The rule this applies

Describe the **experience** (what the user sees/does and why it helps them), not the **mechanism** (the
internal experimental design — control window, single-variable attribution, permanent skip record). The
meaning a user needs is unchanged; only the "here is our method" framing is removed.

---

## Passage 1 — LearningHint `how` (line 64)

**Before:**
> Treat Month 1 as data collection, not downtime. Only override control if you have a real reason — the skip is
> recorded permanently.

**After:**
> Treat your first month as the baseline, not downtime. You can turn guidance on early if you have a real
> reason — that choice is saved, so your later results stay honest about it.

*Removes:* "override control," "the skip is recorded permanently" (mechanism) → plain cause/effect.

---

## Passage 2 — body, Day-30 paragraph (lines 78–83)

**Before:**
> On Day 30, the Coach unlocks for the next 30 days. That window is a single-variable intervention — the only
> thing that changed is the guidance, so any improvement is attributable to it.

**After:**
> On Day 30, the Coach turns on for the next 30 days. Because the guidance is the only thing that changed, any
> improvement you see is down to it — not luck or circumstance.

*Removes:* "single-variable intervention" → the same attribution point in plain language.

---

## Passage 3 — body, override paragraph (lines 89–95)

**Before:**
> You CAN override Month 1 control if you have a real reason — there's a button in Settings — but the override
> is recorded permanently and the readout will flag your company as "skipped control." The discipline IS the
> moat (see Terms).

**After:**
> You can turn guidance on early if you have a real reason — there's a button in Settings — but that choice is
> saved, and your Day-60 readout will note the baseline was cut short. Keeping the baseline intact is what
> makes your proof trustworthy.

*Removes:* "override Month 1 control," "skipped control," "the discipline IS the moat" → experience framing.

---

## Passage 4 — Privacy section (lines 157–160)

**Before:**
> ELOSTATE is built so the data the System sees about you, you can see. There is no shadow read.

**After:**
> ELOSTATE is built so the data the System sees about you, you can see too. Anything it forms an opinion about
> — a grade, an engagement signal — is visible to you, not hidden.

*Removes:* "no shadow read" (mechanism term) → the same transparency guarantee in plain words.

---

## Also update — LearningHint metadata that echoes the same phrasing

- Line 152 `why`: "…makes the **no-shadow-read rule** legible…" → "…makes the transparency guarantee legible…"
- (Line 62–65 `whatItIs`/`why`/`principle` for the cycle are experience-framed already — leave as is; only the
  `how` at line 64 needs Passage-1's change.)

## Rollout

1. Apply the 4 body edits + the 1 metadata edit above (single file, `src/app/help/page.tsx`). No other file.
2. Verify by grep: `grep -rniE "single-variable intervention|no shadow read|Month 1 control|skip is recorded permanently|override control|skipped control" src/app/help/` → expect **zero** matches (the leak is closed).
3. No migration, no schema, no behaviour change — copy only. Blast radius: the `/help` page text.

**Gap worth closing after (needs your forbidden-phrase list):** the existing `no-methodology-citations-in-ui`
guard scans for `§` tokens + the `thinkerthinker`/`claude.md` filenames — it does **NOT** catch these
mechanism *phrases*, so nothing stops the leak from reappearing in a future edit. A small follow-up guard test
(same shape as that one) that fails when a confirmed forbidden phrase appears in a public-surface string would
make this permanent. I didn't add it unprompted because the authoritative phrase list is an IP judgment that's
yours — give me the list and I'll wire the guard.

> Interim option if you'd rather not touch copy right now: pull the single `/help` link from
> `src/components/landing/Footer.tsx:32` (stops driving cold traffic; `/help` stays reachable by direct URL for
> logged-in users). Weaker (a competitor with the URL still reaches it) and it removes a prospect's help path,
> so the copy rewrite above is the better fix. Your call on which.
