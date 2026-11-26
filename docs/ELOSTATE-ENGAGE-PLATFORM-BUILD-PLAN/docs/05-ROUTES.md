# 05 — Routes

| Route | Phase |
|---|---|
| `/api/coach/remote/engage/flows` (GET, POST, retire) | E1 |
| `/api/coach/remote/engage/enrolments` (GET today's steps · POST enrol · POST action) | E1 |
| `/api/coach/remote/engage/stats` | E2 |
| `/api/v1/*` (deals, accounts, calls, contacts; key auth) | E3 |
| `/api/coach/remote/settings/api-keys` | E3 |
| `/api/mcp` (MCP over HTTP, key auth) | E4 |
| `/api/coach/remote/agents` and the agent runner | E5 |

Pages: `/dashboard/remote-sales/engage` (Today, Flows, Analytics), plus an "Add to a flow" action on the deal panel.
