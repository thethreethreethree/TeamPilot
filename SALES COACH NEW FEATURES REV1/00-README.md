# Sales Coach — New Features REV1 (web → native catch-up)

**Purpose.** The web Sales Coach shipped a run of new features on **Sep 9–10, 2026**. This folder specs each one
for the **native (Expo) app** so the app version is consistent with the main system. The app reuses the **same
Supabase backend**, so most of the data model, scoring, and endpoints already exist server-side — for those, the
app **reads an existing endpoint and renders the UI**. A few features do **client-side capture** (audio timing,
voice enrollment) that the web does in the browser and the app must do **natively**; those docs call it out.

> **Mirror the web, do not re-derive.** Source of truth is the web repo (`TeamPilot`). Each doc names the exact
> web files / endpoints / migrations. Match the behavior and the contracts; don't invent new ones.

---

## The features (one doc each)

| # | Doc | What it is | App work |
|---|-----|------------|----------|
| 1 | `01-process-breakdown.md` | Per-phase ratings (intro/discovery/consultation/close) + tips in Coach Assessment | Render an existing endpoint |
| 2 | `02-custom-date-range.md` | Custom from/to date range on the "Today's Metrics" door KPIs | Add a range picker; existing endpoint gains params |
| 3 | `03-admin-transcript.md` | Manager can open any rep's session and read the full speaker-labeled transcript | Render a new endpoint (RLS-gated) |
| 4 | `04-speed-of-speech.md` | The "speed"/pace skill — **client captures per-turn timing** the tempo is computed from | **Native**: stamp each turn's spoken time during capture |
| 5 | `05-voice-enrollment.md` | Mandatory one-time voice enrollment (a pitch reference, not audio) that sharpens speaker attribution | **Native**: mic capture + F0 (pitch) detection |
| 6 | `06-door-home-screen.md` | The new door-tracker home: three done/target dials + AI door target + "Earned today $" cash box, as a **swipeable** 2-page pager | New screen + a manager goal UI ($/sale) |
| 7 | `07-meeting-review-pdf.md` | Meeting-review "Export PDF" that produces a real, **iOS-safe** downloadable PDF | Native share/save of a generated PDF |
| 8 | `08-one-sided-status.md` | An honest "One-sided" status when a session's rep audio wasn't captured | Render a new list field |

---

## Architecture decisions (do not re-litigate)

1. **Shared Supabase backend.** The migrations + endpoints below are already live on the same project the app
   authenticates against. The app is a client of them; it does not re-implement scoring, ratios, or storage.
2. **RLS is the access control.** Every read/write goes through the **caller's** authenticated Supabase client
   (the rep's own token), never a service role. A rep sees only their own; a same-company manager sees the team
   (the exact predicate: `profiles.role in ('CEO','COO','admin') OR sales_coach_role = 'admin'`).
3. **Honest empty states (§3.4).** Never render a fabricated `0` for a failed load — show `—` / "building" /
   "not enough yet". Several features degrade to an explicit "not available yet" until their migration rolls out.
4. **No em/en dashes in rep-facing generated copy** (house style) — applies if the app generates any text.
5. **Design system** — the app already mirrors the web's tokens (see `SALES-COACH-DASHBOARD-REPLICATION-SPEC.md`
   §Design): zinc ink neutrals + the **ember** gold accent, `text-primary/secondary/muted`, tabular figures on
   numbers. Note: the app's `--ember-400` is **`#FACC15`** — the SAME hex as Tailwind's yellow-400 — so a mockup
   sampled as "yellow-400" and the app's "ember" are the same colour. Each doc names the accent where relevant.

## Migrations these features rely on (already in the web repo `supabase/migrations/`)
- `0246` — voice enrollment (`profiles.voice_f0_hz`, `voice_enrolled_at`). Doc 5.
- `0247` — door home screen (`rep_daily_sales_goal`, `rep_day_target`). Doc 6.
- `0248` — door cash box: `rep_daily_sales_goal.sale_value_cents` (manager-set $-per-sale, nullable). Doc 6.
- Speed-of-speech (doc 4) uses the existing `coaching_transcript_segments.spoken_at` — no new migration, but the
  app must START WRITING it.
- Process breakdown (doc 1) stores in `after_pitch_summaries.payload.processBreakdown` — no schema change.

## How to use these docs
Build in this order for fastest value: **4 → 5 → 6** (the native-capture + new-screen work the shared backend
can't do for you), then **1, 2, 3, 8** (render-only), then **7**. Each doc is self-contained.
