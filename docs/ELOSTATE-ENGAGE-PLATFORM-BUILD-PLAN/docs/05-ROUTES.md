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
| `POST /api/v1/calls` (key scope "upload") | E6 — JSON {repId, channel, startedAt?, title?, filename, sizeBytes, mimeType} makes the call and returns a signed storage upload (the file named after the call, so it can belong to no other); multipart {file, …} still works for files under ~4 MB (Vercel's request limit); an optional `Idempotency-Key` header makes a retry return the first call |
| `GET /api/v1/users`, `GET /api/v1/stats?days=7|30|90` (key scope "read") | E7 |
| `GET /api/v1/scores?page&limit` (key scope "read") | E13 |
| `POST /api/coach/remote/market/battlecard` {competitor, module, days} → {answer, citations, calls} (the asker's calls; not saved) | E14 |
| `GET /api/coach/remote/settings/api-keys/usage` (company admins) | E7 — requests and errors per key and route, 7 days |
| `/api/coach/remote/on-demand-agents` GET · POST {name, instruction} · POST {retire} (managers create) · POST {run, sessionIds} (anyone in the company: the saved instruction asked of 1–10 of the deal's calls through Ask Coach as the asker, answer not saved) | E9 |
| `POST /api/v1/calls/:id/finalize` (key scope "upload") | E6 — after the signed upload: checks the stored file (size, type), points the call at it, ends and transcribes it; the rep picks their voice in the app (E10), which scores it |

