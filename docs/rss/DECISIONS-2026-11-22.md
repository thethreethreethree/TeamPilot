# Decisions made on 22 November 2026 — and what each one changed

Every decision below was put to the founder as a choice with a recommendation, answered, and then built. The full record
of each is in `docs/rss/docs/00-OPEN-DECISIONS.md` (plan decisions) and `docs/tbc/2026-11-20-rss-p9/check.md` (the build).

| # | Question | Decision | What changed in the product | Commit |
|---|---|---|---|---|
| — | Separate Remote Sales from Sales Coach — which owns video calls? | Remote Sales owns every phone and video call; Sales Coach is in-person only | Own home, call page, start flow and screens | d4fc60d1 |
| — | Numbers: one scoreboard or two? | Remote Sales has its own scoreboard and points | Sales Coach counts in-person only; Remote Sales counts phone/video | dadfad4e |
| — | Record the prospect too? | Yes — "the audio needs to be recorded and monitored for both" | Live calls capture the call tab's audio; the prospect is transcribed separately and labelled by source | eab8523c |
| — | Team's "simplified interface" document | Build it as Remote Sales Macro Mode | Today · Pipeline · Calls; each call as Highlights / Coaching / Next Meeting; own CRM | bb0ec011 |
| — | Recording consent on phone and video calls | The rep confirms at Start | Live recording (and upload) of a remote call asks "The prospect knows this call is recorded"; kept per call | 0999e317 |
| D15 | Remove long numbers from transcripts? | On — runs of 9+ digits | Card numbers, SSNs, account and phone numbers stored as "[number removed]" on new calls | 1fbbd770 |
| D4 | Account lockout | 5 failures in 60 min → locked 60 min | Sign-in refuses after 5 failed attempts; email reset still works | 919afcdf |
| D8 | What counts as feedback; as listened | Deliberate coaching; half the call | Coaching metrics now show per manager in Remote Sales → Coaching | 919afcdf |
| D5 | Minimum before a call is scored | 100 rep words | Shorter calls show "Too short to score", earn no points, cost nothing | 9e491bda |
| D10 | Weekly email to managers | In-app only | The managers' top-performer email stopped | 9e491bda |
| — | Weekly email to reps | Keep | Reps still get their own weekly progress | — |
| D16 | Largest phone/video upload | 100 MB | Phone/video recordings up to ~an hour; door stays 25 MB | 9e491bda |
| D6 | How phone and video calls are scored | A phone & video rubric drafted from the door rubric — approved as drafted | New phone/video calls scored with it; each score says which rubric it used | 98b190ca |

## Decided on 23 November 2026

| # | Question | Decision | What changed in the product | Commit |
|---|---|---|---|---|
| — | Score repaired calls automatically each night? | Keep manual; make the waiting calls visible | Remote Sales → Coaching shows its own "never been scored" panel for phone/video calls; Sales Coach's counts in-person only; managers' Today shows how many are waiting | eda03ec5, 93dfeefa |
| D9 | Voice role-play; score practice with the rubric? | Keep as is | Nothing — text practice, 0–100 focus score; revisit after real remote calls are scored | — |
| D17 | Languages other than English for remote calls | English only | Nothing — added when a pilot sells in another language | — |
| D18 | Where trainings live | Remote Sales → Training | Nothing — it was already there (placed 22 Nov) | — |
| D14 | Default recording retention | 90 days | With no company setting, audio older than 90 days is removed nightly, however many calls; a company's "keep the last N" still wins; Protection says which applies. First run removes 1 recording (of 18) | (this commit) |
| D7 | Rubric grades | Keep hit / partial / missed | Nothing | — |
| D19 | Talk-pattern settings | Keep Gong's values | Nothing | — |

Follow-on fixes from the phone & video rubric (no decision needed): its items appear in stats, breakdown and search
(11f487e9); a phone/video pitch can earn Clean sweep (baa11d07); Pattern Interrupt (Sales Coach) counts in-person calls
only (dfcd8279).

## Still open

- Correction (23 Nov): an earlier version of this page said no plan decisions were open after D9 and D17. D7, D14, D18
  and D19 were also still open; all four were decided later the same day. Still undecided, on purpose: D11 (recording
  notice wording — the product asks the rep to confirm the prospect knows; no legal wording is drafted here), D12
  (meeting bot) and D13 (dialer), both listed as separate products.
- Founder setup (not decisions): Google/Microsoft sign-in setup, the webhook signing secret, AI provider prices,
  Supabase quota numbers — each listed in `docs/residuals/OPEN.md`.

## Not yet seen on a real call

Everything above is built, tested and (where it needs the database) applied. The parts that only a real call can prove —
the prospect's side on a live call, Macro Mode's AI notes, the phone & video rubric's first score — are the first checks
after the code is pushed (VS Code → Source Control → Sync Changes).
