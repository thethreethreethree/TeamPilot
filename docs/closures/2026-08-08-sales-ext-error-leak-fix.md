# Closure — 2026-08-08 · Sales Coach extension: error-detail leak (CWE-209) + false-empty summary

Session-read manifest (A22) for the audit-driven fix. Full THINK→BUILD→CHECK→CLOSE artifacts live at
`docs/tbc/2026-08-08-xf-sales-ext-error-leak-fix/`; this is the A22 citation index the commit references.

## 1. The change
A ground-up, outside-view audit of the freshly-shipped coach/extension surface (6 auth-bearing routes + 5 LLM
engines + shared helpers) found two real flags:

- **F1 (CWE-209, med):** `src/lib/coach/extension/llmErrorResponse.ts` returned `err.message` — built by the
  provider layer from raw upstream text (`DeepSeek API error <status>: <body>`, or `"DEEPSEEK_API_KEY not
  set."`) — to the browser, leaking the AI vendor + upstream body; and it did NOT log the LlmError branch
  server-side. Fixed: log the real cause (kind/provider/status/message/rawBody) server-side, return the
  route's generic `fallbackMessage` + the safe `kind` enum. The old helper test had LOCKED the leak; corrected
  + a dedicated no-leak test added.
- **F2 (honesty, low):** `summarize/route.ts` returned `{ summary: "" }` as a 200 on an empty model result —
  a false-empty the route's own docstring forbids. Fixed: `if (!summary) → 502`, mirroring copilot/formulate.

The 4 C.A.R.E extension routes carry the identical inline leak; left as a founder-gated flag (not rewritten
under the continuation guard) — see the tbc closure.

## 2. Constitutional assets cited + in-session re-read timestamps
CLAUDE.md is in the working tree and loaded in context; ThinkerThinker.md (hash 0428…) is in the tree and its
cited axioms were opened this session. Governing-doc hashes recomputed this session and MATCH DOC_MANIFEST.json.

- **§0 / §0.1** — understand-before-solving (traced `err.message` to `deepseek.ts` before touching the
  mapping); methodology-in-tree precondition (hashes recomputed). Re-read 2026-08-08T06:50Z, re-engaged 07:25Z.
- **§1.5 / §1.5.2** — holistic ripple (the same leak in 4 C.A.R.E routes — traced, scope decided); proactive
  audit is what found these, and its "no license to refactor without need" bounded the C.A.R.E scope. Re-read
  2026-08-08T06:50Z.
- **§3.3 / §3.4** — guide-don't-overtake (C.A.R.E change held for the founder); honesty-is-the-moat (F2:
  failure not dressed as empty). §3.3 re-read 06:50Z; §3.4 re-read 07:13Z.
- **§5 / §6** — builder-under-pressure (scoped the fix honestly under the continuation guard; did not overreach
  into the shipping product); decision checklist. Re-read 06:50Z, re-engaged 07:25Z.
- **A21 / A22 / A38** (ThinkerThinker.md) — one mechanism not a fork (the shared error chokepoint); citation
  requires session-reading (this index); "checked" = the canonical command with its exit code. Re-read
  2026-08-08T06:50Z.

## 3. Intent-vs-behavior
- **§3.4** — the fix makes the surface MORE honest (an LLM failure now surfaces as a failure, not empty), and
  the leak fix does not hide anything from the operator (the cause moves to the server log, where it belongs).
- **§5** — under the active continuation guard, the honest scope was: fix my surface, flag the sibling. The
  temptation to also rewrite the shipping C.A.R.E product was declined as overreach, not adopted for momentum.
- **A38** — `npm run check` → exit 0 (2497 passed | 15 skipped); the two findings additionally have targeted
  tests that fail on regression.
