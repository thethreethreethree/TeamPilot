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
| E6 | Upload a call by API: a key with the "upload calls" scope creates a phone/video call for one of the company's reps from an audio file, processed and scored like an upload | F6.9 | DESIGNED (founder picker 2026-11-27) |
| E5 | Agents: trigger (deal stage change, close date near, tracker heard) → actions (write the brief, notify, add a to-do, send a webhook); test, enable, run history | F27.3–F27.6 | DESIGNED |
| — | Auto email, tracking, dialer, Enrich, AI flow builder, CRM sync | F26.1 F26.2 M25 F26.5 F24.8 M29 | PROPOSAL (00) |
