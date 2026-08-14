---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T09:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 1
---

# THINK — live-STT token mint: classify a CAPACITY rejection honestly (concurrency hardening)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Cited amendments read in
ThinkerThinker.md this session; CLAUDE.md §§ in-context.

## 2. Why (founder concurrency question 2026-08-14, traced against the code)
Founder: "will it cause failure if we have multiple agents using the system at the same time?" The app scales
(stateless serverless), but the shared ElevenLabs account has limits. `mintRealtimeSttToken` throws a plain
`Error` whose HTTP status is only buried in the message; the `/realtime-token` route catches EVERY failure and
returns ONE generic 502. So under concurrent load a 429 (too many token requests AT ONCE — transient, retrying
works) reads identically to a 402/403 account limit (retrying won't help) and to a config error. A rep in a busy
hour can't tell "wait a few seconds" from "this is broken" — an honesty gap (§3.4) on the exact concurrency path
the founder asked about.

## 3. The fix
- `mintRealtimeSttToken` attaches the HTTP `status` to the thrown error (was message-only).
- `/realtime-token` classifies: 429 → 503 `{retryable:true}` "busy — too many sessions starting at once, try
  again"; 402/403 → 502 `{retryable:false}` "temporarily unavailable on this account"; else → the generic
  couldn't-start. EVERY branch still points at the Upload-recording fallback (no lost transcript).

## 4. Interconnections traced (§1.5)
- This is the TOKEN-MINT (rate-limit) side of concurrency. The CONCURRENT-STREAM limit is enforced when the
  browser opens the ElevenLabs websocket WITH the token — a DIFFERENT layer (the client). Hardening that
  (detect a wss capacity rejection → surface loudly so a session can't silently capture nothing) is flagged as
  the next piece: it touches the delicate live-coaching client AND needs the real provider wss-rejection shape,
  which I will not guess (§5). Out of scope here, on the record.
- The success path + auth gate + the Upload fallback are unchanged; only the ERROR classification is added.
- `retryable` is additive — existing callers ignore it; a future client can auto-retry a 503 with backoff.

## 5. Hypothesis (§1.5.2)
- **H1 — does a 429 mint failure now return a distinct retryable 503, and 402/403 a non-retryable 502?** Yes,
  locked by the route test (429 → 503 retryable "busy"; 402/403 → 502 not-retryable; unclassified → 502 generic
  pointing at upload; success → 200 + token).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T09:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the concurrency path from the record — read the route + the provider throw before changing the failure handling.", "how_this_build_will_embody_it": "Read realtime-token + mintRealtimeSttToken; found the status was message-only + the route collapsed all failures to one message." },
  { "id": "§0.1", "read_at": "2026-08-14T09:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T09:01:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — the honest distinction (transient 429 vs account 402/403) exists in the provider status; surface it rather than inventing new signals.", "how_this_build_will_embody_it": "Classified on the real HTTP status the provider returns, attached to the error." },
  { "id": "§1.5", "read_at": "2026-08-14T09:01:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the token-mint layer is only HALF the concurrency story; the concurrent-stream (wss) layer is separate + must not be conflated or half-fixed by guessing.", "how_this_build_will_embody_it": "Section 4 scopes the wss layer OUT explicitly, flagged for a founder-gated follow-up." },
  { "id": "§1.5.1", "read_at": "2026-08-14T09:02:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2/4 — a rep must be able to ACT on the failure (retry vs upload); a generic message strands them.", "how_this_build_will_embody_it": "Each branch tells the rep what to do (wait+retry / upload); retryable flag enables an auto-retry later." },
  { "id": "§1.5.2", "read_at": "2026-08-14T09:02:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: the generic-message gap was hypothesised from the concurrency question, CONFIRMED by reading the route/throw before fixing.", "how_this_build_will_embody_it": "H1 gated by the route test." },
  { "id": "§3.4", "read_at": "2026-08-14T09:03:00Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty — collapsing a transient capacity blip and a hard account limit into one message misrepresents the state; the surface should name the real cause.", "how_this_build_will_embody_it": "429 says 'busy, retry'; 402/403 says 'account limit'; neither pretends to be the other." },
  { "id": "§5", "read_at": "2026-08-14T09:03:15Z", "source_file": "CLAUDE.md", "line_range": "300-330", "why_it_governs": "The biggest risk is the builder under pressure — under a 'fix concurrency now' push, guessing the provider's wss-rejection shape would be a confident speculative fix; distrust the fast answer.", "how_this_build_will_embody_it": "Fixed only the non-speculative token-mint status classification; scoped the wss stream layer OUT rather than guess its rejection format." },
  { "id": "§6", "read_at": "2026-08-14T09:03:30Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (the wss layer, the success/auth paths, the callers of the response shape).", "how_this_build_will_embody_it": "All enumerated in Section 4." },
  { "id": "A19", "read_at": "2026-08-14T09:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read the route + the provider mint fn + the client status handling before editing." },
  { "id": "A22", "read_at": "2026-08-14T09:04:30Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T09:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "A finding is one instance of a class — but the class (provider capacity under concurrency) has a second instance (the wss stream limit) that needs its own fix; don't force one mechanism onto both.", "how_this_build_will_embody_it": "Fixed the token-mint instance non-speculatively; flagged the wss instance for a dedicated, founder-gated build." },
  { "id": "A30", "read_at": "2026-08-14T09:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "The route test locks the 429→503-retryable / 402-403→502 / generic classification; regressing to one message reddens CI." },
  { "id": "A38", "read_at": "2026-08-14T09:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0." }
]
```
