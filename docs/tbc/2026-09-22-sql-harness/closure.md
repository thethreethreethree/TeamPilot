# CLOSURE — the gap three builds in a row have asked for

## What is true now

Three claims that rested on a mock now rest on an execution, and they run in the gate in 0.19
seconds.

They are the three residuals filed separately today by 0264, the Files build and the
department-assign build — each of which wrote, in its own words, that the thing it had just shipped
could not be checked. Three builds naming the same missing capability is the class surfacing; this
is its home.

## The shape worth remembering

**Two of the three subjects are things a static gate already "covers".**

`rls:audit` checks that a view's migration TEXT says `security_invoker = true`. It reports success whether
or not the view in the database still has it — and a later `create or replace view` drops that
setting silently, because the option is not part of the view's definition. A30's own incident is
19 views that read across the tenant boundary for exactly that reason, one of them exposing every
tenant's taxpayer IDs.

So the harness's value is not "tests the database". It is that **a text check and an execution
check fail on different days**, and the gap between them is where a correct-looking migration lives.

## What I got wrong, and it was said five times

I have called this the "twelve-step gate" all session. It was **eleven**. The claim appears in five
build records, each as a statement of fact, and adding `sql:harness` today made it twelve — so the
sentence became true after being wrong every time it was written.

All five corrected in place, saying so. A number that becomes right later was still wrong, and
letting the new count ratify the old claim would be the quieter and worse repair.

## Residual

```json
[
  {
    "id": "R1-the-embed-claim-is-not-actually-closed",
    "item": "`listFiles`' `!inner` embed was one of the three residuals this harness was built for, and the harness does not check it. The embed is a PostgREST construction; this harness talks to Postgres.",
    "why_skipped": "PostgREST is not running here and standing one up is a different build.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T18:19:30+08:00",
    "outcome": "OPENED, AND THE CONFIDENCE WAS WRONG — this is the one subject of three that I did NOT close, and the build record would have read as though I had. What CAN be checked without PostgREST is the SQL the embed compiles to: an inner join between `files` and `file_tasks` filtered on `task_id`, asserting a file with no matching join row is absent. That is a real check of the semantics the embed depends on, and it is not the same as checking the embed string parses. Neither is done. Stated plainly because 'three residuals, three claims' is a tidier sentence than the truth, and the tidier sentence is the one I nearly shipped."
  },
  {
    "id": "R2-the-harness-has-no-subject-that-tests-the-harness",
    "item": "Eight tests cover the skip path, the staleness key and isolation. None asserts that a claim which SHOULD fail does fail — that was done by hand, by breaking the view.",
    "why_skipped": "A self-test would need the harness to run a deliberately-failing claim, which means shipping a failing claim.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T18:19:30+08:00",
    "outcome": "OPEN, and the mitigation is weaker than the audits'. `writer:audit` and `reachability:audit` each plant a violation and assert it is caught, in-process, on every run — 'a gate that cannot fail is a pass with extra steps'. This harness cannot do that cheaply: planting a violation means writing to the database, and asserting the detector detects means running a claim that fails. The hand probe (breaking the view, watching two claims fail with their own messages) is real evidence and it is not repeated automatically. The honest version: this gate's detector was exercised once, by hand, today."
  },
  {
    "id": "R3-credentials",
    "item": "The harness needs PGUSER/PGPASSWORD to reach the local container. CI has none set for it yet, so it will skip there.",
    "why_skipped": "Setting CI secrets is outside the repository.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T18:19:30+08:00",
    "outcome": "OPEN, and it is a §1.5.3 external-config dependency — the class that clause exists for. The mitigation is that the skip is LOUD: it exits 0, prints THIS IS NOT A PASS, and names each unchecked claim by its database object. So a CI run that skips is visible in the log rather than silent. Until the credentials are set, this gate protects a developer running it locally and nobody else, and that is the difference between built and working."
  },
  {
    "id": "R4-three-subjects-is-a-small-number",
    "item": "The schema has 153 tables, 322 policies and many views. This harness checks one view, one option on it, and one policy.",
    "why_skipped": "A30: a gate must be precise or not exist. Three subjects were named by three builds; the rest is speculation.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T18:19:30+08:00",
    "outcome": "DELIBERATE, and the growth rule is worth stating so it is not left to taste: a claim earns a place here when a build closes with a residual saying it cannot be checked. That is how these three arrived. Adding subjects speculatively would produce a slow gate full of assertions nobody was worried about, and the first one to break would be re-run rather than read."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Nothing in this build has a visual surface.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser.
