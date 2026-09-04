# CHECK — recording retention and deletion on the privacy page

Audited against the built file (§3.3.1), not against what I meant to write.

## Canonical gate — `npm run check` (A38)

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  618 passed | 1 skipped (619)
      Tests  4075 passed | 15 skipped (4090)
exit: 0
```

Run before the TBC docs existed, when `tbc:freshness` correctly **refused the commit** — the change touched an
enforced path with no build directory. That refusal is recorded here rather than quietly satisfied, because it is
the gate doing exactly what A30 asks of one: it failed without my cooperation.

## The claims, each checked against the file that implements it

| The page now says | Implemented by | Verified |
| --- | --- | --- |
| Twenty most recent per representative | `recording-purge-cron/route.ts:24` `KEEP_PER_REP = 20` | read today |
| A job runs every night | `vercel.json` — `30 3 * * *` | read today |
| Older audio deleted, transcript and score kept | same route `:17`, and the update nulls `audio_asset_url` only | read today |
| Save exempts a recording | `:60` filters `recording_saved = false`; `save-recording/route.ts` sets it | read today |
| A representative can save their own | `save-recording/route.ts:16` — the owning rep OR a manager | read today |
| No delete control for anyone | no `DELETE` handler under `src/app/api/coach/sales-session/` | swept, below |

## Class sweep (§3.3.3 / A26)

**The class is not "the policy lacked a retention paragraph".** That is the symptom. The root shape is:

> **a public-facing statement about how the system behaves, asserted without opening the file that implements it.**

That is what produced the note this build removes — I wrote "cannot be read out of the code" about a cron that had
been running for nine days.

```
grep -rn -i "delete|retain|retention|purge|how long" src/app/privacy/page.tsx src/app/terms/page.tsx
ls src/app/privacy src/app/terms          # the only two public policy pages
grep -rln "DELETE" src/app/api/coach/sales-session   # one hit, a test filename
```

| Public statement | Backed by | State |
| --- | --- | --- |
| privacy — recording retention | the purge cron | **fixed here** |
| privacy — recording deletion | the absence of any endpoint | **fixed here** |
| privacy — "append-only, we append corrections" (`:325`) | the append-only event chain | pre-existing, unchanged, and about a different subsystem |
| privacy — "data we discover we have, we delete it" (`:406`) | a human process, not code | pre-existing; a promise about conduct, not a claim about a mechanism |
| terms — "we never quietly mutate or delete" (`:96`) | the same event chain | pre-existing, consistent with the above |

No further instance of the class in the public pages. The two pre-existing statements are about the append-only
event chain and were correct before this change and after it.

## Cross-module pass (§3.3.2 / A21)

The concept is **"how long a recording lives"**, which exists under different names in four places:

| Surface | Says | Agrees? |
| --- | --- | --- |
| `recording-purge-cron` | twenty per rep, saved exempt | the source of truth |
| `care/rcd/retention-cron` | a different subsystem's own retention | unrelated; does not touch `coaching_sessions` audio |
| mobile `APP-STORE-SUBMISSION.md`, its policy and retention sections | the same rule, plus the twelve-month recommendation marked as NOT built | updated today to match |
| mobile `recording-url.ts` header | audio outlives the upload so a rep can listen back | consistent — it is why retention is longer than analysis |

The two-repo risk is real and is worth naming: the mobile submission notes now restate the web's retention rule by
hand. If `KEEP_PER_REP` changes, nothing makes the app's document follow it.

## Gate-the-lesson (§3.3.4 / A30) — answered honestly

**Is this fix a gate or a promise? It is a PROMISE, and I am not going to dress it as a gate.**

What would have to be true for it to come back: someone changes `KEEP_PER_REP`, or ships a delete endpoint, and
does not edit the privacy page. Nothing mechanical notices.

I considered a check that greps the policy for "twenty" whenever the cron changes. **I am not adding it, and A33
is the reason:** it would fire on any edit to a 500-line route for a paragraph that might legitimately be
unaffected, and would pass happily if someone wrote "thirty" in both places wrongly. A gate that cries wolf is one
people learn to skip. The precise version of this check is "does the policy describe the system", which is not
mechanically decidable.

**What is actually load-bearing here is the file header**, which now records that the earlier claim was made
without reading the code. That is prose, deliberately, and it is chosen rather than settled for.

## Inspected and NOT clean-billed (§3.3.5)

**Inspected:** the purge cron, the save-recording route, `vercel.json`, both public policy pages, and the committed
JSX of the changed section.

**Not inspected:** the page as a browser renders it. This is JSX inside an existing `<Section>`/`<ul>`, and the
gate proves it compiles and that 4,075 tests pass — neither of which proves a reader can read it. Residual, not a
pass.

## Findings

### F1 — the policy carried a claim about the codebase that was false

class: a public statement about system behaviour asserted without opening the implementing file.
sweep: the commands above, across both public policy pages.
severity: high — it is a legal document, it was published, and Apple cross-checks it against an App Privacy
  declaration of Audio Data.

### F2 — the founder's stated policy and the running system disagree, in the founder's blind spot

class: an intent described in conversation, never checked against the code that would implement it.
sweep: the authorisation branch in `save-recording/route.ts`, and the absence of any delete route.
severity: medium for the page (which states behaviour, so it is correct), high as a fact the founder does not have —
  they believe representatives cannot exempt their own recordings, and today they can.
