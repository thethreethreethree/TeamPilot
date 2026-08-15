---
tbc_version: 1
trigger: feature
started_at: 2026-08-14T19:43:00Z
manifest_entries: 12
hypotheses: 2
---

# THINK - landing-sections

## Request restated
Founder scoped: after the hero and differentiator, build the remaining seven sections of the
2026-08-02 arc to the same treatment. Preview only, live homepage untouched.

## Why this problem exists
The shipped page already has all nine sections. The gap is not missing sections — it is that they
share one primitive, `Reveal` (an 8-line fade), used 42 times. The brief named scroll-triggered
motion as "most of the wow", and the eye habituates by the third repetition of the same fade.

## Session-read manifest

Provenance carried from `2026-08-15-landing-wow-hero`, where every clause and asset range below was
verified **byte-identical** to this repo's copy by per-range hash before any timestamp was written.
Nothing in those files has changed since — `tbc:docs` exits 0 on this run against the same digests.

```json
[
  { "id": "§3.4", "read_at": "2026-08-14T22:24:00Z", "source_file": "CLAUDE.md", "line_range": "332-342",
    "why_it_governs": "It is the clause the entire Proof section exists to express, and F1 violated it directly. Read only AFTER the gate demanded it, which is itself the finding recorded in closure.",
    "how_this_build_will_embody_it": "Reading it corrected the copy: the clause specifies month 1 as a CONTROL CONDITION that must not feel like surveillance, and says learning does not stop at 30 days - so 'month one, we say nothing' is right, but framing 30 days as the whole story undersells it. Noted for the copy pass." },
  { "id": "§0", "read_at": "2026-08-14T20:06:40Z", "source_file": "CLAUDE.md", "line_range": "10-20",
    "why_it_governs": "The brief was already written. Understanding here meant executing what it actually said rather than re-imagining seven sections to my own taste, which is how the first hero attempt went wrong.",
    "how_this_build_will_embody_it": "Every section's motion idea is traced in its component comment to the specific brief clause it answers." },
  { "id": "§0.1", "read_at": "2026-08-14T20:06:40Z", "source_file": "CLAUDE.md", "line_range": "22-42",
    "why_it_governs": "Forbids citing an asset not actually consulted. This manifest reuses reads from the predecessor build, so the honest move is to state that plainly and name the verification rather than re-assert fresh timestamps.",
    "how_this_build_will_embody_it": "The provenance paragraph above names the method (per-range hashing) instead of implying a second read that did not happen." },
  { "id": "§1.5.1", "read_at": "2026-08-14T20:08:00Z", "source_file": "CLAUDE.md", "line_range": "78-137",
    "why_it_governs": "Layer 2 failed again, differently: the Proof counters were structurally correct and semantically inverted. No typecheck can see a number that means the opposite of the truth.",
    "how_this_build_will_embody_it": "Verified by full-page render at 1400x5200 AND by reading the server-rendered HTML directly, not by trusting the component source." },
  { "id": "§1.5.2", "read_at": "2026-08-14T20:08:00Z", "source_file": "CLAUDE.md", "line_range": "139-172",
    "why_it_governs": "Audit the adjacent surface, not only what you changed. The counter defect was found by reading the rendered Proof section, which I was not debugging at the time.",
    "how_this_build_will_embody_it": "Two hypotheses written before building; both confirmed and carried into check.md as findings." },
  { "id": "§1.5.3", "read_at": "2026-08-14T21:02:00Z", "source_file": "CLAUDE.md", "line_range": "174-196",
    "why_it_governs": "Correctness depending on config outside the repository. Here the external dependency is the BROWSER ENGINE rather than a dashboard setting, and min(100svh, ...) drops silently on an engine that does not know svh.",
    "how_this_build_will_embody_it": "A plain-vh line now precedes the svh line, so an unsupporting engine degrades to a working value instead of losing the declaration entirely." },
  { "id": "§2.2", "read_at": "2026-08-14T21:03:00Z", "source_file": "CLAUDE.md", "line_range": "275-299",
    "why_it_governs": "Consume the verdict, never re-derive it. The Modules grid could easily have had each card computing its own dim state from hover, which is exactly the duplicated-condition drift this clause forbids.",
    "how_this_build_will_embody_it": "One `active` value is the single authority; the grid container and every card branch on it rather than each deciding independently." },
  { "id": "§6", "read_at": "2026-08-14T20:06:45Z", "source_file": "CLAUDE.md", "line_range": "402-422",
    "why_it_governs": "Item 1a asks whether the assets were read this session or recalled. Answering it honestly is why this file carries a provenance note instead of eleven freshly-minted timestamps.",
    "how_this_build_will_embody_it": "The reads are carried forward with their verification method stated on the record." },
  { "id": "A19", "read_at": "2026-08-14T20:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-476",
    "why_it_governs": "A governing document must live where the build loop encounters it. The brief sat in a chat transcript for two weeks and no build ever touched it.",
    "how_this_build_will_embody_it": "Each section's comment quotes the brief clause it answers, so the next author meets the requirement in the file rather than in scrollback." },
  { "id": "A22", "read_at": "2026-08-14T20:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-640",
    "why_it_governs": "Citation runs faster than reading, so labels accumulate while content fades. This manifest is the artifact that closes that gap for this build.",
    "how_this_build_will_embody_it": "Carried reads are labelled as carried, with the hash-verification named, rather than presented as new." },
  { "id": "A30", "read_at": "2026-08-14T20:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "769-789",
    "why_it_governs": "A prose lesson returns. The fail-closed class was swept in the hero build and this build still produced a NEW variant of it at the value altitude, which is the asset's own thesis demonstrating itself.",
    "how_this_build_will_embody_it": "The file header states the rule, and check.md records the variant that prose did not prevent — with the chokepoint that would have." },
  { "id": "A38", "read_at": "2026-08-14T20:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1022",
    "why_it_governs": "Verified is a claim about a command. The claim that mattered most here — that the honesty stats are true without JavaScript — could only be settled by reading the server-rendered HTML.",
    "how_this_build_will_embody_it": "build.md pastes tsc's exit code, the HTTP status, the capture size, and the literal grep of the SSR output." }
]
```

