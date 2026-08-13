# Session findings & open decisions — 2026-08-13

Consolidated so nothing is lost between sessions. Shipped work is context; the live items are the
**pending founder decisions** and the **open suspects** (suspects are NOT auto-fixed — several may be
intentional; per the "an audit finding is a suspect, not a fix" discipline they wait for a decision).

---

## Shipped & live on prod this session
- **Extension repeated sign-out** — single-flight refresh + A2 fast/slow token re-read, in BOTH extension
  SOURCE folders (`extension/`, `extension-sales/`). Token-lifecycle fully audited: no retry loops,
  hard-fail clears tokens → Sign in. `45722114`, `e828f0e9`.
- **Forced auto-update** — VersionWatcher idle/foreground paths + audit fixes A1/A3/A4/A5. `e828f0e9`.
- **Read-heal F1 (HIGH)** — after-pitch auto-heal now keys on `narrative.hasSignal`, not the composite
  that deterministic scores kept true; a blank "Your read" now re-generates instead of sticking blank.
  `3b44945b`. **Follow-up (`c7921692`):** an adversarial review of my OWN fix caught a HIGH regression —
  F1 keyed on `!narrative.hasSignal`, but `moments`/`cueLoop` drive the composite independently of agent
  turns, so a one-sided recording (0 agent turns, rep mic not captured — realistic on mobile) looped a full
  4-engine generation on every mount, never converging. Fixed by gating the heal on `scores.length > 0` (an
  exact proxy for "agent turns present" → the recoverable case only). Residual (accepted, rare): a call WITH
  agent turns whose review yields growth-but-no-strengths (tone-law → blank), or persistent F3-corpus
  starvation, still re-heals per visit — bounded per-visit, tied to the founder-gated corpus-trim. A durable
  once-per-session heal marker would close it; deferred as over-reach for a rare case.
- **Read-heal F2 (MED)** — DeepSeek stream path now logs `finish_reason:"length"` (was silent). `3b44945b`.
- **Connect refusal-surface** — connect page shows "Extension not recognized" (with the id) on a refused
  handoff instead of a silent drop to copy-token. `9bbf55e4`.
- **Connect-panel security refactor** — panel selection extracted to a pure, tested function; token panel
  proven unreachable on refused/connected states. `48080e00`.

## ROOT-CAUSE resolved (no code fix — operational)
- **"Updates not reflecting / had to reinstall every change"** = loading the extension from a STALE
  DUPLICATE (`extension/store/dist/` or the `.zip`), not the SOURCE root. Proved `dist/background.js` was
  missing the A2 fix that's in `extension/background.js`. **Fix:** Load unpacked from `...\TeamPilot\extension`
  (C.A.R.E) and `...\TeamPilot\extension-sales` (Sales) — NOT `store\dist`, NOT the `.zip` — then use the
  card's ↻ reload after each change. Deploy regenerates the downloads from source via the `prebuild` hook,
  so served downloads are never stale; only the local `dist` goes stale.

---

## PENDING FOUNDER DECISIONS
1. **Reload result** — after loading both from the source folders + ↻ reload: does C.A.R.E connect, and do
   the sign-outs stop? (If C.A.R.E still won't connect, the connect page's F12 console `[care-connect]`
   line is the exact reason.)
2. **C.A.R.E ↻ restart button parity** — Sales has the in-panel ↻ restart; C.A.R.E does not
   (`extension/content.js` has 0 restart refs). Recommendation: add it (mirror the Sales impl) since C.A.R.E
   hits the same re-login pain. [option 1 = add, recommended · option 2 = leave as-is]
3. **Blank-read self-heal check** — revisit a session whose "Your read" was blank; with F1 it should now
   re-generate on load. Confirm it fills in (if still blank → the F3 corpus-size ceiling, not budget).
4. **STT scope env** — ElevenLabs scoped-key needs TTS+STT enabled (don't replace the key).
5. **Corpus-trim** — the 8000-token clamp caps reasoning room; a corpus ~3× the calibration re-starves.
   Real fix is trimming the knowledge-base corpus (raising the 7000 constant buys nothing — it clamps).
6. **Read-copy wording** — the "a very short exchange may not have enough" line reads as "too short" even
   when the cause was starvation; reword? (transient now that F1 self-heals, low priority).
7. **Next.js 16.2.6 → 16.3.0** — upgrade decision (verify Vercel deploy on a framework bump before trusting).

## OPEN SUSPECTS (evidence-based, NOT auto-fixed — may be intentional)
- **Sales download zip is git-TRACKED while the C.A.R.E zip is git-IGNORED.** `public/sales-coach-extension.zip`
  is tracked and shows perpetually "modified" after any dev/prebuild run (jszip is not byte-deterministic
  in practice); `public/care-extension.zip` is correctly ignored. Consequence: git churn + risk of
  committing/serving a stale artifact from the repo copy (the deploy still regenerates it, so no user-facing
  break). *Suspect:* git-ignore + untrack the sales zip to match the C.A.R.E convention — unless it's
  tracked deliberately. Founder call.
- **SessionCoachTools summary uses manual "Try again", after-pitch read now auto-heals.** Both are honest
  (no masking), but inconsistent UX: a blank session-summary needs a manual tap while a blank after-pitch
  read self-heals. Not a bug; a consistency choice. Founder call whether to align them (auto-heal the
  session summary too).
