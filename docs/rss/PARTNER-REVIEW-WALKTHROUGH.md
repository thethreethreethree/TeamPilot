# Remote Sales — partner review walkthrough

For the founder presenting the Remote Sales module. About 20 minutes: the full module (15), then Macro Mode, the
simplified view (5). Updated 2026-11-22 for the build at e7fa6293.

## Before the review (once, ~25 minutes)

1. **Push and confirm the new build is live.** VS Code → Source Control → **Sync Changes**. Then the sidebar shows
   **Remote Sales** as its own module, and inside it the tabs **Calls · Pipeline · Scoreboard · Search · Library ·
   Training** (managers also see Coaching and Trackers; admins see Protection). The database for everything below is
   already applied.
2. **Put 2–3 real calls in.** Remote Sales → Calls → choose **Phone** or **Online video** → on the call's page, either
   upload a recording, or record live (see step 3 below for the prospect's side). Tap which voice is the rep, name the
   call. Wait a few minutes for each to reach **Ready**.
3. **Record one call live with both sides** (desktop Chrome or Edge). Have the call open in another tab (Meet, Zoom,
   Teams, a browser dialer). Tick "The prospect knows this call is recorded" (and say the suggested line on the call), start live coaching, keep "Record and transcribe the prospect too" ticked, pick the call's
   tab in the share box and tick **Share tab audio**. The transcript shows Salesperson lines from your mic and Prospect
   lines from the call.
4. **Fill the scores.** As an admin, run the scoring backfill once (it shows the count first).
5. **Pick one call** with a clear objection or price discussion — it makes the scorecard and Ask Coach land.

## The walkthrough — the full module

| Step | Click | What it shows |
|---|---|---|
| 1 | Sidebar → **Remote Sales** → Calls | Phone and video calls in one list, newest first, with outcome and live status chips |
| 2 | Open the prepared call | Status chips (Uploading → Transcribing → Analyzing → Scoring → **Ready**); a failure says why in words |
| 3 | Player + talk-time lanes | Who spoke when ("You" / "Customer"); tap a bar to jump there; play one speaker only |
| 4 | Interaction stats | Talk ratio, longest monologue, patience, questions per hour — against the rep's own average |
| 5 | Scorecard | Each rubric item graded hit / partial / missed **with the evidence quoted**; play any evidence |
| 6 | Transcript | Searchable; tap any line to hear it |
| 7 | **Ask Coach** | "How did I handle the price objection?" — the answer cites lines you can click |
| 8 | Follow-through | The callbacks the customer asked for, each quoting its line; one click makes it a task |
| 9 | **Comments** (manager) | On the call page: comment at a time, @mention a colleague, choose who can read it; the rep sees it |
| 9b | **Coaching** tab (manager) | The feedback requests and the score-dispute queue for phone and video calls; a rep's dispute rings the manager's bell, and the answer rings the rep's |
| 10 | **Search** | Find calls by what was said; filter by score, rubric item, talk share, tracker, disputed; export CSV |
| 10b | **Trackers** (manager) | Write a phrase list and press **Preview on recent calls**: how many of the last 30 calls it would catch, which phrase is too common, and example lines that open the call there — before saving |
| 10c | **Search** → Topic or competitor | "pricing" or a competitor's name finds the calls where the AI heard it discussed |
| 11 | **Scoreboard** | Remote Sales has its own points and leaderboard — phone and video calls only |
| 12 | **Protection** (admin) | Retention, legal erasure of one customer's data, the audit log of who did what, and the **transcription vocabulary** (product and competitor names transcription should get right — opt-in, about 20% more transcription cost) |
| 13 | **Training** (manager) | **Try it** on a scenario plays it as a rep would, as a test run that is recorded nowhere; then **Assign** |

## The walkthrough — Macro Mode (the simplified system)

The team's brief: "KEEP IT SIMPLE … What would set us apart is the simplicity."

| Step | Click | What it shows |
|---|---|---|
| 1 | Calls → **Macro Mode** switch on | A rep's tabs become **Today · Pipeline · Calls** (a manager keeps every tab and gains Today) |
| 2 | **Today** | "Hello …, what's our to-do list for the day?" Type the day in plain words → organized by time, with the **two needle movers**; plus today's scheduled calls and due to-dos from the pipeline, and yesterday in numbers |
| 3 | Open a call | Just the player and three tabs |
| 4 | **Highlights** | Call brief, key points, next steps; **Draft an email / Draft a text** to copy and send; "Add to pipeline" |
| 5 | **Coaching** | The score out of 100, what you did well, your next level — and the manager's comments |
| 6 | **Next Meeting** | Agenda, what to bring up again, and the **checklist you review** — edit it, untick what you won't do, save it as to-dos with due dates; set the next call date |
| 7 | **Pipeline** | **Open ($) · Closed Won · Closed Lost**; per prospect the next to-do, stage, next and last call, amount; tick a to-do done; managers open each rep's pipeline |
| 8 | "Show the full call page" | Macro Mode is never a one-way door |

## Points worth saying

- **Every claim points at a moment in the call.** Scores, key points, Ask Coach answers and comments link to the audio;
  a key point the call does not support is dropped, not shown.
- **Both sides of a live call.** The prospect is recorded from the call itself, labelled by where the audio came from,
  not guessed from loudness.
- **The rep stays the author.** Follow-ups are drafts the rep sends; the checklist is saved only after the rep reviews
  it; the day plan only organizes what the rep wrote. The AI's read of the outcome appears after the rep's own.
- **Our own simple CRM.** No trip to HubSpot and back; every change is kept on the record.
- **Privacy is built in.** Trim a sensitive moment and it disappears from every reader; erase a customer's data on
  request, with the erasure itself on the record.

## Avoid during the review

- **Admin → AI cost** — shows "price missing" until AI prices are entered.
- **Protection → Webhooks** — says "not configured" until the signing secret is set.
- **Google / Microsoft sign-in** — hidden until the providers are set up; sign in with email.
- **Live prospect capture on Safari or a phone** — the browser can't share another tab's audio there; the screen says
  so. Use desktop Chrome or Edge, or upload the recording.
