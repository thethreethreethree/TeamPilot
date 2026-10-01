# BUILD - the AI provider's raw reply reached users

### A failed pitch shows the rep our sentence

- **write-path:** `pitchFailureMessage()` (`src/lib/coach/doorlog/pitchFailureMessage.ts`): the worker's own
  sentences pass through; a billing refusal, a timeout, and anything else map to written sentences.
  `report-card/[pitchId]/route.ts` sends `pitchFailureMessage(pitch.error)`. The column itself is unchanged
  (operations data).
- **read-path:** `pitchFailureMessage.test.ts` (8), including the production 402 string and a source guard
  that the route has exactly one `pitch.error` and it goes through the translator.

### Every AI route sends our sentence and the kind

- **write-path:** `llmPublicMessage(err)` (`src/lib/llm/publicMessage.ts`) logs
  `[llm] provider kind status: raw` and returns one sentence per kind. 26 sites (25 routes and
  `llmErrorResponse.ts`) now send it; `provider` is dropped from all but the Settings connection check,
  where it is the point.
- **read-path:** `publicMessage.test.ts` (3): the outage's reply becomes the quota sentence and is logged; a
  missing key names no setting; no sentence names a provider or status code. `llmErrorResponse.test.ts`
  updated to the new surface.

### The CWE-209 gate stops exempting it

- **write-path:** `scripts/invariant-audit.mjs` INVARIANT 14: the `kind:` exemption removed; scans any file
  that builds a NextResponse; the ping allowlist entry removed (its non-LLM fallback now logs and sends a
  generic sentence).
- **read-path:** `npm run invariant:audit` exit 0 on the tree; exit 1 with `err.message` put back in one route,
  and again in the lib helper.
