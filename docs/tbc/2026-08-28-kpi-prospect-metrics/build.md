# BUILD — Follow-up rate + Sales cycle from client_label

### Prospect identity from the label reps already enter
- write-path: `compute.ts prospectKeyOf` normalizes client_label (trim + lowercase + collapse whitespace) → the
  prospect key; "" for blank/non-string (excluded). ONE normalizer so /me and any future /team group identically.
- read-path: same customer labelled two ways that normalize equal → one prospect; a blank label → not a prospect.

### Follow-up rate + Sales cycle
- write-path: `compute.ts` — `followUpRate` (distinct prospects re-contacted ÷ total; gate ≥ MIN_SESSIONS
  prospects) + `salesCycleLengthDays` (avg first→sold days over sold prospects; gate ≥ MIN_SESSIONS sold prospects).
- read-path: `me/route.ts` builds `prospectRows` from the sessions ALREADY fetched (client_label/started_at/outcome)
  — no new read — and sets the two metrics. `kpi/page.tsx` drops `blocked` on both tiles and wires their apiKeys;
  a `days` format renders the cycle.

### Honesty (§3.4)
- write-path: both gate to "building" below MIN_SESSIONS; sales cycle counts only sold prospects.
- read-path: the tile notes say "by name" / "by prospect" (a label-based proxy, not a precise CRM count); thin
  data reads "building", never a fabricated number.

## Files
- `src/lib/coach/kpi/compute.ts` — prospectKeyOf + followUpRate + salesCycleLengthDays + ProspectSessionInput
- `src/app/api/coach/kpi/me/route.ts` — build prospectRows from the existing session read, set the 2 metrics
- `src/app/dashboard/sales-coach/kpi/page.tsx` — un-block the 2 tiles, wire apiKeys, add the `days` format
- `src/lib/coach/kpi/__tests__/compute.test.ts` — +5 cases (normalizer, follow-up + gate, sales-cycle + gate)

## Ripple (§6 item 5)
- Pure additions over data the me route already selects; no schema, no new query, no capture UX. The 2 tiles move
  from `blocked` to wired — the honesty relabel from part 4 is now superseded by a real metric.
- The `days` Fmt is additive (existing formats unchanged). The team roster is NOT touched (these are /me tiles;
  surfacing them to the roster is a separate optional scope, like the objections/uptake roster columns).

## Honest limit (verify)
- client_label is a FREE-TEXT proxy: variant spellings undercount re-contact, duplicate names overcount. Real and
  useful (verified live), but not an exact prospect id — a dedicated prospect entity remains the precise path if
  the fuzziness ever matters.
- Sales cycle is honestly THIN: most reps have <5 session-sold prospects (session sells skew same-visit), so it
  reads "building" for them; Moses (0.1d) shows it computes. Follow-up rate is live for all active reps.