## Hypotheses, written before building

```json
{
  "hypotheses": [
    {
      "id": "H1",
      "claim": "A count-up starting at 0 will state the OPPOSITE of the truth whenever it does not run — the honesty stats would read '0 days of silence' and '0 signals minimum'.",
      "confidence": "medium",
      "test": "render the full page headless and read the Proof section; then curl the SSR html and grep for the literal numbers",
      "outcome": "CONFIRMED. The capture showed '0 days', '0 signals', '0'. Not missing content — inverted content, on the three numbers that assert our honesty guarantees. Fixed; SSR now emits >30<, >3<, >0<."
    },
    {
      "id": "H2",
      "claim": "min(100svh, 1080px) drops the entire declaration on an engine without svh, collapsing the hero — the residual opened at the end of the previous build.",
      "confidence": "high",
      "test": "inspect the declaration, add a plain-vh line before it, confirm both are present in order",
      "outcome": "CONFIRMED. An invalid value inside min() invalidates the declaration rather than the function. Fallback line added ahead of the svh line."
    }
  ]
}
```

## Four-layer pre-walk

1 **structure** — seven sections in one module sharing one `Rise` primitive; no shipped component touched.
2 **effectivity** — the layer that failed (H1). Verified by full-page capture plus a direct read of the SSR HTML.
3 **composition** — the arc runs problem → turn → how → modules → differentiator → proof → close → footer, matching the brief's order; the hero's "See it work" and the nav both target `#differentiator`.
4 **surface** — brand tokens mirror `brand.ts`; every entrance transform-only; reduced-motion path on each.

**Verdict: SHIPPABLE-WITH-FOLLOWUP** — as a preview. The live homepage is a separate decision.
