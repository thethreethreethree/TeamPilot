---
tbc_version: 1
trigger: refactor
started_at: 2026-08-14T19:43:00Z
manifest_entries: 12
hypotheses: 1
---

# THINK - rise-chokepoint

## Request restated
Work the top residual of the sections build: make `Rise` the ONLY entrance primitive and refactor the
differentiator onto it, so a fail-closed reveal becomes unexpressible rather than merely discouraged.

## Why this problem exists, from the record
The class recurred **four times across two builds** — an `@property` mask (headline invisible),
framer-motion `opacity: 0` on three hero elements (invisible), `whileInView opacity: 0` on the
differentiator frame (washed out), and a count-up whose resting value was its own opposite. Each was
fixed at the instance and the class came back at the next opportunity.

A30 names the terminal step: the boundary of a class is not the last instance in the code, it is the
gate that prevents the next one. A grep gate was declined under A33 in the hero build because
`opacity: 0` has legitimate uses on this page — the transparent range input, deliberate overlays — so
a detector would fire on correct code and be learned around. A **chokepoint** is the remaining answer.

## Session-read manifest

Carried from `2026-08-15-landing-wow-hero`, where every clause and asset range below was verified
**byte-identical** to this repo's copy by per-range hash before any timestamp was written. `tbc:docs`
exits 0 on this run against the same digests.

```json
[
  { "id": "§1.5.3", "read_at": "2026-08-14T21:02:00Z", "source_file": "CLAUDE.md", "line_range": "174-196",
    "why_it_governs": "Cited in this session's commit range, so it owes an entry. Its subject — correctness depending on something the repository does not hold — is not engaged by this refactor.",
    "how_this_build_will_embody_it": "No external config touched; declared for completeness rather than claimed as governing." },
  { "id": "§2.2", "read_at": "2026-08-14T21:03:00Z", "source_file": "CLAUDE.md", "line_range": "275-299",
    "why_it_governs": "Consume the verdict, never re-derive it. This build is that clause applied to entrance semantics: Rise becomes the single authority for what an entrance may animate, instead of three files each deciding.",
    "how_this_build_will_embody_it": "Three independent implementations collapse into one primitive that every section consumes." },
  { "id": "§3.4", "read_at": "2026-08-14T22:24:00Z", "source_file": "CLAUDE.md", "line_range": "332-342",
    "why_it_governs": "Honesty is the moat. The counter fix from the sections build had to survive this refactor, or the page would resume asserting the opposite of our own guarantees.",
    "how_this_build_will_embody_it": "SSR re-grepped after the change: 30, 3 and 0 are still emitted before any JavaScript runs." },
  { "id": "§0", "read_at": "2026-08-14T20:06:40Z", "source_file": "CLAUDE.md", "line_range": "10-20",
    "why_it_governs": "The cause was already in the record — four instances of one class, fixed four times in prose. Understanding meant acting on that pattern rather than patching a fifth instance.",
    "how_this_build_will_embody_it": "The change targets the cause (two implementations of one idea) rather than any individual defect." },
  { "id": "§0.1", "read_at": "2026-08-14T20:06:40Z", "source_file": "CLAUDE.md", "line_range": "22-42",
    "why_it_governs": "Forbids citing what was not read. These reads are carried from two predecessor builds, which is a claim that needs its verification stated rather than implied.",
    "how_this_build_will_embody_it": "Provenance and method named above; no fresh timestamps minted for reads that did not happen twice." },
  { "id": "§1.5.1", "read_at": "2026-08-14T20:08:00Z", "source_file": "CLAUDE.md", "line_range": "78-137",
    "why_it_governs": "A refactor of already-working components is exactly where layer 2 breaks silently: the types keep passing while the layout moves underneath them.",
    "how_this_build_will_embody_it": "The differentiator was re-captured and inspected after the restructure rather than trusted because tsc stayed green." },
  { "id": "§1.5.2", "read_at": "2026-08-14T20:08:00Z", "source_file": "CLAUDE.md", "line_range": "139-172",
    "why_it_governs": "Hypothesis before action. The one risk in this refactor was predictable from the component tree, so it was worth writing down before touching a file.",
    "how_this_build_will_embody_it": "H1 written first, confirmed, and fixed before verification rather than discovered by the founder." },
  { "id": "§6", "read_at": "2026-08-14T20:06:45Z", "source_file": "CLAUDE.md", "line_range": "402-422",
    "why_it_governs": "Item 1a — read this session, not recalled. It is the question that produced the carried-read disclosure instead of nine convenient timestamps.",
    "how_this_build_will_embody_it": "Carried reads are labelled as carried, with the verification method on the record." },
  { "id": "A19", "read_at": "2026-08-14T20:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-476",
    "why_it_governs": "The governing lesson must live where the author will meet it. Reveal.tsx had the rule right and sat one directory away, unread, through four violations.",
    "how_this_build_will_embody_it": "Rise.tsx's header is now that place — an author adding an entrance must open the file that states the rule." },
  { "id": "A22", "read_at": "2026-08-14T20:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-640",
    "why_it_governs": "Citation runs at the speed of language, reading at the speed of attention.",
    "how_this_build_will_embody_it": "Reads carried with their method named rather than presented as new." },
  { "id": "A30", "read_at": "2026-08-14T20:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "769-789",
    "why_it_governs": "This build IS A30's terminal step. Four instances fixed in prose is the asset's own evidence that the fix was structurally incomplete each time.",
    "how_this_build_will_embody_it": "The lesson ships as a chokepoint — Rise has no opacity prop — so the defect cannot be expressed rather than merely being discouraged." },
  { "id": "A38", "read_at": "2026-08-14T20:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1022",
    "why_it_governs": "Verified is a claim about a command. For a refactor the tempting claim is 'types pass, therefore nothing broke', which is precisely the scoped substitute A38 describes.",
    "how_this_build_will_embody_it": "tsc's exit code, the HTTP status, the capture size and a re-grep of the SSR values are all pasted in build.md." }
]
```

## Hypothesis, written before touching the files

```json
{
  "hypotheses": [
    {
      "id": "H1",
      "claim": "Wrapping the differentiator frame in Rise will change the positioning context, because .before and .after are absolutely positioned against .frame and --pos is set on it.",
      "confidence": "high",
      "test": "refactor, then capture the differentiator and confirm both panels still position correctly",
      "outcome": "CONFIRMED. Rise renders its own div, so it took ownership of the outer element and both the custom property and the absolute children needed an inner layer. Fixed with a .frameInner rule BEFORE verification — see check.md F1. tsc stayed green throughout, which is the point."
    }
  ]
}
```

## Four-layer pre-walk

1 **structure** — one primitive replaces three bespoke implementations of the same idea.
2 **effectivity** — the risk layer for any refactor; re-captured rather than assumed.
3 **composition** — no section boundary moved; the arc is unchanged.
4 **surface** — entrance timing is now identical across sections, which is a consistency gain.

**Verdict: SHIPPABLE-WITH-FOLLOWUP.**
