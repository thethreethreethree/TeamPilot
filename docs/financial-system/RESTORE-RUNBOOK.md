# Restore runbook — and the honest scope of "backup and recovery"

## What we do NOT build, and why

**Backups are Supabase's**: daily snapshots on every plan, point-in-time recovery on paid plans. We do not
reimplement them. A `pg_dump` wrapper in this repo, marked "backup: BUILT", would be a worse system
pretending to be a better one — and it would be *our* worse system, unmonitored, with no restore path
anybody has ever exercised.

**Configure PITR in the Supabase dashboard.** That is an operator action, not a code change, and it is the
single highest-value thing on this page.

## What was missing — and it is the part that matters

Every company has backups. **Almost none can tell you whether a restore actually worked.**

The failure mode is not "the backup didn't exist." It is:

> The restore ran. The database came up. The app served pages. Everybody exhaled.
> And the ledger came back **subtly wrong** — a few journal lines lost their entry, a period quietly
> reopened, the audit log has a hole in it, the trial balance is out by £3.40.

Nothing announces this. The app works. The pages render. The numbers look like numbers. And the company
proceeds to file accounts, pay dividends, and make decisions on a ledger that lost its integrity at 3am on
a Tuesday, six weeks ago.

**An unverified restore is not a recovery. It is a hope with a green checkmark.**

## So: `fin_integrity_check()` (migration 0178)

Seven assertions, each one a **fact**, not a heuristic. Every one of them *should be impossible* — they are
enforced by constraints and triggers. If any ever fails, something has bypassed the database's own
guarantees.

| # | Check | Why it is the one that matters |
|---|---|---|
| 1 | The trial balance balances | If this fails, **every report in the product is wrong and none of them will say so** |
| 2 | Every entry balances *individually* | The ledger can balance while entries don't — two opposite errors cancelling. **That is worse**, because check 1 then reports perfect health |
| 3 | No orphaned journal lines | Money in the ledger belonging to no transaction |
| 4 | Closed periods contain no new activity | History rewritten after it was reported on |
| 5 | The audit trail is present | Unlike the balances, **it cannot be reconstructed from anything** |
| 6 | Approved bills have their ledger entries | An expense the P&L has never heard of — **and the books balance without it**, which is why nothing else notices |
| 7 | No future-dated postings | A common restore artifact (clock skew); silently inflates the current period |

## The procedure

1. **Restore** the snapshot (Supabase dashboard → Database → Backups).
2. **Run the check**: `/dashboard/finance/integrity`, or `select * from fin_integrity_check();`
3. **Every row must pass.** A single failure means the restore is not trustworthy — do not resume trading
   on it, and do not "fix" the ledger with a balancing entry. A balancing entry would make the *check*
   pass while leaving the *corruption* in place, which is the worst outcome available: an invisible problem
   wearing a green tick.
4. **If a check fails**, restore an earlier snapshot and check again. The corruption has a date; find the
   last snapshot before it.

## Run it on a schedule, not only after a restore

Corruption does not only arrive via restores. Running this weekly means a problem is found in **days**
rather than at year-end — when the fix is cheap rather than a restatement.

**Status:** the check is BUILT and UNTESTED (no migration applied). Scheduling is an operator step, the same
`CRON_SECRET` pattern as the other crons.
