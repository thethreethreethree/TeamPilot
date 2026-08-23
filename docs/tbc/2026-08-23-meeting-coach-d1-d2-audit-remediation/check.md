# CHECK — Meeting Coach D1 (huddle agenda-aware) + D2 (doc-upload hardening)

## Gate — the canonical command (A38)

```
$ npm run check
  (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test)
  Invariant audit: Files scanned 950 · Violations 0 (incl. "every upload route validated")
  Test Files  567 passed | 1 skipped (568)
       Tests  3720 passed | 15 skipped (3735)
EXIT: 0
```

(+12 vs the prior 3708: D1 huddleAgenda +5, D2 doc-route +3, D2 extractImageText +4.)

## What the tests prove
- **D1:** `parseHuddleCue` delivers an `uncovered_topic` cue (now valid huddle vocab) and parses `covered` point
  ids even on a silent pass; `buildHuddleCueUserMessage` renders the agenda block when present and omits it
  entirely for a prep-less huddle (no regression), and mentions `uncovered_topic` in the wrap note only with an
  agenda.
- **D2:** the doc route BLOCKS an `image/svg+xml` at the chokepoint even though `classifyKind` classes it "image"
  (proves the route routes through the real `validateUploadCandidate`, not its own weaker allowlist); confirm 400s
  a phantom path and 413s a real-size-over-cap object WITHOUT buffering it; `extractImageText` refuses an
  over-`MAX_IMAGE_PIXELS` image before any Tesseract call and stays graceful (returns "") on an unreadable header
  or an OCR throw.

## Honest limit
The LLM's actual in-context behaviour (does the huddle model emit `uncovered_topic` at the right moment; does it
echo the short point ids) is exercised at go-live on a real prepped huddle — the deterministic plumbing (forward,
render, parse, deliver, persist) is fully unit-covered. D2's chokepoint + image-bomb guards are exercised by the
detection tests above against the REAL `validateUploadCandidate` and mocked `sharp`/`tesseract` control flow.

## Findings
No findings.
