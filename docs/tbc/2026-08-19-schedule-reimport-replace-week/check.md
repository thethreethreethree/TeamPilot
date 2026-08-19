# Replace-the-week re-import — Check

Proactive four-layer self-audit (§1.5.2) of the just-built path.

### Finding: preview willReplace vs commit shiftsSuperseded can differ under a concurrent edit
class: preview/commit TOCTOU on an ADVISORY count — the preview reads live shifts at time T, the commit
recomputes at time T+n; if another manager adds/cancels a shift in the imported span between the two, the
warned N differs from the number actually superseded. The class is "a pre-action count derived from live
state that a concurrent writer can invalidate before the action runs."

sweep: `grep -rn "willReplace\|supersededShiftIds\|shiftsSuperseded" src/app src/lib/schedule` — every
consumer routes through the ONE supersededShiftIds function, and the COMMIT recomputes from live state inside
the same transaction as the write (it does not trust the preview's number). So the divergence is confined to
the DISPLAYED warning; no write path trusts the stale count.

severity: low (the commit is authoritative and atomic, so the write is always correct; only the pre-commit
warning can be momentarily stale, which over/under-states by the count of concurrently-edited shifts).

## Verification
`npm run check` — output + exit code in closure.md (A38). Migration applied via `npm run db:apply` with
verify:live 27/27 (also in closure.md). +6 tests (4 supersededShiftIds, 2 route).

No other findings: the RPC re-derives nothing (it applies the passed ids — §2.2); the migration is applied and
the code fail-louds (503) rather than silently appending if it were absent (§1.5.3); SHIFT_CANCELLED is
append-only (§3.1); both commit routes share one helper (no drift, §6); the span semantic is the founder's
explicit pick and is surfaced in the preview warning (§3.4).
