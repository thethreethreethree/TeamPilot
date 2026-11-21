# Gong vs ELOSTATE: what it takes to match

Nov 13, 2026 · @John Ramos

To match Gong where it matters for a field sales team, ELOSTATE needs four structural fixes, then about 40 first-release features finished, then the coaching loop completed. Matching all 346 features is a separate decision, because 123 of the 174 missing features are Gong's B2B revenue and enterprise stack.

## How to read this

- **Source.** Every status comes from the [Gong vs ELOSTATE comparison](https://claude.ai/artifact/6SunwZuGFDXJNwXFyWYNxq) (code at commit 0214913), which checked each feature against Gong's pages and our repository. Feature IDs (F15.15 and so on) are the teardown's.
- **What "match" means here.** I read it as reaching parity on what Gong does for coaching reps, not rebuilding Gong's CRM, forecast and outbound tools. Part A sets out both, so you can choose.
- **Proposals are marked.** Where this doc says how to close a gap, that is a proposal for you to accept or change. Nothing here is a requirement until you decide it.
- **The split.** Part A is the build work (code, data, infrastructure). Part B is marketing and sales: how to position against Gong, what we can and can't claim, pricing, and what sales needs.

## Where ELOSTATE stands today

We fully have 26 of Gong's 346 features, do 64 a different way, partly have 82 and lack 174. In the first-release phase (P1) we lack only 7 of 70.

| Phase | Have | Different | Partial | Lack | Total |
| --- | --- | --- | --- | --- | --- |
| P1 — first release | 16 | 15 | 32 | 7 | 70 |
| P2 — useful coaching loop | 2 | 19 | 20 | 43 | 84 |
| P3 — enterprise / B2B | 0 | 29 | 25 | 123 | 177 |
| If taken — Gong doesn't do these | 8 | 1 | 5 | 1 | 15 |
| **Total** | **26** | **64** | **82** | **174** | **346** |

"Different" means we meet the same need another way, often on purpose. Examples are fixed roles instead of Gong's permission editor, and a fixed rubric instead of its scorecard builder. Treat these as matched unless Part A says otherwise.

The comparison's check of Gong's own pages confirmed 308 claims, partly confirmed 37 and contradicted 1. The one contradiction: Gong does show the evidence behind each AI score (F15.20). That narrows one of our advantages (see Part B).

# Part A — Tech

## Tech 1 — Structural fixes first

Four problems sit underneath many features. Fix them before adding anything, or later work gets built on the wrong base.

### 1. Add a reporting tree (F2.4, F3.2, F3.4)

**Today.** People have org tiers and departments but no manager link. A Sales Coach manager sees every rep in the company. Alerts go to every manager (`notify.ts:7`).

**Gong.** Every scope is built from "my direct and indirect reports": calls, coaching inbox, coaching metrics, forecast.

**What to do (proposal).**

1. Add `profiles.manager_id` (nullable, same company), with a database check that blocks loops.
2. Add a function that returns everyone below a given person, at any depth.
3. Change the pitch-score and coaching access rules from "any manager sees the whole company" to "you see yourself and everyone below you". Company admins (CEO and similar) keep company-wide access.
4. Send `strong_session` and `deal_closed` alerts to the rep's manager chain, not to every manager.
5. Let admins set managers one at a time now. Bulk upload (F2.8) can follow.

**Unblocks:** coaching inbox (F16.5), per-manager coaching metrics (F16.8), "tag my manager" feedback requests (F16.1), and team pickers on stats (F10.9).

### 2. Close the re-score loophole (F15.15)

**Today.** The score button is hidden from reps, but the pitch-score route lets the session owner re-score through the API (`skipIfScored:false`, `pitch-score/route.ts:103`). A re-score replaces the score and deletes its evidence rows (`0254_pitch_score_verdicts.sql:117`). Any manager overrides on that pitch then stop counting. Points are safe, because they are banked once.

**Gong.** Gong warns that re-scoring may give slightly different answers. That makes repeated re-scoring a way to fish for a better number.

**What to do (proposal).**

1. Only managers may re-score. A rep's call to the route should always respect `skipIfScored:true`.
2. Make a re-score add a new version instead of replacing the old one. Keep the old evidence. Either re-apply earlier overrides or flag them for the manager.
3. Store the model name and prompt version on every score, not only the rubric version (gap noted under F15.8).

### 3. Lock accounts after repeated failed sign-ins (F1.5)

**Today.** Sign-in goes from the browser straight to Supabase. Only Supabase's built-in rate limits apply. Team routes are rate-limited, but sign-in is not.

**Gong.** Five failed attempts lock the account for 60 minutes.

**What to do (proposal).** Send sign-in through a server route that records each attempt (`login_attempts`: email, IP, success, time). Refuse sign-in after N failures in a window, with a clear "try again at" message. Check both login pages (`/login` and `/sales-coach/login`).

### 4. Record what each session costs in AI (F28.7, F28.5)

**Today.** The DeepSeek adapter returns token counts on every call, but nothing saves them (`deepseek.ts:232`). ElevenLabs audio minutes are not logged per session. This matters because of the September out-of-credit outage and this week's storage-quota suspension.

**What to do (proposal).**

1. In the single `llmCall`/`llmStream` entry point, write one row per call to `ai_usage`: session, engine, provider, model, input and output tokens, audio seconds, estimated cost.
2. Add an admin view of cost per session, per rep and per company per day.
3. Extend the health route so it warns before LLM credit or storage runs out, not after.

This is the base for the AI credits pricing in Part B, if you ever want it.

## Tech 2 — Close the first-release gaps (P1)

P1 has 7 missing features and 32 partial ones. Account lockout (F1.5) and the re-score fix (F15.15) are covered in Tech 1. The 15 "Different" P1 features can stay as they are; the exceptions are noted below.

### The six other missing P1 features

| Feature | What to build (proposal) | Built on |
| --- | --- | --- |
| F9.3 Talk-time bar | A lane per speaker under the player, drawn from timed transcript segments. Tapping a lane plays only that speaker (also closes F9.2). | `speaker_cluster` + segment timing (0269, 0270) |
| F10.2 Longest monologue | Merge back-to-back segments by the same speaker; store the longest rep stretch per session. Show it next to talk ratio. Compute F10.3, F10.4 and F10.5 (P2) in the same pass, since they use the same data. | Timed segments |
| F9.13 Snippets | A `snippets` table (session, start, end, title, created by). A manager clips a moment; it goes through the existing rep-consent flow before other reps can play it. | `recording_share_events` (0260) |
| F11.1 Keyword trackers | A per-company phrase list (competitors, required disclosures, banned claims). Match it after transcription and store each hit with its timestamp. Show hits with the existing play-at-timestamp chips. | Transcript + PitchDetail chips |
| F16.2 "Feedback given" rules | One function that classifies rows that already exist: comments sent to rep, overrides, dispute answers, pattern "coached" events. Decide which count as feedback. Needs the reporting tree. | 0259, 0255, 0258 |
| F15.2 Range scales | Only needed if you want numeric 0–N questions. Our hit / partial / missed grades are a deliberate design. **Your decision:** keep three levels, or add ranges when you build a question builder (F15.1). | Rubric |

### The 32 partial P1 features

**Capture and processing**

- **F6.3 File upload.** Raise the 25 MB limit (Gong allows 2 GB). Use resumable chunked upload, as the door recorder already does, and notify the rep when analysis is done.
- **F6.6 Processing status.** The database already has six stages (recorded to complete). Show them as stage chips instead of one "processing…" label.
- **F5.7 Long recordings.** Give an explicit "too long" reason when a file fails the size check, instead of a generic failure.
- **F8.2 / F8.5 Speakers.** Fine for one rep plus one customer. Add free-text speaker names only if multi-person sessions (two reps, a couple at the door) start to matter.

**Session page and player**

- **F9.2 Player.** Put the player on the session page, not only on the manager Recordings tab. Add speaker isolation using the talk-time lanes.
- **F9.4 Transcript.** Add search inside the transcript and click-any-line-to-seek.
- **F9.8 Comments.** Add @mentions and a visibility choice (everyone / named people / only me). Keep append-only on purpose: corrections become new comments, not edits.
- **F9.9 Side-panel stats.** Add longest monologue next to talk ratio and question rate.

**Scoring**

- **F15.5 N/A.** Allow "not applicable" per rubric element, not only for objection handling, and rescale the section as the code already does for objections.
- **F15.7 Minimum length.** A 15-second door rejection is still scored today (the minimum is one rep segment). Gong skips transcripts under 100 words. **Your decision:** set a floor, and say what short pitches show instead of a score.
- **F15.9 Which sessions a rubric scores.** Let a rubric apply to one channel (door, phone or video) so each can have its own rubric. Today `isSalesCall()` is the only filter.
- **F15.12 Who sees scores.** Visibility is fixed (rep sees own, managers see all). Once the tree exists, the default becomes "rep plus their manager chain". A setting is only needed if a client asks.
- **F15.13 Telling the rep.** Low priority: the rep starts scoring themselves when they close the session. Only matters for back-filled scores.

**Coaching**

- **F16.1 Request feedback.** Add a "request feedback" button on any session, sent to the rep's manager. Today the only rep-to-manager request is a dispute.
- **F16.4 Closing requests.** A request closes when the manager comments, overrides, answers or marks it coached. Today only disputes can be open or closed.
- **F16.5 / F16.6 Coaching inbox.** On Coach Assessment, add per-rep columns for last feedback, last listened, overdue (30 days with no feedback) and open requests. Add a "no feedback yet" filter and a team switcher for managers of managers.
- **F2.4, F3.2, F3.5 Access.** Covered by the reporting tree in Tech 1.

**Stats, search and outcomes**

- **F10.7 Activity stats.** Add weekly hours on sessions and total time per rep.
- **F10.9 Team page.** Add a team picker (from the tree) and a channel filter (door / phone / video).
- **F11.9 / F12.1 Search.** Let tracker hits, score range and outcome filter the session list. Transcript search is in Tech 4.
- **F25.8 Outcome attributes.** Give each outcome two attributes: "connected" (yes/no) and sentiment (positive / neutral / negative). This also fixes the colours, which are emerald for Sold and grey for everything else (F26.10).
- **F25.9 Required outcome.** Door knocks always have an outcome. Sales sessions don't: `deriveGoal` finds **zero** sessions with an outcome in production. Make the outcome required when a phone or video session closes. Otherwise close rate and the AI day target can't use those sessions.

**Other**

- **F17.3 Role-play scenarios.** Store scenarios so they can be reused and assigned. Add difficulty and length fields.
- **F30.1 Notification settings.** Add per-type, per-channel settings for coach notifications. Today there is one toggle, and it's for C.A.R.E.
- **F30.7 Mobile app.** The native app is in a separate repo and wasn't checked. Confirm it covers recording, the session page and notifications.
- **F33.1 Retention.** Recording retention is fixed at the last 20 per rep. Make it a company setting with a sensible default, and show the policy to reps.

### "Different" P1 features to look at again

- **F17.5 / F17.6 Role-play.** Ours is text-only, and practice isn't scored by the live rubric. Gong uses voice and scores practice with the same scorecard as real calls. Matching means voice role-play plus scoring practice with the pitch rubric. Keep practice out of points and the scoreboard (F17.9 already does this).
- **F9.10 Team examples.** Reps can approve a recording as a team example, but nothing plays approved clips to other reps yet. Snippets plus a team library (Tech 4) finish this.
- **F10.1 Talk ratio.** We count words; Gong counts speaking time. Once segment timing is reliable, switch to time or show both.

## Tech 3 — Complete the coaching loop (P2)

Gong's real advantage after launch is that it measures managers and runs structured training. We have strong pieces (Pattern Interrupt checks whether coaching actually improved the rep), but no manager measurement and no training builder.

### Measure coaching activity (F16.8, F16.9, F16.10)

1. **Track listening.** Send playback progress from the player and record a "listened" event per manager, rep and session. **Your decision:** what counts as listened (any play, 30 seconds, or a share of the session).
2. **Coaching metrics page.** One row per manager: sessions listened to, sessions with feedback, comments, overrides, disputes answered, patterns coached. Filter by period and team, and compare with the previous period.
3. **Count activity when it happened,** not when the session was recorded. The pattern code already does this (`coachedAt`).

### Turn role-play into training (F17.1–F17.11)

- **Trainings.** Ordered lessons and practice items. A lesson is text plus a session clip (needs snippets).
- **Assignments.** Assign a training to a rep or team with a due date. Notify the manager on submission; today `manager_notifications` allows only `strong_session` and `deal_closed`.
- **Pass mark.** An optional minimum score to pass a practice. Retries stay unlimited.
- **Follow-up chat.** A chat after each attempt ("how should I have handled that?"), reusing Ask Coach.
- **Admin test mode.** Admins try a scenario before assigning it.
- **Bootcamp.** It is the obvious home for trainings, but it's empty and its content model is undecided. This is a product decision before it's a build task.

### Deepen detection and stats

- **Session types (F10.10).** Split every stat by channel (door / phone / video). Norms differ by channel.
- **Trackers (F11.3–F11.5, F11.12).** Once keyword trackers exist: limit a tracker to part of the call ("asked for the sale in the last 25%"), preview it against past sessions before going live, give it start and end dates, and let search filter on it.
- **Topic timeline (F11.11).** Turn the 3–5 key moments into a continuous lane under the player, using your pitch stages (opener, rapport, discovery, presentation, objection, close).
- **AI outcome check (F25.11).** Have the AI suggest an outcome from the transcript, shown next to the rep's own, so mismatches surface ("not interested" when the transcript has a callback).
- **Callback to-dos (F26.4).** Turn action items said in a session ("come back Thursday after 5") into a to-do for the rep. The Tasks module already exists.

### Assistant and briefs (F13.2, F13.8, F13.9)

- **Ask Coach.** Make it multi-turn, save the history, and return clickable timestamp citations, like the pitch-score chips.
- **Cross-session questions.** Let it answer one question across several sessions (a rep's last 20, a team's week).
- **Brief templates.** Admin-editable brief templates only make sense if clients want their own summaries. Treat as optional.

### Targets and metrics (F23.2–F23.4, F23.8)

Our KPI screens are fixed on purpose. To match Gong without building a metric builder: add per-rep weekly and monthly targets for the existing KPIs, and a page-wide period selector. A formula and metric builder (F23.2, F23.3) is only worth building if you sell to sales-ops teams.

## Tech 4 — Search, library and snippets

Finding a session again is our weakest area. The session list filters only by context, status, period and a name match. Global search (`/dashboard/search`, Cmd+K) doesn't cover sales sessions at all.

1. **Transcript search (F12.1, F9.4).** Add a full-text index on transcript segments. Search returns sessions with the matching lines; clicking one opens the session at that moment.
2. **More filters (F12.1, F15.18).** Rep (from the tree), channel, outcome, score range, rubric element hit or missed, tracker hit, talk ratio, has comments, disputed.
3. **Saved searches (F12.2).** Save a filter set under a name. Gong's saved searches can't be shared and send no alerts, so a private list matches it.
4. **Global search (F12.4).** Add sales sessions and transcripts to the existing global search.
5. **Team library (F12.5, F12.6, F12.8, F9.16).** Folders of sessions and snippets, private or company-wide, with a note on each item. Approved team examples (F9.10) go into a company "Team examples" folder automatically. Add "listen later".
6. **Session downloads (F9.15).** Download audio and transcript, for managers only.
7. **Session export (F12.3).** Export the filtered session list to CSV, alongside the existing KPI CSV.

**Streams (F12.7)** are saved searches that alert when a new session matches. They're worth adding only after manager alerts move to the reporting tree. Today's fixed Pattern Interrupt alert covers the most valuable case.

## Tech 5 — Operations, privacy and security

These gaps don't change what a rep sees, but they decide whether larger clients can buy, and whether a recording can cause harm.

### Privacy and recorded customers

- **Number redaction (F33.3, F33.5).** Door pitches can capture card or account numbers read aloud. Mask long digit strings in transcripts and mute them in audio, as Gong does. Card numbers are read at the door, so I would make this P1 for door clients, not P2.
- **Erasure on request (F33.6).** Today erasure is manual, by email. Add an admin tool that finds and deletes everything tied to a customer. A homeowner is identified by name or address, not email, so this depends on the household record (Tech 6, F21.6).
- **Consent (M7, F7.1, F7.2).** No in-app consent step. You decided on 2026-08-18 that consent is handled legally. The door state machine already has a slot for a CONSENT step if you change that. Gong offers no in-person consent guidance either. Phone and video calls are different: Gong plays an audio announcement, and we have TTS that could do the same.
- **Exclusions (F33.8, F27.11).** Rules that auto-delete or hide sessions by phrase. Low priority while recording only starts when the rep chooses.
- **Trim (F9.17).** Cut a section out of a recording. Today audio can only be deleted whole.

### Security and trust

- **Audit log (F31.5).** Write an append-only log of who viewed, overrode, deleted or exported what. The vendor monitoring log (0214) and the finance log (0120) show the pattern.
- **Certifications (F33.9).** The privacy page says there's no SOC 2 at pilot scale. Gong lists ISO 27001/27701/42001, SOC 2 Type II and PCI DSS. Large buyers will ask, so this is a cost and timing decision, not a code task.
- **Device passcode (F30.9).** Check whether the native app (separate repo) requires a device passcode, as Gong's does.
- **Rate limits (F31.6).** The limiter is in-memory, per instance. Move it to a shared store before scale, as the code comment already says.

### Sign-in and team admin

- **Google and Microsoft sign-in (F1.2, F1.4).** Supabase supports both. Worth adding for office-based phone and video teams.
- **Phone sign-in (F1.10).** Reps still need an email; admins work around it with a team password. Phone one-time codes suit field reps without work email.
- **Bulk team upload (F2.8).** A CSV to add people and set their managers. Needed once a client has more than about 20 reps.

### Capture beyond the door

- **Language (F8.6, F8.9).** Speech-to-text is fixed to English on purpose, because auto-detect mislabelled accented English. Matching Gong needs a language setting per company or rep, plus a custom vocabulary list for product and place names. Test on real recordings before you promise any language, including Taglish.
- **Meeting bot and calendar (F5.1, F4.1, F4.2).** Gong records video calls with a bot that joins from the calendar. We record through the device mic or by upload. This is the most expensive single gap. Build it, buy a recording-bot service, or stay mic-and-upload: your decision, and it should follow demand from phone and video clients.
- **Lock-screen recording indicator (F6.5).** Not possible in a web app. Only matters in the native app.
- **Failure reasons (F5.9, F5.10).** We have curated failure messages but no closed list of reason codes. Make one, so a manager can see why sessions weren't analysed, as Gong's skip codes do.

### Integrations

- **Webhooks (F31.8).** A signed webhook on "session scored" and "deal closed" lets client systems react without a public API. This is the cheapest integration to offer first.
- **Slack and Teams (F30.4, F30.5).** None today. Your recorded decision is that manager alerts are in-app only. That conflicts with the weekly email digest already in the code: see Open decisions.

## Tech 6 — What a full match would add (the P3 stack)

Most of the 174 missing features are Gong's tools for B2B pipelines and large enterprises. A door-to-door team doesn't need them. They are listed so that "match both" is a choice you make, not something left out by accident. Each row is a separate project.

| Area | Gong | ELOSTATE today | What matching would take |
| --- | --- | --- | --- |
| Deals and pipeline (M20) | CRM opportunities with warnings, methodology playbooks, a daily win-likelihood score, win/loss analysis | A sale is an outcome on one session (sold / no sale / follow-up, plus deal value) | A deals table linking many sessions; warnings; win/loss breakdowns. A win-likelihood model needs hundreds of closed deals first. |
| Accounts (M21) | Account boards and a full timeline per account | Revisits linked only by a free-text client label | A household or customer record with address (F21.6), then a timeline per customer |
| Forecast (M22) | Forecast boards, submissions, snapshots, accuracy | None (the finance forecast is cash runway) | Only for teams that forecast. Door teams run daily targets, which we already have (F19.4). |
| Outbound (M24–M26) | Email and call sequences, a dialer, contact data lookup | None | A full sales-engagement product. A Twilio dialer (M25) is the only piece with clear value for phone reps. |
| CRM sync (M29) | Matches calls to contacts, accounts and deals; writes back to Salesforce, HubSpot, Dynamics | No-CRM by design | Start with one CRM a paying client uses. Not before. |
| Public API and MCP (M31, M32) | REST API, OAuth apps, signed webhooks, an MCP server for Claude and ChatGPT | Internal routes only | Webhooks first (Tech 5), then a small read API. An MCP server over sessions is cheap once access rules are right. |
| Warehouse export (M34) | Daily export to Snowflake, BigQuery and others | CSV of a few tables | Not needed; the data is already in Postgres. |
| Workspaces, seats, permission editor (M2, M3) | Workspaces, per-person seats, a permission-profile editor | One company, module lock by pilot code, fixed roles | Per-person seats only when billing goes live (Part B). Keep fixed roles unless a client needs custom ones. |
| AI credits (M28) | Pooled credits per seat, per-user caps | Not metered | Needs the cost ledger (Tech 1) first. A pricing decision, not a build one. |

Two pieces are nearly built. **Single-visit sale record (F20.14):** sessions already store the outcome and deal value; adding product and closed date finishes it. **Household record (F21.6):** a small table plus an address picker at the door, which also fixes erasure (Tech 5).

## Tech build order

The order follows dependencies. Each stage needs the one before it. No time estimates: your build speed makes conventional estimates meaningless as a schedule.

1. **Foundations.** Reporting tree, re-score fix, sign-in lockout, AI cost ledger (Tech 1). Also make outcomes required on phone and video sessions (F25.9), because close-rate data starts accumulating from that day.
2. **Session page.** Talk-time lanes with speaker isolation, longest monologue and the other timing stats, player on the session page, transcript search and click-to-seek, processing stage chips.
3. **Coaching loop.** Feedback requests and closure, feedback-given rules, coaching inbox columns, listening tracking, coaching metrics per manager.
4. **Detection.** Keyword trackers, N/A per element, minimum length for scoring, a rubric per channel, outcome attributes.
5. **Find and reuse.** Snippets, team library with approved examples, saved searches, more filters, session export.
6. **Training.** Stored scenarios, assignments with due dates, practice scored by the pitch rubric, voice role-play.
7. **Protection.** Number redaction (earlier if door clients take payment details aloud), audit log, retention setting, erasure tool with household records.
8. **Reach.** Webhooks, Google and Microsoft sign-in, bulk team upload, then language support once tested.

The P3 stack (Tech 6) stays outside this order until you decide to match it.

# Part B — Marketing & sales

## Marketing & sales 1 — Positioning: where we are ahead

Don't sell ELOSTATE as a cheaper Gong. Gong is built for B2B teams on video calls with a CRM. We are built for reps in the field, on phones, with or without a CRM. In that market, the comparison shows six real advantages.

| Advantage | What we do | What Gong does | Evidence |
| --- | --- | --- | --- |
| Built for the door | Record every pitch on a phone, in 15-second chunks while recording; every knock gets a required outcome; a mis-tap can be undone | In-person recording is a side feature of its mobile app | F6.4, F6.7, F25.7 |
| Motivation built in | Points per session, two scoreboards, badges, praise alerts to managers, an AI-set daily door target | No points, badges or streaks; sold by third-party add-ons. Only a "top performer" crown in Engage analytics | M19, F19.1–F19.4 |
| Fair AI scoring | Managers override each item with a required reason; reps can dispute a score or one item; evidence quotes jump to the moment | AI scores show rationale and evidence; overrides need a permission; no rep dispute documented | F15.14, F15.20, F15.21 |
| Coaching during the call | Live coaching cues in our own app, for in-person and phone calls | Live insights only inside Zoom | F5.11 |
| Coaching judged by results | "Mark as coached" on a weakness, then tracks whether the rep's miss rate improves | Counts manager activity (comments, scores, listens) | F16.3 |
| No CRM needed | Every coaching view works from our own session records | Several coaching views and custom outcomes need a CRM | F16.7, F25.10, F29.9 |

Two more strengths are worth saying in demos: role-play rebuilt from the rep's own recorded pitch (F17.12), and phone-friendly role-play where Gong's training is web only (F17.14).

**Proposed one-line position (to test, not final):** *"Coaching and motivation for sales reps in the field — every pitch scored, every rep ranked, no CRM required."*

**Who to aim at:** door-to-door and field teams (telecom, solar, home services, pest control), and small phone teams that Gong's platform fee prices out. Avoid B2B software teams that need CRM sync, forecasts and outbound sequences: that is Gong's home ground (Tech 6).

## Marketing & sales 2 — What we can and cannot claim yet

One claim on our own marketing page is false today, and it should come down before anything is published against Gong.

### Fix now

- [ ] **Remove CRM integration copy.** The marketing demo page mentions HubSpot and Salesforce (`dashboard/marketing/page.tsx:49`, `:57`), but there is no CRM integration (F20.2, F29.8). Remove it, or label it "planned".
- [ ] **Don't claim "Gong doesn't show evidence".** The comparison found Gong does show the AI's rationale and the transcript evidence behind each score (F15.20). Our real difference is timestamped quotes that jump to the moment, plus rep disputes.
- [ ] **Line up the "in-app only" alert claim with the code.** Managers also get a weekly email digest naming top performers (`weeklyDigest.ts:12`). Either change the claim or the code (see Open decisions).

### Safe to claim now

- Every pitch is scored automatically on a published rubric, with evidence quotes linked to the moment.
- Managers can correct any score item; every correction needs a reason and is logged.
- Reps can dispute a score or a single item.
- Points, scoreboards, badges and an AI-set daily door target are built in.
- Every door knock is logged with an outcome, including knocks with no recording.
- Works without a CRM.
- Live coaching cues during in-person and phone calls.

### Not until it's built or proven

| Don't claim | Why | Becomes claimable after |
| --- | --- | --- |
| "Works in any language" | Speech-to-text is fixed to English | Language support, tested on real recordings (Tech 5) |
| "Enterprise-grade security" / SOC 2 | No SOC 2 or ISO certification | A completed audit |
| "Records your Zoom / Teams calls automatically" | No meeting bot or calendar link; mic or upload only | A meeting bot (Tech 5) |
| "Integrates with your CRM / Slack" | None built | A first integration |
| "Voice role-play" | Role-play is text-only | Voice role-play (Tech 3) |
| "Protects card numbers" | No redaction | Number redaction (Tech 5) |
| "Upload any recording" | 25 MB limit | Larger uploads (Tech 2) |
| "Managers see only their team" | Any manager sees the whole company | The reporting tree (Tech 1) |
| Any result figure ("lifts close rate by X%") | No measured client results yet | Pilot data you collect (Marketing & sales 4) |

## Marketing & sales 3 — Pricing and packaging against Gong

Per seat, $99 a month is close to Gong's reported licence price, so "far cheaper" only holds once Gong's platform fee, onboarding fee and add-on modules are counted. The comparison called our price "far below" Gong's (F35.3); per seat that overstates it.

**Gong (not published; third-party estimates that disagree):** [Revenue Grid](https://revenuegrid.com/blog/gong-pricing/) reports about $1,300–1,600 per user per year for the core licence, a mandatory platform fee of $5,000–50,000 a year, and one-time onboarding of $7,500–65,000. [Claap](https://www.claap.io/blog/gong-pricing), using Vendr contract data, reports $1,200–2,400 per seat, a platform fee usually from $5,000, and onboarding of $0 to $7,500 or more, with standard onboarding often included. Role-play (Enable), forecast and outbound are sold as add-ons, and Gong meters AI with credits.

**ELOSTATE:** a $99-per-user pricing deck in `docs/pricing`. I've assumed $99 is per month; the deck wasn't opened to confirm. Billing isn't live (`billing_status` defaults to `not_collecting`, Stripe not wired).

| First-year cost (US$) | ELOSTATE at $99/user/month | Gong: licences + $5k platform + $7.5k onboarding |
| --- | --- | --- |
| 10 reps | 11,880 | 25,500–28,500 |
| 25 reps | 29,700 | 45,000–52,500 |
| 50 reps | 59,400 | 77,500–92,500 |

The Gong column uses Revenue Grid's core licence range, the lowest platform fee and the lowest onboarding fee. If onboarding is included, as Claap says it often is, subtract $7,500. Larger teams are often quoted a higher platform fee.

### What needs deciding before we sell

1. **Confirm the unit.** Is $99 per user per month or per year? The comparison and this table assume monthly.
2. **Know our cost per session first.** We can't tell whether $99 leaves a margin until the AI cost ledger exists (Tech 1). Heavy door reps record many sessions a day.
3. **One price or modules?** Gong charges extra for role-play and training. Including role-play, scoring and motivation in one price is a selling point, if margins allow.
4. **No platform fee, said out loud.** Our clearest price advantage against Gong for small teams is no platform fee and no onboarding fee. Say so.
5. **Seats.** Billing per person needs per-person seats (F2.5). Today access is per company by pilot code.

## Marketing & sales 4 — What sales needs to sell against Gong

The biggest missing sales asset is proof. We have no measured client results, and every competitive claim is stronger with one real number from the door-to-door pilot.

### Assets to make

- [ ] **Proof from the pilot.** With the client's permission, measure from data we already store: pitch score trend per rep, close rate (sold ÷ presentations), doors per day against the AI target, and how often a coached pattern moved to "improving". Pick the measures and baseline period before publishing anything.
- [ ] **One-page battlecard.** The six advantages (Marketing & sales 1), the safe claims, honest answers to the gaps, and the price comparison.
- [ ] **Demo script built around one door.** Knock → record → outcome → automatic score with evidence → manager correction with a reason → points and scoreboard → role-play rebuilt from that pitch. It shows the whole loop in one story, and it's the story Gong can't tell.
- [ ] **Comparison page "ELOSTATE vs Gong for field sales".** Only the safe claims, with dates. Gong changes monthly, so date-stamp it and review it every quarter.
- [ ] **Short videos.** The Sam and Archi series already shows live coaching. Add an episode on scoring with evidence and the scoreboard: the two things Gong doesn't do.

### Objections to prepare for

| The buyer says | Honest answer |
| --- | --- |
| "We already use Gong." | Gong covers video calls and the CRM. We cover reps at the door and on the phone, where Gong only has a side feature. Both can run side by side. |
| "Is it secure? Are you SOC 2?" | Not yet. Data is separated per company at database level, recordings are in private storage with short-lived links, and old recordings are deleted automatically. Give the certification date once there is one. |
| "Does it connect to our CRM?" | Not today. Sessions, outcomes and deal values live in ELOSTATE. Webhooks are the planned first step (Tech 5). |
| "Our reps don't speak English on the doors." | English only today. Don't promise a date until it's tested on their recordings. |
| "What if the AI scores a rep unfairly?" | Reps see the evidence quote behind every item and can dispute it. Managers can correct it, with a logged reason. Points are fixed at the first score. Once the re-score fix lands (Tech 1), the score shown can't be re-rolled either. |
| "Can managers only see their own team?" | Not yet: today every manager sees the whole company. Say so until the reporting tree ships. |

### Sales readiness gates

Sell to multi-manager teams only after the reporting tree ships. Sell to teams taking payment details at the door only after number redaction ships. Sell to non-English teams only after language testing.

# Open decisions

These are yours to make. Each one changes what gets built or said. The first five block Tech 1 and 2.

| # | Decision | Side | Why it matters | Where |
| --- | --- | --- | --- | --- |
| 1 | Match Gong on coaching only, or also on the P3 revenue stack? | Both | Sets the size of the whole programme | Tech 6 |
| 2 | Do company admins keep company-wide access once managers see only their teams? | Tech | Shapes the new access rules | Tech 1.1 |
| 3 | Who may re-score, and should a re-score keep the old version? | Tech | Stops score fishing; keeps overrides | Tech 1.2 |
| 4 | Lockout after how many failed sign-ins, for how long, or rely on Supabase? | Tech | Security baseline | Tech 1.3 |
| 5 | Minimum session length before a pitch is scored | Tech | Very short door rejections are scored today | F15.7 |
| 6 | Keep hit / partial / missed, or add numeric ranges and a question builder? | Tech | Gong's scorecards are configurable; ours is fixed | F15.1, F15.2 |
| 7 | What counts as "feedback given" and as "listened"? | Tech | Defines manager metrics | F16.2, F16.10 |
| 8 | Voice role-play? Score practice with the pitch rubric? | Tech | Matches Gong's AI Trainer | F17.5, F17.6 |
| 9 | Manager alerts in-app only, or keep the weekly email digest? | Both | The code and your recorded decision disagree | F19.3, `weeklyDigest.ts:12` |
| 10 | Does the 2026-08-18 consent decision still stand? Add an announcement for phone and video? | Both | Legal exposure; affects what sales can promise | M7, F7.9 |
| 11 | Meeting bot: build, buy, or stay mic-and-upload? | Tech | Most expensive single gap | F5.1 |
| 12 | Default recording retention per company | Both | Privacy promise to clients | F33.1 |
| 13 | Make number redaction P1 for door clients? | Both | Card numbers are read aloud at the door | F33.3 |
| 14 | Is $99 per user per month? One price, or modules? Per-person seats? | Sales | Every price comparison depends on it | Marketing & sales 3 |
| 15 | When, if ever, to pursue SOC 2? | Both | Large buyers ask first | F33.9 |
| 16 | What is Bootcamp's content model? | Tech | Home for trainings | F17.1, F17.13 |
| 17 | Which languages, and is Taglish in scope? | Both | Speech-to-text is English-only | F8.6 |
| 18 | Which pilot measures and baseline to publish, with client permission? | Sales | No proof points yet | Marketing & sales 4 |

## Sources

- [Gong vs ELOSTATE comparison](https://claude.ai/artifact/6SunwZuGFDXJNwXFyWYNxq): code at commit 0214913; Gong pages read 13 Nov 2026.
- [Gong Teardown](https://claude.ai/artifact/33xYwHLGCyR65nEy5VosAW): feature IDs and phases.
- [Revenue Grid — Gong pricing](https://revenuegrid.com/blog/gong-pricing/) and [Claap — Gong pricing](https://www.claap.io/blog/gong-pricing): third-party price estimates, read 13 Nov 2026.
