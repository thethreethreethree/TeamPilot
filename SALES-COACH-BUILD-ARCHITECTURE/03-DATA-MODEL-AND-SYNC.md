# 03 — Data Model & Sync

The real backend tables the app reads, and how sync works. Columns grounded in the migrations cited.

## The tables (owned by the rep, scoped to the company)

### `coaching_sessions` — the spine
`0070` + `0077` + `0205` + `0210` + `0237`. One row per coaching session.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `company_id` | uuid | tenant scope → `companies` |
| `agent_id` | uuid | **owner** (the rep) → `profiles` |
| `context` | text | `in_person` \| `video` |
| `client_label` | text | session title (required at create) |
| `status` | text | `active` \| `ended` \| `reviewed` |
| `session_kind` | text | `sales` \| `meeting` \| `huddle` (0237) |
| `audio_asset_url` | text | pointer into `assets-v1` |
| `audio_duration_seconds` | int | true audio length (0210) — the trustworthy duration |
| `territory` / `approach` / `offer` | text | WHERE / HOW / WHAT (0077) |
| `outcome` | text | `sold` \| `follow_up` \| `no_sale` \| `no_contact` \| `undecided` |
| `deal_value` | numeric(14,2) | **decimal currency** dollars.cents, e.g. `1500.00` — NOT integer cents (0205). May arrive as a string from PostgREST; coerce with `Number()`, don't divide by 100 |
| `started_at` / `ended_at` / `created_at` | timestamptz | |

### Append-only children
- **`coaching_transcript_segments`** — `speaker` (`agent`/`customer`/`unknown`), `text`, `seq`, `source`, `spoken_at`.
- **`coaching_cues`** — the in-call suggestions delivered: `mode`, `text`, `trigger`, `latency_ms`, `delivered_at`.
- **`coaching_cue_outcomes`** — did the rep use a cue: `determination` (`followed`/`partial`/`ignored`), `source`.
- **`after_pitch_summaries`** — rep-private JSON `payload` (`moments`, `narrative`, `scores`, `cueOutcomes`, `focus`).

> Append-only means the app **inserts, never updates/deletes** these — history stays intact (the backend enforces
> it with rules; the app must not assume it can edit the past). TypeScript shapes: `inject/src/types/backend.ts`.

## RLS — why direct reads are safe with no endpoint

The SELECT policies (migrations `0082`/`0084`, and `0080` for the private tables) resolve to:

- **`coaching_sessions`** — visible to the **owner** (`agent_id = auth.uid()`) OR a **company admin / sales-coach
  manager** of the same company.
- **transcript / cues** — mirror the session's visibility (owner or manager).
- **`coaching_cue_outcomes` / `after_pitch_summaries`** — **owner-only** (managers get a scores-stripped copy
  *only* through the API route, never by direct read).

So `supabase.from("coaching_sessions").select("*")` with the user's session returns exactly their rows — the same
data the web shows — and a foreign id returns *nothing*, not someone else's row. That is the whole safety
argument for the direct-read sync path; it needs no new endpoint. Reader: `inject/src/lib/sync/sessions.ts`.

## Sync model (V3 §9 freshness, adapted for a server-backed app)

Because this app is a **justified server-backed exception** to on-device-first (see `08`), sync is
**server-truth-with-a-local-cache**, not local-truth:

1. **Stale-while-revalidate reads.** Show the cached list instantly, refetch from Supabase in the background,
   reconcile. Never present a stale number as live.
2. **Realtime (enhancement, not baseline).** `subscribeMySessions()` pushes new rows — but only if
   `coaching_sessions` is in the `supabase_realtime` publication, which **no migration currently adds**, so it is
   very likely OFF today (the subscription connects but never fires). Enable it once (Dashboard → Database →
   Replication, or `alter publication supabase_realtime add table public.coaching_sessions;`) to turn it on. Until
   then, **polling (item 1) is the reliable path** — don't present realtime as guaranteed live. Same RLS applies
   to the stream when enabled.
3. **Writes that are plain inserts** (a rep marking an outcome the RLS lets them write) can go direct; **writes
   that trigger server logic** (AI, transcription, event emission) go through the routes.
4. **Offline outbox (Phase 4).** When you add offline capture, queue writes in a durable, ordered outbox
   (`expo-sqlite`) that replays on reconnect and reconciles against the server's answer — surface a conflict
   rather than silently dropping one side (V3 §9). Until then, the app is online-first for writes; label any
   cached data with its "last updated" time rather than implying it's live.

## What the app should compute vs. fetch

- **Fetch, don't compute: KPIs.** The KPI math lives in `src/lib/coach/kpi/compute.ts` on the server and is the
  single source of truth (it recently absorbed a real duration-outlier fix). The app calls
  `/api/coach/kpi/me?scope=self|company` (after the Phase-2 shim), never re-implements the formula. A second copy
  is exactly the drift bug §2.2 exists to prevent.
- **Fetch, don't compute: AI + transcription.** Server-owned prompts + metered calls.
- **Compute locally: pure presentation** — grouping a rep's own already-fetched sessions by day, formatting, etc.
