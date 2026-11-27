# BUILD - E9: on-demand agents

### On-demand agents
write-path: on_demand_agents insert / retire through the caller's client (RLS: sales-coach managers), POST /api/coach/remote/on-demand-agents.
read-path: GET lists the company's live ones (RLS: company members); Engage → Agents shows and retires them; the deal's "Ask about this deal" box shows them as buttons.

### Running one on a deal
write-path: none — askCoach with save: false stores no chat or turns.
read-path: POST {run, sessionIds} reads the saved instruction by id and asks it of the deal's 1–10 newest calls as the asker; the answer and its cited lines show in the Ask box, marked "not saved".
