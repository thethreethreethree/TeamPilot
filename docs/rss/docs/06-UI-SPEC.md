# 06 — UI spec

Follows the shipped Sales Coach UI: dark, zinc-950 ground, zinc-900 cards, yellow-400 as the
**only** accent, system font, phone-first. The repo's theme wins; `theme:audit` enforces it. See
`elostate-remote-sales/src/styles/README.md`.

**One rule added by this plan:** status, outcome and speaker are never shown by colour alone. Each
gets a word or a glyph too.

## Remote session page (`/dashboard/sales-coach/[id]`, phone/video) — Phase 2

Top to bottom, phone width first:

1. **Header.** Client label (editable, existing) · channel chip (`Phone` / `Video`) · date ·
   duration · outcome chip. Plus **stage chips** while processing: Uploading → Transcribing →
   Analysing → Scoring → Ready. The current stage is filled yellow and the rest are outlined. On
   failure, one red-bordered chip carries the reason in words ("No speech heard", "File too large").
2. **Player.** Play/pause, ±10 s (existing), 1–2× speed (existing), waveform with scored-moment
   markers (existing).
3. **Talk-time lanes.** Two rows under the player, labelled **You** and **Customer** (a third,
   **Unclear**, only if present). Bars sit where each spoke. Tapping a row's label isolates that
   speaker. Tapping a bar seeks.
4. **Stat strip.** Talk ratio (time) · longest monologue (m:ss) · longest customer story · patience
   (s) · questions/hour · interactivity (/10). Each shows the rep's own 30-day average beside it,
   **not** a Gong benchmark. "—" when the stat can't be measured, with a one-line tooltip why.
5. **Score panel** (existing PitchDetail). If the rubric is a fallback, the D6 caveat sits as a
   single line above the total, in zinc-400, never hidden.
6. **Tracker hits.** Chips "Competitor · 03:12", tap to play (same chip as rubric evidence).
7. **Transcript.** Search box pinned on top; matches highlighted; any line taps to seek.
   Speaker labels in words.
8. **Comments** (existing) + `@` picker + visibility selector (Everyone / Named people / Only me).
9. **Actions.** Rep: *Request feedback* (picker lists only people above them) · *Dispute*
   (existing). Manager: *Clip snippet* · *Add to library* · *Re-score* (asks for a reason) ·
   *Trim* · *Download*.

## Closing a remote session — Phase 1

When the call ends, a bottom sheet asks **"How did it end?"** with five buttons: Sold · Follow up ·
No sale · No contact · Undecided. There is no close button without a pick. This mirrors the door
knock's required outcome.

## Coaching inbox (Coach Assessment) — Phase 4

The existing board gains, per direct report: *Last feedback* (date, or "—" plus an "Overdue" chip
after 30 days) · *Last listened* · *Open requests* (count, tap to list). Filters: *No feedback yet* ·
team switcher (shown only to managers of managers). The dispute and rude-flag queues stay as they are.

## Coaching metrics — Phase 4 (last step)

One row per manager: sessions listened · sessions with feedback · comments · overrides · disputes
answered · patterns coached · change against the previous period. **Until D8 is decided, the page
shows one line: "What counts as feedback hasn't been decided yet." No numbers.**

## Find — Phase 5

Session list with a filter rail (rep, channel, outcome, score range, rubric element, tracker, talk
ratio, disputed), a transcript search box, *Save search*, and *Export CSV* for managers. The
Library tab has *Mine* and *Company*. A company item shows "Approved by {rep}". If the rep revokes
consent, the item disappears for peers.

## Training — Phase 7

Managers: scenario builder (title, persona, situation, channel, difficulty, length, optional pass
mark, optional "from this session"), then *Assign* (reps, due date). Reps: *Assigned to you*, with
due date and status, then the existing role-play screen. Screen placement (Bootcamp vs Training
tab) is D18.

## Admin — Phases 0, 8, 9

Team page: a manager picker per person (Phase 0) and CSV import (Phase 9). Settings: retention,
erasure requests, webhooks, audit log (company admins only). AI cost: **vendor back office only**,
never in a tenant's settings.

## Copy rules

Plain words. No claim the system can't back. Never "customer consented" or "call was announced"
(D11). Never a benchmark shown as a goal. An undecided rule shows that it's undecided, never a
made-up default.
