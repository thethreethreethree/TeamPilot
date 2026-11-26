# 05 — Routes

| Route | Phase | Does |
|---|---|---|
| `GET/POST /api/coach/remote/accounts` | 1 | list the accounts the caller can see, with roll-ups · find-or-create by name |
| `GET/POST /api/coach/remote/accounts/:aid` | 1 | the account timeline (deals, calls, contacts, tasks) · rename |
| `GET/POST /api/coach/remote/contacts` | 1 | search contacts · create (name, title, account) |
| `POST /api/coach/remote/contacts/:cid` | 1 | change title or account |
| `POST /api/coach/remote/prospects/:pid` | 1 | + `action: "account"` (set the account), `"contact"` (add with a role, or remove) |
| `POST /api/coach/remote/[id]/contacts` | 1 | link a call's customer to a contact |
| `GET /api/coach/remote/prospects` | 2 | + stage, account, contacts count, warnings; filters `stage`, `close`, `account`, `warning` |
| `/api/coach/remote/deal-stages` | 2 | admin stage list |
| `/api/coach/remote/deal-views` | 2 | saved board views |
| `/api/cron/deal-warnings` | 3 | nightly raise and clear (CRON_SECRET) |
| `/api/coach/remote/prospects/:pid/playbook` | 3 | notes: ai_suggest (runs the reviewer), write, validate, clear |
| `/api/coach/remote/prospects/:pid/brief` | 3 | deal brief and suggested next steps |
| `/api/coach/remote/win-loss` | 4 | analytics, gated by R6 |
| `/api/coach/remote/deal-drivers` | 4 | per-rep warning shares |
| `/api/cron/account-activity` | 4 | nightly levels |
| `/api/coach/remote/ask-pipeline` | 5 | + `scope: { deal | account }` |
| `/api/coach/remote/forecast/*` | 6 | boards, submissions, snapshots, accuracy |

Pages: `/dashboard/remote-sales/pipeline` becomes **Deals** (same route, so links keep working). New pages: `/dashboard/remote-sales/accounts`, `/dashboard/remote-sales/accounts/[aid]`, `/dashboard/remote-sales/forecast`.
