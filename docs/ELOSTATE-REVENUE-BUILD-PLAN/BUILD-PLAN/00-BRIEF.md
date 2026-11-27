# EloState revenue stack — brief

> This is the brief, not the method. The method is BUILD-STARTER plus this repo's TBC protocol. The agent must not invent an answer to anything left blank. Nothing is deleted: unanswered items read `NOT DECIDED`, so the gap stays visible.

1. **What is being built:** the revenue stack that makes EloState compete with Gong: accounts, deals, warnings, playbooks, AI deal review, win/loss, ask-anything and forecast, on top of the calls and coaching already built.
2. **Entities and lifecycle:** see `docs/01-SCOPE.md`. Account, contact, deal (= prospect), stage, warning, playbook note, forecast submission.
3. **Who uses it:** reps (their own deals), managers (their tree), admins (stages, thresholds, playbooks).
4. **Brand:** the app's own tokens (`docs/BRAND.md`). Gong supplies function and layout only.
5. **Reference material:** `reference/README.md`.
6. **Real content:** none to supply. Every number comes from the company's own calls and deals.
7. **Data that already exists:** live `remote_prospects` with its events, calls and tasks, which are backfilled into accounts (Phase 1).
8. **Deployment:** Vercel, `db:apply`, cron (`docs/08`).
9. **Hard constraints:**
   - append-only (§3.1);
   - erasure through its single door (§3.1.1);
   - tree RLS;
   - nothing shown below its data minimum (§3.2);
   - no CRM or email assumed (R2, R7).
10. **What "done" means:** a manager runs a pipeline review in EloState alone. Deals with accounts, contacts, warnings and validated playbook notes; the account timelines; the forecast with its accuracy.

## Decisions log
| Date | Decision | Chosen | Why |
|---|---|---|---|
| 2026-11-27 | What to build to compete with Gong | The revenue stack the remote sales plan set aside | Founder: "I WANT YOU TO BUILD A SYSTEM COMPETITIVE TO GONG" |
| 2026-11-27 | Order | Deals + accounts first, then ask-anything, forecast, Engage, CRM / API / MCP, agents | Founder picker |
| 2026-11-27 | Forecast notes | Not taken (0381) | Free text erasure can't reach (review) |
| 2026-11-27 | A saved view's search text | Not kept (0388); the view keeps its filters | A search is usually a name, and a saved one would outlive erasure (erasure audit of 0370–0387) |
| 2026-11-27 | Targets (F23.4) | Team quarterly revenue targets on the forecast board; no targets on other metrics (no metric builder stays) | Founder picker (recommended) |
| 2026-11-27 | Topic sections (F11.11) | On request per call | Founder picker (recommended) |
| 2026-11-27 | Share a personal folder (F12.8) | Managers only (today's rule) | Founder picker (recommended) |
| 2026-11-27 | Next batch after the Gong P3 audit | Deal-flow batch: field history (F23.11), forecast due day and reminder (F22.4) here; meeting-prep trigger (F13.6) in the Engage plan E11 | Founder picker: "Deal-flow batch (Recommended)" |

## Open questions
| # | Question | Blocks |
|---|---|---|
| R1–R12 | see `docs/00-OPEN-DECISIONS.md` | none block Phase 1 |
