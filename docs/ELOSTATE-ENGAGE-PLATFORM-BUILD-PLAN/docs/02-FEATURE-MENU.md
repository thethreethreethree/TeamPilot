# 02 — Feature menu

| Phase | Feature | Gong | Status |
|---|---|---|---|
| E1 | Flows: email / call / task steps, delays in hours or business days | F24.1, F24.2 | DESIGNED |
| E1 | Enrol a deal's contact; one enrolment per contact per flow; opt-outs can't be re-enrolled | F24.4 (fixed rules) | DESIGNED |
| E1 | Today's steps across deals, due and overdue; done, skip, pause, remove | F26.3 | DESIGNED |
| E1 | Email step: draft with the contact's and deal's details filled in; open in your mail app, copy, mark sent | F24.1 manual email | DESIGNED |
| E1 | Call step: `tel:` link, required outcome (Gong's default list), note | F25.1 (by phone), F25.7–F25.9 | DESIGNED |
| E1 | Reply / meeting booked / opted out → the fixed rules | F24.4 | DESIGNED |
| E2 | Engage analytics: steps done, emails sent, calls, connect rate, meetings, replies; per flow and per rep | F26.7–F26.9 | DESIGNED |
| E3 | Public read API with company keys (hashed), rate limits and a usage log | F31.1–F31.6, F31.9 | DESIGNED |
| E3 | Outbound webhooks per event (existing "Send to CRM" webhook, extended to deal events) | F31.8 | DESIGNED |
| E4 | MCP server: ask_deal, ask_account, generate_brief, find_calls, as the key's person | F32.1–F32.3 | DESIGNED |
| E7 | People and team stats in the public API: `GET /api/v1/users` (the company's people) and `GET /api/v1/stats` (per rep: calls and the interaction stats, 7 / 30 / 90 days; calls with an active hide left out) | F31.2 | DESIGNED (founder picker 2026-11-27 "API + agents batch") |
| E7 | API and MCP usage report: per key, per route, requests and errors over 7 days, for company admins | F31.9 | DESIGNED (founder picker 2026-11-27) |
| E8 | Agent templates: ready-made agents (proposal prep, won-deal handoff, close date in 7 days, gone quiet) that fill the editor; nothing is saved until the manager saves | F27.9 | DESIGNED (founder picker 2026-11-27) |
| E9 | On-demand agents: a manager saves a named instruction for the company; anyone opening a deal runs it from the deal's Ask box, answered from the deal's calls with cited lines; nothing is acted on and answers aren't stored | F27.2 | DESIGNED (founder picker 2026-11-27) |
| E6 | Upload a call by API: a key with the "upload calls" scope creates a phone/video call for one of the company's reps from an audio file, processed and scored like an upload | F6.9 | DESIGNED (founder picker 2026-11-27) |
| E5 | Agents: trigger (deal stage change, close date near, tracker heard) → actions (write the brief, notify, add a to-do, send a webhook); test, enable, run history | F27.3–F27.6 | DESIGNED |
| — | Auto email, tracking, dialer, Enrich, AI flow builder, CRM sync | F26.1 F26.2 M25 F26.5 F24.8 M29 | PROPOSAL (00) |
