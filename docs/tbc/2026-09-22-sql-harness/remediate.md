# REMEDIATE — the gap three builds in a row have asked for

### The "twelve-step gate" that was eleven steps

gate-or-promise: promise

Written five times, in five build records, each as a statement of fact. Corrected in all five,
saying what it was and that adding `sql:harness` made the number true afterwards.

**Why a promise and not a gate.** A check that the prose in `docs/tbc/**/check.md` matches
`package.json`'s script list is buildable and is the wrong trade. It would fire on every legitimate
rewording, it would need the count expressed in a parseable form, and the thing it protects against
is a number in a document nobody makes decisions from. The gate would cost more attention than the
error ever did.

What actually catches this class is the habit the whole session runs on: count the thing rather
than recall it. The number came from memory five times and from `split("&&").length` once, and the
once is when it was found.

### Credentials, and a gate that only protects one machine

gate-or-promise: promise

The harness needs `PGUSER` / `PGPASSWORD` to reach Postgres. CI has none set for it, so it skips
there — loudly, but it skips.

That makes this a §1.5.3 external-config dependency: correct code, green build, and the precondition
unmet. The clause allows two discharges — verify end-to-end, or document as a blocking setup step
AND surface it to the founder. This is the second:

**Blocking setup step.** For `sql:harness` to run in CI, the workflow needs a Postgres service and
these set in its environment:

```
PGHOST=localhost   PGPORT=5432   PGUSER=<role>   PGPASSWORD=<secret>
```

Locally with the existing container, the values are the ones the container was started with:
`PGUSER=ics`, and its `POSTGRES_PASSWORD`.

**Verification procedure:** `npm run sql:harness` prints either three ✓ lines or a banner
containing `THIS IS NOT A PASS`. There is no third state, and no way to read one for the other.

Until that is set, this gate protects a developer running it locally and nobody else — which is the
difference between built and working, and is why it is on the record rather than assumed.

### The embed claim, which is not closed

gate-or-promise: declined

One of the three residuals that motivated this harness — `listFiles`' `!inner` embed — is **not
checked by it**. The embed is a PostgREST construction and this harness talks to Postgres.

Declined rather than promised, because the honest options are both worse than saying so:

- Standing up PostgREST in the gate is a different build, with its own container, its own
  configuration and its own skip path.
- Checking "the SQL the embed compiles to" is a real and useful claim — an inner join between
  `files` and `file_tasks` on `task_id`, asserting a file with no matching join row is absent — but
  it is **not** the claim the residual asked for. Adding it and calling the residual closed would
  be the tidier sentence winning over the true one.

So: two of three closed, one named as open, in the closure and here. The build record would have
read as three-for-three if I had not gone back and opened R1.
