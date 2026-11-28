# 07 — Build order

| Phase | Builds | You can look at |
|---|---|---|
| E1 | Flows, enrolments, Today's steps, manual email, call outcomes (0377) | Engage → Today |
| E2 | Engage analytics | Engage → Analytics |
| E3 | Public read API, keys, usage | Settings → API keys |
| E4 | MCP server | Claude or ChatGPT connected to EloState |
| E5 | Agents | Agents list with run history |
| E6 | Upload a call by API ("upload calls" key scope, F6.9) | A call made by an outside tool, on the Calls list |
| E7 | People and team stats in the API; the usage report (F31.2, F31.9) | Settings → API keys: usage by route |
| E8 | Agent templates (F27.9) | Engage → Agents: "Start from a template" |
| E9 | On-demand agents (F27.2) | A deal's Ask box offers the company's agents |
| E11 | Meeting prep: a "next call is tomorrow" agent trigger (F13.6) | Engage → Agents: "A deal's next call is tomorrow"; the Meeting prep template |
| E12 | Fill the playbook from each call (F27.10): a "call added to a deal" trigger and a "read the playbook" action | Engage → Agents: the "Fill the playbook from each call" template; the deal's Playbook tab fills itself |
| E13 | Call scores in the public API (F15.19) | `GET /api/v1/scores` from an outside tool |
| E14 | A competitor battlecard from the calls (F13.11) | Market → a competitor's "Battlecard" |
| E15 | Trusted addresses per API key (F33.10) | Settings → API keys: "Only from these addresses" |
| E16 | To-dos, the company library and flows in the public API (F31.3, F24.7) | `GET /api/v1/todos`, `/api/v1/library`, `/api/v1/flows` |
| E17 | API or download? (F34.3) | Settings → API keys: when to use the API and when the win/loss CSV |
| E18 | Deep Ask over more than 10 calls (F13.12) | A deal's or account's Ask box: "Ask all N calls (deep)" |
| later | Auto email (needs E1 in 00), dialer (E4 in 00), CRM sync | — |
