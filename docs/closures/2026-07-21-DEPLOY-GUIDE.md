# Deploy guide — 2026-07-21 session

Everything from this session is built, verified (build + 869 tests + theme/RLS/invariant on the
exact commits), and pushed. This is the exact order to ship it. Two deploys — one needs no DB
change, one needs migration `0188`.

> ⚠️ **Vercel auto-deploy is likely OFF.** Per the deploy-failure history (weeks of no builds),
> a `git push` probably will NOT auto-trigger a build. After each push below, **manually deploy
> in the Vercel dashboard** (Deployments → redeploy the pushed commit) and, if you want pushes to
> auto-build again, check Vercel → Settings → Git (production branch + auto-deploy). Watch the
> Deployments list for a RED status first when "updates aren't showing" — that's the tell, not
> browser/SW cache. (The old `useSearchParams`/Suspense build break that caused this is already
> fixed on these branches; they build clean locally.)

---

## DEPLOY 1 — now, NO migration → `integration/no-migration-deploy`

Contains: post-incident hardening + the ELOSALES Standard fixes + **Coach Assessment letter
grades** (your screenshot fix) + **Dissect-in-C.A.R.E** (diagnosis + Ask-Coach follow-up) + the
shared thread formatter (tested). Fully gate-verified on commit it ships from.

```
git checkout main
git merge --ff-only integration/no-migration-deploy   # 0 behind main → clean fast-forward
git push
```
Then trigger the Vercel deploy. **No migration needed.** After it's live:
- Coach Assessment in **Standard** mode shows A+/A- letter grades (Expert still shows ELO — by design).
- A **Dissect** button appears beside Summarize in the C.A.R.E inbox.

## DEPLOY 2 — when ready to apply the migration → `feat/care-handover-capture`

Contains: the C.A.R.E AI→agent **handover capture** (customer told + name/email/concern/order#
captured + agent-visible), the **voice-handoff fix**, the **"waiting for an agent" indicator**,
the audit remediations (F1/F2/F3), and the **tenant-PATCH migration-coupling fix**. Gated on
migration `0188`.

```
# 1. Apply the migration FIRST (schema before code — the code degrades gracefully either way,
#    but this avoids the pre-0188 window entirely):
npm run db:apply          # applies 0188 (adds business_type + handoff_topic/detail/order_number)
npm run db:check          # confirm ledger head = 0188

# 2. Merge + deploy (has a TRIVIAL 1-marker additive conflict with the Dissect changes on
#    ConversationsApp.tsx if Deploy 1 already merged — resolve by KEEPING BOTH additions):
git checkout main
git merge feat/care-handover-capture
git push
```
Then deploy. After it's live: trigger a handoff in the widget and confirm the notice + capture
card + the agent header chips (verification runbook: `docs/closures/2026-07-21-care-handover-capture.md`).

---

## DEMO SHEET → PDF (`docs/care-demo-sheet` branch)

The PDF is already generated: **`docs/CARE-demo-sheet.pdf`** (5 pages, rendered + visually
verified). To view: open it. To share: it's ready — EXCEPT two placeholders on page 5's CTA:

- **`[your email]`** and **`[your booking link]`** → replace in `docs/CARE-demo-sheet.html`,
  then regenerate the PDF:
```
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu \
  --no-pdf-header-footer \
  --print-to-pdf="C:\Users\johns\OneDrive\Documents\GitHub\TeamPilot\docs\CARE-demo-sheet.pdf" \
  "file:///C:/Users/johns/OneDrive/Documents/GitHub/TeamPilot/docs/CARE-demo-sheet.html"
```
(Or just tell the agent the email/link and it will finalize + regenerate + re-verify.)

Want real screenshots instead of the UI mockups? Drop PNGs in `docs/` and the agent swaps them in.

---

## Branch reference

| Branch | Ships | Migration | Verified |
|---|---|---|---|
| `integration/no-migration-deploy` | hardening + ELOSALES + letter grades + Dissect | none | build · 869 tests · RLS · invariant |
| `feat/care-handover-capture` | handover capture + voice/audit/tenant fixes | **0188** | build · 875 tests · RLS · invariant |
| `docs/care-demo-sheet` | the demo sheet + generated PDF | none | rendered + fact-checked |
| `feat/care-dissect` | (source of Dissect; already folded into deploy 1) | none | — |
| `feat/coach-assessment-standard-letter-grades` | (source of letter grades; folded into deploy 1) | none | — |
