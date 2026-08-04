# Closure — 2026-08-05 · Sales Coach: no minimum length, every session gets all content

Session-read manifest (A22) for the Sales Coach "no minimum time" build. Full THINK→BUILD→CHECK→CLOSE
artifacts live at `docs/tbc/2026-08-05-salescoach-no-minimum-length/`; this is the A22 index.

## 1. The build
Founder directive (reproduced 4× by the sales agent): a real 5–7 minute pitch rendered as "This call was
too short to read yet" with only 2 of the scores. Directive — *"don't put a minimum time, each session
should have &lt;My read&gt; &lt;Summarize&gt; &lt;Dissect&gt;, and all Sales Coach related
tools/feedback."*

Two layers judged calls "too thin"; both were changed:
1. **LLM prompt refusals** — every v5 content engine's prompt said "return `hasSignal:false` if too thin".
   Flipped to always-generate-but-grounded (salesReview / salesScore / salesDissect / salesMoments /
   salesPivot / salesWhy prompts).
2. **Engine length floors** — `MIN_AGENT_SEGMENTS`/`MIN_SEGMENTS` = 3/4 lowered to 1 (genuine-empty floor
   only) in salesReview, salesScore, salesMoments, salesDissect, salesPivot, salesWhy, salesIntel.

One test updated to the new contract (`salesReview.generate.test.ts`). No page edit needed — the
after-pitch page's gates are satisfied once the engines return content.

## 2. Constitutional assets cited + in-session re-read timestamps
All re-read this session (2026-08-04T22:09:11Z). CLAUDE.md is in the working tree and loaded in context;
ThinkerThinker.md (hash 0428…) is in the tree and its cited axioms were opened this session.

- **§0 / §0.1 / §1.2** (CLAUDE.md) — understand-before-solving; methodology-in-tree precondition;
  retrospective identification from the record.
- **§1.5 / §1.5.1 / §1.5.2** (CLAUDE.md) — holistic ripple; four-layer feature gate (L2 effectivity);
  THINK-then-search class sweep.
- **§3.3 / §3.4** (CLAUDE.md) — guide-don't-overtake (founder owns the decision); honesty-is-the-moat
  (no fabrication).
- **§5 / §6** (CLAUDE.md) — builder-under-pressure; decision checklist.
- **A11 / A19 / A22 / A30 / A38** (ThinkerThinker.md) — mirror-not-judge; methodology-in-tree; citation
  requires session-reading; encode-the-lesson-in-a-gate; "verified" = a command run.

## 3. Intent-vs-behavior
- **§3.3** — the founder's product decision was performed as asked; not relitigated on honesty grounds.
- **§3.4** — "always generate" did NOT become "fabricate": every prompt keeps its ground-in-a-real-line
  and no-invented-stat rules. A short call yields a short REAL read, so honesty is embodied, not violated.
- **§1.5 / §1.5.2** — the class was swept across all v5 engines; live in-call (liveCue/liveConfidence)
  and cross-session aggregate (salesWhyPatterns) engines were deliberately left alone and recorded, so no
  sibling broke silently.
- **A11** — the score prompt keeps rationale+citation per category; only the refuse-if-thin gate was
  dropped, so the scores stay contestable evidence, not verdicts.
- **A38** — closure claims rest on pasted exit codes: tsc 0, vitest 397/397 exit 0, `build:ci` exit 0.

## 4. Findings + remediation order
No new defects. Residuals (from the build's closure.md, A36 order):
1. **RES-01** — no live end-to-end screenshot (owner-private RLS surface); verify with the sales agent on
   their next short pitch.
2. **RES-02** — salesIntel prompt not audited for a separate too-thin refusal (only its engine floor was
   lowered); re-check if intel is still sparse on short calls.

## 5. Outside-perspective audit (four personas)
- **New user (sales rep):** a quick 5-minute close now returns Your read, all scores, Dissect, and the
  rest — the surface matches what they were told they'd get. No dead end.
- **New engineer:** the two "too thin" layers are named in-code (founder-decision comment at each MIN=1)
  and locked by a test; the deliberate out-of-scope boundary is on the record in check.md.
- **Adversary:** "always generate" can't be abused to fabricate — the grounding rules are intact; a
  0-turn capture gap still returns the honest empty state, so no read is manufactured from silence.
- **CFO:** every real session now spends LLM calls where a genuinely-short call previously short-circuited
  to zero. The cost ripple is bounded — VERIFIED, not assumed: (1) every generation route carries a
  per-caller `rateLimit` (after-pitch POST max 20/60s; dissect / summarize / why each their own); (2)
  after-pitch generation is cached once-per-session — the page GETs the stored summary and only POSTs when
  none exists, guarded to once per id; (3) session creation is auth-gated (a real rep + transcript), not an
  open endpoint. So the delta is O(genuinely-short real sessions) × one generation each, under the rate
  ceiling — no new unbounded path. (Correction: an earlier draft named "the existing per-caller throttle"
  before confirming it existed; the `rateLimit` on each route is that throttle, now verified.)
