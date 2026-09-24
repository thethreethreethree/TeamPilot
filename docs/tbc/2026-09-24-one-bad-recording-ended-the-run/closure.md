# CLOSURE — one bad recording ended the run

## What is true now

`scoreSession` cannot throw. The drain steps past recordings that can never be scored, stops itself
on the clock rather than being killed by the platform, and the panel names the failure when there
is one.

`npm run check` → **5522 passed, 15 skipped, CHECK_EXIT=0**. `npm run build:ci` → "✅ Secretless
build PASSED".

## What I got wrong

I reported the scoring pipeline as fixed this morning. It was built, it deployed, its contract was
tested — and it died on the first recording that threw.

`scoreSession` returned a verdict for every decision it MADE: a huddle, no rep speech, guidance
off. Everything it did not decide — a provider error, a rate limit, a malformed transcript — left
as an exception. The drain calls it in a bare loop, so the first throw took the whole POST down.

**One recording in 194 ended the run.** A full drain needs about 25 consecutive clean passes at
`BATCH = 8`, and I shipped it having never run it against a real backlog.

Then the panel printed "Scoring stopped because the request failed" and discarded both the status
and the server's own sentence. The route returns `{ error }` on every failure path and the client
read neither. **That is the part I am least willing to excuse**: the outage cost a morning; the
silent message cost the diagnosis. The founder sat in front of a screen that knew what had happened
and would not say it.

## The method note worth keeping

The screenshot eliminated a whole class of causes before any code was read. **194 rendered** — and
`GET` and `POST` share the same `gate()`. So the auth, the company resolution and the manager check
all passed milliseconds before the POST failed. Permissions were impossible, not unlikely.

A screenshot is not only a symptom. It is a list of things that must have worked.

## And a bug I wrote while fixing the bug

My first replacement for `more: scored > 0` was `more: attempted > 0`. That would have looped
forever, re-billing the same eight gradings on every pass — worse than the defect it replaced.
Caught by working the arithmetic on paper before running it, not by a test.

Recorded because the fix for a live outage is exactly where that kind of error is most likely and
least affordable.

## Residual

```json
[
  {
    "id": "R1-not-run-against-the-real-backlog",
    "item": "Everything here is verified by tests with injected failures, a green gate and a passing secretless build. It has not scored a single real recording.",
    "why_skipped": "I have no access to the production database or its logs.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T11:05:00Z",
    "outcome": "OPEN, and it is the whole question. 'Press the button and it drains' is INFERRED and stays inferred until the founder presses it. What I can promise is narrower and now true: a failure will name itself on the screen instead of saying the request failed."
  },
  {
    "id": "R2-attempted-at-column-is-the-real-fix",
    "item": "The cursor is a per-run workaround. An `attempted_at` column on the candidate query would exclude what has already been tried, survive across sessions and page loads, and make the cursor unnecessary.",
    "why_skipped": "It is a migration, and a partner was blocked on a hotfix.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-24T11:05:00Z",
    "outcome": "OPEN as the proper fix. The cursor resets to 0 every time the manager reloads the page, so a backlog with many unscorable recordings at its head still re-walks them once per session — cheap (they refuse without an LLM call in most cases) but not free."
  },
  {
    "id": "R3-the-authority-shipped-without-its-own-tests",
    "item": "`scoreSession.ts` was created this morning as the single authority and had no test file until this build. Its callers' tests mock it, so they proved the callers handle outcomes and nothing about what it does when a read fails.",
    "why_skipped": "Nothing skipped it — it was not written.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T11:05:00Z",
    "outcome": "CLOSED for this module (six tests, all failing without the guard), OPEN as a habit. A mocked dependency is a dependency nobody has tested, and every drain test was green while the thing they mocked was the thing that broke."
  },
  {
    "id": "R4-the-founder-reported-several-errors-and-i-have-evidence-for-one",
    "item": "\"you have made several terrible errors\" — I have a screenshot for the backfill and nothing for the rest.",
    "why_skipped": "I asked rather than guessed, and he chose to have this pushed first.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-24T11:05:00Z",
    "outcome": "OPEN and it is the next thing. Twelve commits today touched shared surfaces — the deck kit, the Tailwind config, theme tokens across ~20 files. If any of those broke the live look, the evidence is on his screen and not in my captures."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Two images were opened and described: the founder's screenshot of the Coach Assessment backlog
panel (the 194 count, the "Score them all" button, and the failure sentence) and his screenshot of
the WhatsApp thread from "~ John Knudtson +1 (951) 390-0611" at 11:41 reading "It's looking good!"
and "Once it updates with past recordings I'll be able to have some morne geedback".

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, six Sales Coach routes,
and whatever the founder is looking at that I have not seen.
