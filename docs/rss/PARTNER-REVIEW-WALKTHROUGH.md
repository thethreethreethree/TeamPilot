# Remote Sales — partner review walkthrough

For the founder presenting the Remote Sales module. About 15 minutes. Everything below ships in the current build.

## Before the review (once, ~20 minutes)

1. **Confirm the new build is live.** Sidebar footer reads "Constitution v1.14", and **Remote Sales** appears under
   Sales Coach.
2. **Put 2–3 real calls in.** Remote Sales → start a session → choose **Phone** or **Online video** → on the session
   page, upload a recording (a real sales call, or a 3–5 minute role-play recorded on a phone). Tap which voice is the
   rep, name the call. Wait a few minutes for each to reach **Ready**.
3. **Fill the dashboards.** As an admin, run the scoring backfill once (it shows the count first: about 114 calls).
4. **Pick one call** with a clear objection or price discussion — it makes the scorecard and Ask Coach land.

## The walkthrough

| Step | Click | What it shows |
|---|---|---|
| 1 | Sidebar → **Remote Sales** | Phone and video calls in one list, newest first, with outcome and status |
| 2 | Open the prepared call | Status chips (Uploading → Transcribing → Analysing → Scoring → **Ready**) — every stage is visible, and a failure says why in words |
| 3 | Player + talk-time lanes | Who spoke when ("You" / "Customer"); tap a bar to jump there |
| 4 | Interaction stats | Talk ratio, longest monologue, patience, questions per hour — against the rep's own average, not a generic benchmark |
| 5 | Scorecard | Each rubric item graded hit / partial / missed **with the evidence quoted**; press play on any evidence to hear that exact moment |
| 6 | Transcript | Searchable; tap any line to hear it |
| 7 | **Ask Coach** | Ask "How did I handle the price objection?" — the answer cites line numbers you can click, and it says so if it reads the moment differently from the scorecard |
| 8 | Manager view: comment on a moment | Comments at a timestamp, @mention a colleague, choose who can see it |
| 9 | Library | A strong moment saved as a clip for the team |
| 10 | Settings → **Protection** | Retention ("keep the last N per rep"), legal erasure of one customer's data, and the audit log of who did what |

## Points worth saying

- **Every claim points at a moment in the call.** Scores, Ask Coach answers and comments all link to the audio.
- **The rep's judgement comes first.** The AI's read of the outcome is shown only after the rep records their own,
  as a second opinion.
- **Privacy is built in.** A manager can trim a sensitive moment (a card number) and it disappears from every reader;
  a customer's data can be erased on request, with the erasure itself on the record.

## Avoid during the review

- **Admin → AI cost** — shows "price missing" until AI prices are entered.
- **Settings → Protection → Webhooks** — says "not configured" until the signing secret is set.
- **Google / Microsoft sign-in** — hidden until the providers are set up; sign in with email.
