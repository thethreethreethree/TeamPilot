# CLOSURE - the AI provider's raw reply reached users

## What is true now

When an AI call fails, a user reads a sentence we wrote, such as "The AI service is unavailable on our side
right now". The provider's raw reply goes to the server log. A rep whose pitch failed reads why in plain
words, not "DeepSeek API error 402". The CWE-209 gate now covers the surface it had been told to ignore.

## The finding

An exemption is a claim. INVARIANT 14 skipped `{ error: err.message, kind }` because that surface was
"curated", and nobody checked what built the message. The gate passed for two months over the exact
thing it exists to catch.

## Residual

```json
[
  {
    "id": "R1-other-error-columns",
    "item": "Other job tables that store exception text in an error column were not traced to every reader.",
    "why_skipped": "The sweep pattern is in check.md; pitches.error was the one observed reaching a screen.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-30T07:20:00Z",
    "outcome": "CLOSED 2026-09-30. grep of every migration for an error-like text/jsonb/varchar column finds exactly one: pitches.error (0215_macro_mode_door_log_report_card.sql:52), the column this build fixed. There is no second table of this class."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
