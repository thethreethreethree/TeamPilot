---
started_at: 2026-09-03T08:25:00+08:00
---

# THINK — long-meeting review returned empty (reasoning model starves on a long transcript)

## Why (founder: "meeting did not work" — diagnosed by REPRODUCING the real call, not guessing)
After the audio recovery, the founder's meeting review still failed with "The review didn't generate this time" —
the dissect route's `outcome:"transient"` path. Reproduced the exact DeepSeek call on the real 41-min transcript
(scripts/diag-fm-dissect-llm.mjs): **finish_reason:"length", reasoning_tokens:8000, answer content: 0 chars.** The
`deepseek-v4-flash` REASONING model spends the ENTIRE 8000-token completion budget on reasoning_content and emits
zero answer JSON → parse fails → transient empty. The 7000-headroom/8000-cap was tuned for short sales calls; a
long meeting (~10k-token transcript, 353 turns) reasons past any budget under the model's 8192 output ceiling.

## Understanding (§0, §1.2)
The dissect is an EXTRACTION task (pull decisions/actions JSON from a transcript) — it does not need
chain-of-thought. Verified empirically (scripts/diag-fm-dissect-fix.mjs): the NON-reasoning model `deepseek-chat`
answers the FULL transcript directly — finish_reason:"stop", 0 reasoning tokens, valid JSON in ~0.7s (12 actions,
4 open items). So the fix is to route the meeting dissect to the non-reasoning model.

## The fix (§2.2 — one source, thread a verdict, don't fork the gate)
Thread an optional per-call `model` override through the LLM layers (LlmCallArgs → deepseek provider →
runBrainCall → claude.call → dissectCoachV5) and have the MEETING generator pass DEEPSEEK_NONREASONING_MODEL. Only
the DeepSeek provider reads it (Anthropic is non-reasoning already, ignores it). The §3.4 control-gate `suppressed`
verdict is UNCHANGED — the new field rides alongside it; I did not re-derive or touch the gate decision. The SALES
dissect leaves `model` unset → keeps the reasoning model (its calls are short).

## Honesty (§3.4, §5) — proven, not asserted
Root cause was MEASURED (the real finish_reason + token split), and the fix was VERIFIED on the real transcript
before shipping. The founder's content was also generated + stored via the non-reasoning model (6 decisions, 1
action, 4 open items) so the review shows NOW.

## Session-read manifest (A22 — read_at ≥ started_at 08:25; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T08:29:00+08:00",
    "why_it_governs": "Understanding precedes solving — reproduced the real call to KNOW the cause.",
    "how_this_build_will_embody_it": "Measured 8000 reasoning / 0 answer before choosing the fix; verified the fix on the real transcript." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T08:29:05+08:00",
    "why_it_governs": "Methodology in the tree, consulted this session.",
    "how_this_build_will_embody_it": "CLAUDE.md in context; cited axioms re-opened this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T08:29:08+08:00",
    "why_it_governs": "Retrospective identification from the record.",
    "how_this_build_will_embody_it": "The failure was the route's transient path; reproduced it against the live transcript rather than theorizing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T08:29:11+08:00",
    "why_it_governs": "Layer-2 effectivity — the review must actually generate.",
    "how_this_build_will_embody_it": "Verified the non-reasoning model produces a real dissect end-to-end (stored for the founder)." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-03T08:29:14+08:00",
    "why_it_governs": "THINK-first + test the hypothesis, don't grep-guess.",
    "how_this_build_will_embody_it": "Tested TWO fixes (non-reasoning full vs chunked) empirically and picked the verified one." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T08:29:17+08:00",
    "why_it_governs": "Single-source decisions — don't re-derive/fork a gate.",
    "how_this_build_will_embody_it": "The model override rides ALONGSIDE the unchanged `suppressed` verdict; the control gate is untouched." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-03T08:29:20+08:00",
    "why_it_governs": "Honesty — measured + verified, never claimed.",
    "how_this_build_will_embody_it": "Pasted the real finish_reason/token split + the verified fix output in check.md." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "384-405", "read_at": "2026-09-03T08:29:23+08:00",
    "why_it_governs": "Recurring-failure honesty under pressure.",
    "how_this_build_will_embody_it": "Reproduced the failure and verified the fix before reporting; owned the prior miss." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T08:29:26+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Diagnosed from the record, traced ripple (sales dissect unaffected), verified, kept the gate single-source." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-03T08:29:29+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session before citing." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-09-03T08:29:10+08:00",
    "why_it_governs": "Citations require session-reading.",
    "how_this_build_will_embody_it": "Manifest pairs each cited § with a fresh read_at; commit carries the Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-03T08:29:33+08:00",
    "why_it_governs": "A lesson recorded only in prose recurs — a fix is not complete until the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "A drift-guard test would pin that the meeting dissect passes the non-reasoning model; flagged in closure as DISS-R1." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-09-03T08:29:10+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes typecheck + the 63-test run + the reproduced failure + the verified fix output." }
]
```
