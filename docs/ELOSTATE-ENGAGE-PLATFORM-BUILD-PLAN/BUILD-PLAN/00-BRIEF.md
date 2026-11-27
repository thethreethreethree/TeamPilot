# EloState Engage, API, MCP and agents — brief

> This is the brief, not the method (BUILD-STARTER + TBC). Nothing is invented. Anything unanswered reads NOT DECIDED.

1. **What:** the remaining revenue-stack products: outbound flows with call outcomes, a public API, an MCP server and agents.
2. **Entities:** flow, enrolment, step activity, API key, MCP key, agent, run (`docs/01`).
3. **Who:** reps work their steps; managers build company flows and read analytics; admins hold keys.
4. **Brand:** the app's tokens.
5. **Reference:** the teardown's M24–M27, M31, M32; the evidence report (#1014 #1004 #988 #1012).
6. **Real content:** none to supply. Email drafts are the rep's own text.
7. **Existing data:** deals, contacts and accounts (revenue Phases 1–6).
8. **Deployment:** Vercel, with the preconditions in `docs/08`.
9. **Hard constraints:**
   - no email sent from the app without a configured sender;
   - no opt-out wording drafted here;
   - keys stored only as hashes;
   - every read through the caller's own access.
10. **Done:** a rep runs their day from Engage, and an outside AI asks about a deal through MCP with that rep's access.

## Decisions log
| Date | Decision | Chosen | Why |
|---|---|---|---|
| 2026-11-27 | Order | Engage, then CRM / API / MCP, then agents | Founder picker |
| 2026-11-27 | Email and dialer | Manual email and phone `tel:` until the services are set up | §1.5.3: no silent dependence on unset config |
| 2026-11-27 | Create calls by API (F6.9) | An "upload calls" key scope (phase E6) | Founder picker: "Add an 'upload calls' key scope" |
| 2026-11-27 | Which voice is the rep on an API call (E10) | The rep picks it in the app | Founder picker (recommended) |
| 2026-11-27 | How an API call's file arrives (E6) | A signed upload straight to storage, then finalize; multipart only under ~4 MB | Review: Vercel refuses request bodies over ~4.5 MB, so a one-request upload failed for any call past ~5 minutes (the app's own upload works the same way for the same reason) |
| 2026-11-27 | Next batch | E7 people + stats API and usage report, E8 agent templates, E9 on-demand agents | Founder picker: "Yes: API + agents batch" |
| 2026-11-27 | Upload cost cap (E6) | At most 200 API uploads a day per key, counted before transcription | Review: the shared request limits didn't bound speech-to-text spend |
| 2026-11-27 | Auto-score selection (F15.9) | Keep scoring every phone/video sales call with its channel's rubric | Founder picker (recommended) |

## Open questions
| # | Question | Blocks |
|---|---|---|
| E1–E9 | see `docs/00` | none block E1 |
