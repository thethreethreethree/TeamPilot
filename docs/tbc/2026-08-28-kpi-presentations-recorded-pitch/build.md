# BUILD — presentations = recorded pitches

### getAllTimeKpi presentations (all-time)
- write-path: `doorlog.ts getAllTimeKpi` — presentations is now `count(pitches where rep_id=repId)` (exact/head),
  run in parallel with the paged rep_kpi_daily knocked/sold read. Dropped the now-unused `no_answer` select.
- read-path: the Coach Assessment card, the Macro dashboard "Presentation" bubble, the Door Log KPI strip, and the
  rep self-view all read `.presentations` off this one function — they now show recorded pitches.

### getTodaysMetrics conversations (period-scoped)
- write-path: `doorlog.ts getTodaysMetrics` — a 4th parallel query counts `pitches` scoped by the
  `door_knocks!inner(local_date)` join to the period window (no status filter — every recorded pitch). `conversations`
  returns that count; dropped the `no_answer` accumulation.
- read-path: the Macro "Today's Metrics" KPI trio (doors / conversations / sales) shows recorded pitches for the window.

### Honesty throw on count error (INV22 / §3.4)
- write-path: `getAllTimeKpi` / `getTodaysMetrics` — each checks the presentations-count result's `.error` and
  throws, rather than coalescing a failed count to 0.
- read-path: the door-log route / todays-metrics route surface a 5xx (client keeps its last-good strip); the KPI
  surface never renders a fabricated "0 presentations" from a transient read failure.

## Files
- `src/lib/data/doorlog.ts` — getAllTimeKpi + getTodaysMetrics presentations/conversations recomputed from pitches

## Ripple (§6 item 5)
- Every consumer already reads the RETURNED `.presentations` / `.conversations` — no consumer re-derived it from
  no_answer, so there is no second copy to drift (§2.2). Grep confirmed: `.presentations` appears only as a read of
  these functions' output (coach-assessment card + route type, Macro dashboard, a render test's mock).
- The `/kpi` page "Conversion rate = sold ÷ opportunities" is a SEPARATE system (coaching-session rows in
  `compute.ts`), untouched — the door presentations does not feed it.
- `no_answer` is still selected/summed elsewhere (getKpiForDay strip) — unaffected; only the two all-time/period
  presentations derivations changed.

## Verification (live)
`node` read-only probe against prod DB (temp script, since deleted):
- Moses: OLD presentations (knocked−no_answer)=46 → NEW (count pitches)=41 [= the founder's confirmed number];
  period 30d join-count=41 (the embedded-inner head:count WORKS via PostgREST).
- Johns: OLD=3 → NEW=3.
